Type-safe eval builder with scorer pipelines, run records, and optional score aggregation.

## Installation

```bash
bun add @cbuff/eval-express
```

```bash
npm install @cbuff/eval-express
```

## Usage

```typescript
import { defineTask, planTask, runTask } from "@cbuff/eval-express";

type EvalParams = {
  prompt: string;
  model: "fast" | "smart";
  temperature: number;
};

const task = defineTask<EvalParams, string, string>({
  name: "HTML to Markdown",
  scorer: "string_fuzzy_match",
  scorers: {
    custom_scorer: async (_ctx, output, expected) => {
      const outputLines = output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const expectedLines = expected
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const matches = outputLines.filter((line) => expectedLines.includes(line))
        .length;

      return { score: matches / expectedLines.length, label: "line_match" };
    },
  },
  task: async (id, input, params) => {
    return `${id}:${params.model}:${params.temperature}:${input}`;
  },
  defaults: {
    temperature: 0.2,
  },
  matrix: {
    model: ["fast", "smart"],
    temperature: [0.0, 0.2],
  },
  evals: [
    {
      input: "<h1>Hello</h1>",
      expectedOutput: "# Hello",
      prompt: "Convert HTML to Markdown",
      scorer: "custom_scorer",
    },
  ],
});

const plans = planTask(task);
const { runs } = await runTask(task, { runsPerEval: 1, maxConcurrency: 2 });

console.log(runs[0]?.score);
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

## License

MIT
