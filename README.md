# Eval Express

Type-safe eval builder with scorer pipelines, run planning, and optional score aggregation.

## Installation

```bash
bun add @cbuff/eval-express
```

## Usage

```typescript
import { defineTask, planTask, runTask, saveRuns } from "@cbuff/eval-express";
import { ai } from "@example/ai";

type EvalParams = { model: string };
type RunFields = { cost: number };

const task = defineTask<EvalParams, string, string, {}, RunFields>({
  name: "Support Ticket Title",
  scorer: "string_fuzzy_match",
  task: async (_id, input, { model }, setRunFields) => {
    const { data, metadata } = await ai.generate({
      model,
      prompt: `Write a short title:\n${input}`,
    });
    setRunFields({ cost: metadata.totalCost });
    return data;
  },
  defaults: { model: "openai/gpt-5-nano" },
  evals: [
    {
      input: "We can't reset our password after the latest update.",
      expectedOutput: "Password reset broken after update",
    },
    {
      input: "The app crashes whenever I try to upload a photo.",
      expectedOutput: "App crashes on photo upload",
    },
    {
      input: "How do I change my account email address?",
      expectedOutput: "Change account email address",
    },
  ],
});

const plans = planTask(task);
const { runs } = await runTask(task, { runsPerEval: 3, maxConcurrency: 2 });
await saveRuns(runs, "./runs.json", { pretty: true });
```

## Scoring

Scorers run as part of the task pipeline and always receive the full context:

```typescript
type ScorerFn = (ctx, output, expected) => ScoreResult | Promise<ScoreResult>;

type ScoreResult = {
  score: number;
  pass?: boolean;
  label?: string;
  details?: Record<string, unknown>;
};
```

Built-in scorers are always available and can be overridden in `scorers`:

- `string_exact_match`
- `string_fuzzy_match`
- `object_exact_match`
- `object_fuzzy_match`

Scorer resolution order:

1. `evals[i].scorer`
2. `task.scorer`
3. Skip scoring if no scorer is configured

## Score helpers

Optional aggregation utilities live in a subpath:

```typescript
import { summarizeScores } from "@cbuff/eval-express/score-helpers";

const summary = summarizeScores(runs);
```

## API

### `defineTask()`

Creates a type-safe task definition. Call with generics to lock `EvalParams`, `TaskInput`, and `TaskOutput`.

### `planTask(task)`

Returns a flat list of validated task plans without running anything.

### `runTask(task, options)`

Executes a task, scoring as part of the run pipeline and returning typed run records.

### Run fields

Tasks receive `setRunFields(fields)` to attach run-level fields to the run record. If
called multiple times, the last call wins.

### `saveRuns(runs, filePath, options?)`

Writes run records to disk as JSON, with an optional serializer for non-JSON data.

## License

MIT

## Release process

This package uses Changesets to manage versions and changelogs.

- Create a changeset with `bun run changeset`
- Merge the release PR created by the GitHub Actions workflow
- The release workflow publishes to npm on main
