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

## Comparing workflows and agents (or any set of functions)

To evaluate different workflows or agents against the same evals, set a matrix
param to a list of **functions** and have your single task function dispatch to
whichever one the run selected. The matrix expands into one run per function
(crossed with every eval), so each subject is measured under identical
conditions.

```typescript
type EvalParams = { agent: (input: string) => Promise<string> };

async function runAgentV1(input: string) {
  /* ... */
  return "…";
}

async function runAgentV2(input: string) {
  /* ... */
  return "…";
}

const task = defineTask<EvalParams, string, string>({
  name: "Agent Comparison",
  scorer: "string_fuzzy_match",
  // The task fn is a thin harness that runs whichever agent this run selected.
  task: (_id, input, { agent }) => agent(input),
  matrix: {
    agent: [runAgentV1, runAgentV2],
  },
  evals: [
    { input: "…", expectedOutput: "…" },
  ],
});
```

> **Use named functions.** The subject of each run is identified by the
> function's `name`, so pass named function declarations or named references —
> not inline anonymous arrow functions, which serialize without a name and
> become indistinguishable from one another.

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
