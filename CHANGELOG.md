# Changelog

## 0.4.0 - 2026-09-23

### Fixed

- `saveRuns` no longer replaces objects shared between runs (or between sibling fields of a single run) with `"[Circular]"`. Only true circular references are replaced now, so shared values such as matrix params and metadata are written in full for every run.

### Changed

- The publish workflow can now release the version already in `package.json` without bumping it.
- Add a scheduled GitHub Actions workflow for automated dependency updates and audits.
- Update `nanoid` to 5.1.16 and development dependencies (`oxlint` to 1.80.0).
- Add regression tests for `saveRuns`.

## 0.3.2 - 2026-07-05

### Fixed

- The publish workflow now pushes the release commit and tag only after `npm publish` succeeds, so a failed publish no longer leaves an orphaned release tag.

## 0.3.1 - 2026-07-05

This version was tagged but never published to npm. Its changes first shipped in 0.3.2.

### Changed

- Replace Changesets with `bumpp` and a manually triggered publish workflow that publishes with npm provenance.
- Add `oxlint` and `oxfmt` for linting and formatting, plus `test`, `lint`, and `fmt` scripts. Source changes are formatting-only; there are no behavior changes.

## 0.3.0 - 2026-07-04

### Changed

- `saveRuns` now serializes functions as `name()` (or `anonymous()` for unnamed functions) instead of `[Function: name]`. This keeps function-valued matrix params readable in saved run files.

### Added

- Document how to compare workflows or agents by setting a matrix param to a list of named functions.

### Internal

- Make release tagging idempotent in the release workflow.

## 0.2.0 - 2026-02-04

### Added

- Add GitHub Actions workflows for CI and automated releases.

No changes to the library itself.

## 0.1.0 - 2026-02-04

Initial release.

### Added

- `defineTask` for type-safe task definitions, with a curried form that locks `EvalParams`, `TaskInput`, and `TaskOutput` while inferring custom scorers and run fields.
- `planTask`, which expands evals and matrix params into a flat list of validated plans without running anything.
- `runTask`, which runs each plan and scores it, with `runsPerEval`, `maxConcurrency`, and `verbose` options. Task errors are logged and recorded on the run, and scoring is skipped for failed tasks.
- Built-in scorers: `string_exact_match`, `string_fuzzy_match`, `object_exact_match`, and `object_fuzzy_match`. Custom scorers can be registered per task and selected per eval or per task.
- `setRunFields`, passed to the task function, for attaching typed custom fields to each run record.
- `saveRuns`, which writes run records to disk as JSON. It accepts an optional serializer and handles non-JSON values such as `bigint`, `Map`, `Set`, `Error`, and circular references.
- `interpolate` for `{{key}}` template substitution.
- A `@cbuff/eval-express/score-helpers` subpath with `meanScore`, `medianScore`, `passRate`, and `summarizeScores`.
- Run IDs are base58 strings generated with `nanoid`.
