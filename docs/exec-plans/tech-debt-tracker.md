# Tech debt tracker

Known debt with an owner and an exit criterion. Add an entry when you knowingly leave something imperfect. Remove it when the exit criterion is met.

| Added | Item | Why it exists | Exit criterion | Owner |
| --- | --- | --- | --- | --- |
| 2026-09-19 | Design docs are prose summaries, not code | No code exists yet | Each `proposed` row in `ARCHITECTURE.md` becomes `implemented` with a linked entry point | maintainer |
| 2026-09-19 | Rubric schema canonical in a markdown file | Scaffold not started | `src/rubric/schema.ts` exists and `rubric-artifact.md` links to it | maintainer |
