import { defaultPayloadConverter } from "@temporalio/common";
import { expect, it } from "vitest";
import type { History } from "./index.js";
import { assertAssessmentInvariants } from "./index.js";

type EventId = NonNullable<NonNullable<History["events"]>[number]["eventId"]>;
// History event ids are protobuf Longs; the checker compares them as strings.
const id = (n: number) => n as unknown as EventId;

function history(names: string[], hashes: string[] = []): History {
  return {
    events: names.map((name) => ({
      activityTaskScheduledEventAttributes: {
        activityType: { name },
        input: {
          payloads: [
            defaultPayloadConverter.toPayload({ rubric: { content_hash: hashes.shift() } }),
          ],
        },
      },
    })),
  };
}
it("accepts a single resolution and unchanged decide hashes", () =>
  expect(() =>
    assertAssessmentInvariants(
      history(["resolveRubric", "decide", "decide"], ["unused", "a", "a"]),
    ),
  ).not.toThrow());
it("rejects duplicate resolution", () =>
  expect(() => assertAssessmentInvariants(history(["resolveRubric", "resolveRubric"]))).toThrow(
    "resolveRubric scheduled 2 times",
  ));
it("rejects a changed decision hash when no resolution is in the history", () =>
  expect(() => assertAssessmentInvariants(history(["decide", "decide"], ["a", "b"]))).toThrow(
    "decide rubric.content_hash differs from the first decide",
  ));
function resolved(contentHash: string, eventId = id(1)): History {
  return {
    events: [
      {
        eventId,
        activityTaskScheduledEventAttributes: { activityType: { name: "resolveRubric" } },
      },
      {
        activityTaskCompletedEventAttributes: {
          scheduledEventId: eventId,
          result: { payloads: [defaultPayloadConverter.toPayload({ contentHash })] },
        },
      },
    ],
  };
}
it("rejects every decide whose hash differs from the resolved pin, even the first", () =>
  expect(() =>
    assertAssessmentInvariants({
      events: [
        ...(resolved("a").events ?? []),
        ...(history(["decide", "decide"], ["b", "b"]).events ?? []),
      ],
    }),
  ).toThrow("decide rubric.content_hash differs from the resolved pin"));
it("accepts decides that match the resolved pin", () =>
  expect(() =>
    assertAssessmentInvariants({
      events: [...(resolved("a").events ?? []), ...(history(["decide"], ["a"]).events ?? [])],
    }),
  ).not.toThrow());
it("rejects a resolveRubric result without a content hash", () =>
  expect(() =>
    assertAssessmentInvariants({
      events: [
        {
          eventId: id(1),
          activityTaskScheduledEventAttributes: { activityType: { name: "resolveRubric" } },
        },
        {
          activityTaskCompletedEventAttributes: {
            scheduledEventId: id(1),
            result: { payloads: [] },
          },
        },
      ],
    }),
  ).toThrow("resolveRubric result has no contentHash"));
it("ignores unrelated events and accepts empty history", () =>
  expect(() => assertAssessmentInvariants({ events: [{}] })).not.toThrow());
it("rejects missing input", () =>
  expect(() =>
    assertAssessmentInvariants({
      events: [{ activityTaskScheduledEventAttributes: { activityType: { name: "decide" } } }],
    }),
  ).toThrow("decide input is missing"));
