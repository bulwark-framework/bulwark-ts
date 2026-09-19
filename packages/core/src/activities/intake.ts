import { Ajv, type ValidateFunction } from "ajv";
import { IntakeSchemaViolationError, InvalidRubricError } from "../rubric/errors.js";
import type { JsonSchemaObject } from "../rubric/schema.js";
import { wrapBulwarkErrors } from "./failures.js";
import type { Activities, IntakeAdapter } from "./types.js";

/** The default adapter: the caller already extracted the facet into JSON. */
export const passthroughIntake: IntakeAdapter = async (input) => input.artefacts.json;

/** JSON Pointer escaping (RFC 6901): `~` becomes `~0`, `/` becomes `~1`. */
function escapePointer(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function unescapePointer(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

/**
 * Compiles the facet's sub-schema *in the context of the whole state schema*,
 * so a `$ref` inside the facet still means what it meant when the rubric was
 * validated: `#` is the state schema root and `#/$defs/x` resolves. Compiling
 * the extracted sub-schema alone would silently re-root `#` at the facet.
 *
 * Ajv runs in strict mode so an unknown keyword is a rubric error, not a
 * silently ignored constraint. Two strict checks are relaxed: `strictTypes`,
 * because the rubric schema accepts nodes that declare `properties` without
 * `type`, and `strictTuples`, because the rubric schema accepts tuple `items`.
 * `format` is not validated: no format vocabulary is bundled, so a format is
 * documentation only. The root `$schema` is dropped before compilation because
 * Zod 4 emits the 2020-12 meta-schema URI and Ajv's default class does not
 * register it; every keyword the authoring API emits is draft-07 compatible.
 */
function facetValidator(stateSchema: JsonSchemaObject, facet: string): ValidateFunction {
  const { $schema: _dropped, ...root } = stateSchema;
  try {
    const ajv = new Ajv({
      strict: true,
      strictTypes: false,
      strictTuples: false,
      allErrors: true,
      validateFormats: false,
    });
    ajv.addSchema(root, "state");
    const validate = ajv.getSchema(`state#/properties/${escapePointer(facet)}`);
    if (!validate) throw new Error(`no schema at state_schema.properties.${facet}`);
    return validate;
  } catch (error) {
    throw new InvalidRubricError(
      [
        {
          path: `state_schema.properties.${facet}`,
          message: error instanceof Error ? error.message : String(error),
        },
      ],
      `state_schema for facet "${facet}" cannot be compiled`,
    );
  }
}

/**
 * Wraps an intake adapter as the `intake` activity: runs the adapter, then
 * validates the fragment against `stateSchema.properties[facet]`.
 *
 * @throws IntakeSchemaViolationError (non-retryable through the activity
 * wrapper) when the facet is not declared or the fragment violates its schema.
 * Each issue path starts with the facet and continues with the dotted
 * instance path; the message carries Ajv's text and the schema path.
 * @throws InvalidRubricError when the facet's schema cannot be compiled.
 * Adapter errors propagate unchanged.
 */
export function intake(adapter: IntakeAdapter): Activities["intake"] {
  return (input) =>
    wrapBulwarkErrors(async () => {
      const fragment = await adapter(input);
      const { facet, stateSchema, caseId } = input;
      const message = `intake for case "${caseId}", facet "${facet}" is invalid`;
      if (
        typeof stateSchema === "boolean" ||
        !stateSchema.properties ||
        !Object.hasOwn(stateSchema.properties, facet)
      ) {
        throw new IntakeSchemaViolationError(
          [{ path: facet, message: `facet "${facet}" is not declared in state_schema` }],
          message,
        );
      }
      const validate = facetValidator(stateSchema, facet);
      if (!validate(fragment)) {
        const issues = (validate.errors ?? []).map((error) => ({
          path: [facet, ...error.instancePath.split("/").slice(1).map(unescapePointer)].join("."),
          message: `${error.message} (schema: ${error.schemaPath})`,
        }));
        throw new IntakeSchemaViolationError(issues, message);
      }
      return { facet, fragment };
    });
}
