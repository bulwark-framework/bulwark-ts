#!/usr/bin/env node
import { Command } from "commander";
import { buildCommand, formatBuildError } from "./rubric-build.js";

const program = new Command().name("bulwark");
program
  .command("rubric")
  .command("build")
  .argument("<file>", "compiled JavaScript rubric definition")
  .requiredOption("--out <dir>", "artifact output directory")
  .option("--force", "replace an existing artifact file")
  .action(async (file: string, options: { out: string; force?: boolean }) => {
    const written = await buildCommand({ file, out: options.out, force: options.force ?? false });
    console.log(written);
  });
try {
  await program.parseAsync();
} catch (error) {
  console.error(formatBuildError(error));
  process.exitCode = 1;
}
