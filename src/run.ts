import { builtInScorers } from "./scorers.js";
import type {
  EvalCase,
  EvalParamsShape,
  EvalRunRecord,
  Matrix,
  RunFieldSetter,
  RunFieldsShape,
  RunTaskOptions,
  RunTaskResult,
  ScorerFn,
  ScorerRegistry,
  ScoreContext,
  ScoreResult,
  TaskDefinition,
  TaskPlan,
} from "./types.js";
import type { BuiltInScorerName } from "./types.js";

const RESERVED_EVAL_KEYS = new Set([
  "id",
  "name",
  "input",
  "expectedOutput",
  "scorer",
  "metadata",
]);

type PlanEntry<
  EvalParams extends EvalParamsShape,
  TaskInput,
  TaskOutput,
  Scorers extends ScorerRegistry<EvalParams, TaskInput, TaskOutput>,
  RunFields extends RunFieldsShape,
> = {
  plan: TaskPlan<EvalParams, TaskInput, TaskOutput>;
  evalCase: EvalCase<EvalParams, TaskInput, TaskOutput, Scorers>;
  params: EvalParams;
  scorerName?: string;
  scorerFn?: ScorerFn<EvalParams, TaskInput, TaskOutput>;
};

type ExecutionPlan<
  EvalParams extends EvalParamsShape,
  TaskInput,
  TaskOutput,
  Scorers extends ScorerRegistry<EvalParams, TaskInput, TaskOutput>,
  RunFields extends RunFieldsShape,
> = {
  entry: PlanEntry<EvalParams, TaskInput, TaskOutput, Scorers, RunFields>;
  attempt: number;
};

const createRunId = (): string => {
  if (globalThis.crypto?.randomUUID) {
    return `run_${globalThis.crypto.randomUUID()}`;
  }

  return `run_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const createEvalId = (
  evalCase: EvalCase<EvalParamsShape, unknown, unknown, ScorerRegistry<any, any, any>>,
  index: number,
): string => {
  if (evalCase.id) {
    return evalCase.id;
  }

  if (evalCase.name) {
    const slug = slugify(evalCase.name);
    if (slug.length > 0) {
      return slug;
    }
  }

  return `eval-${index + 1}`;
};

const createPlanId = (
  taskName: string,
  evalId: string,
  matrixIndex: number,
): string => {
  const taskSlug = slugify(taskName) || "task";
  const evalSlug = slugify(evalId) || `eval-${matrixIndex + 1}`;
  return `plan-${taskSlug}-${evalSlug}-${matrixIndex + 1}`;
};

const resolveScorer = <EvalParams, TaskInput, TaskOutput>(
  name: string,
  taskScorers?: ScorerRegistry<EvalParams, TaskInput, TaskOutput>,
): ScorerFn<EvalParams, TaskInput, TaskOutput> | undefined => {
  if (taskScorers && Object.hasOwn(taskScorers, name)) {
    return taskScorers[name];
  }

  if (Object.hasOwn(builtInScorers, name)) {
    return builtInScorers[name as BuiltInScorerName] as ScorerFn<
      EvalParams,
      TaskInput,
      TaskOutput
    >;
  }

  return undefined;
};

const ensureScoreResult = (value: unknown, scorerName: string): ScoreResult => {
  if (!value || typeof value !== "object") {
    throw new Error(
      `Scorer "${scorerName}" returned an invalid score result object.`,
    );
  }

  const score = (value as ScoreResult).score;
  if (typeof score !== "number" || Number.isNaN(score)) {
    throw new Error(
      `Scorer "${scorerName}" returned a non-numeric score value.`,
    );
  }

  return value as ScoreResult;
};

const extractEvalParams = <EvalParams extends EvalParamsShape>(
  evalCase: EvalCase<EvalParams, unknown, unknown, ScorerRegistry<any, any, any>>,
): Partial<EvalParams> => {
  const params: Partial<EvalParams> = {};
  for (const [key, value] of Object.entries(
    evalCase as Record<string, unknown>,
  )) {
    if (RESERVED_EVAL_KEYS.has(key)) {
      continue;
    }

    (params as Record<string, unknown>)[key] = value;
  }

  return params;
};

type MatrixEntry<EvalParams extends Record<string, unknown>> = [
  keyof EvalParams,
  ReadonlyArray<EvalParams[keyof EvalParams]>,
];

const buildMatrixCombinations = <EvalParams extends Record<string, unknown>>(
  matrix: Matrix<EvalParams> | undefined,
  taskName: string,
): Array<Partial<EvalParams>> => {
  if (!matrix) {
    return [{}];
  }

  const entries = Object.entries(matrix).map(([key, values]) => {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(
        `Matrix entry "${key}" must be a non-empty array for task "${taskName}".`,
      );
    }

    return [
      key as keyof EvalParams,
      values as ReadonlyArray<EvalParams[keyof EvalParams]>,
    ] satisfies MatrixEntry<EvalParams>;
  });

  if (entries.length === 0) {
    return [{}];
  }

  let combinations: Array<Partial<EvalParams>> = [{}];
  for (const [key, values] of entries) {
    const next: Array<Partial<EvalParams>> = [];
    for (const combo of combinations) {
      for (const value of values) {
        next.push({ ...combo, [key]: value });
      }
    }
    combinations = next;
  }

  return combinations;
};

const buildPlanEntries = <
  EvalParams extends EvalParamsShape,
  TaskInput,
  TaskOutput,
  Scorers extends ScorerRegistry<EvalParams, TaskInput, TaskOutput>,
  RunFields extends RunFieldsShape,
>(
  task: TaskDefinition<EvalParams, TaskInput, TaskOutput, Scorers, RunFields>,
): PlanEntry<EvalParams, TaskInput, TaskOutput, Scorers, RunFields>[] => {
  const matrixCombos = buildMatrixCombinations(task.matrix, task.name);
  const evalIds = new Set<string>();
  const entries: PlanEntry<
    EvalParams,
    TaskInput,
    TaskOutput,
    Scorers,
    RunFields
  >[] = [];

  task.evals.forEach((evalCase, evalIndex) => {
    const evalId = createEvalId(
      evalCase as EvalCase<
        EvalParamsShape,
        unknown,
        unknown,
        ScorerRegistry<any, any, any>
      >,
      evalIndex,
    );

    if (evalIds.has(evalId)) {
      throw new Error(
        `Eval id "${evalId}" is duplicated in task "${task.name}".`,
      );
    }

    evalIds.add(evalId);

    const evalParams = extractEvalParams(
      evalCase as EvalCase<
        EvalParamsShape,
        unknown,
        unknown,
        ScorerRegistry<any, any, any>
      >,
    ) as Partial<EvalParams>;

    const scorerName = evalCase.scorer ?? task.scorer;
    const scorerFn = scorerName ? resolveScorer(scorerName, task.scorers) : undefined;

    if (scorerName && !scorerFn) {
      throw new Error(
        `Scorer "${scorerName}" is not registered for task "${task.name}".`,
      );
    }

    matrixCombos.forEach((combo, matrixIndex) => {
      const params = {
        ...task.defaults,
        ...combo,
        ...evalParams,
      } as EvalParams;

      const plan: TaskPlan<EvalParams, TaskInput, TaskOutput> = {
        planId: createPlanId(task.name, evalId, matrixIndex),
        taskName: task.name,
        evalId,
        evalName: evalCase.name,
        params,
        input: evalCase.input,
        expectedOutput: evalCase.expectedOutput,
        scorer: scorerName,
        metadata: evalCase.metadata,
      };

      entries.push({
        plan,
        evalCase,
        params,
        scorerName,
        scorerFn,
      });
    });
  });

  return entries;
};

const runWithConcurrency = async <T, R>(
  items: readonly T[],
  handler: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      if (currentIndex >= items.length) {
        return;
      }

      nextIndex += 1;
      const item = items[currentIndex];
      if (item === undefined) {
        return;
      }
      results[currentIndex] = await handler(item, currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
};

const executePlan = async <
  EvalParams extends EvalParamsShape,
  TaskInput,
  TaskOutput,
  Scorers extends ScorerRegistry<EvalParams, TaskInput, TaskOutput>,
  RunFields extends RunFieldsShape,
>(
  task: TaskDefinition<EvalParams, TaskInput, TaskOutput, Scorers, RunFields>,
  plan: ExecutionPlan<EvalParams, TaskInput, TaskOutput, Scorers, RunFields>,
  verbose: boolean,
): Promise<EvalRunRecord<EvalParams, TaskInput, TaskOutput, RunFields>> => {
  const { entry, attempt } = plan;
  const { evalCase, params, scorerName, scorerFn } = entry;
  const { plan: planDetails } = entry;
  const runId = createRunId();
  const startedAt = new Date();
  const startMs = Date.now();
  let runFields: RunFields | undefined;

  const setRunFields: RunFieldSetter<RunFields> = (fields) => {
    runFields = fields;
  };

  if (verbose) {
    const label = planDetails.evalName ?? planDetails.evalId;
    console.log(`[eval-express] ${task.name} :: ${label} (run ${attempt})`);
  }

  let output: TaskOutput | undefined;
  let score: ScoreResult | undefined;
  let error: unknown;

  try {
    output = await task.task(
      planDetails.evalId,
      planDetails.input,
      params,
      setRunFields,
    );

    if (scorerName && scorerFn) {
      const evalContext = {
        ...evalCase,
        id: planDetails.evalId,
        scorer: scorerName,
      } as ScoreContext<EvalParams, TaskInput, TaskOutput>["eval"];

      const ctx: ScoreContext<EvalParams, TaskInput, TaskOutput> = {
        task: {
          name: task.name,
          description: task.description,
        },
        eval: evalContext,
        params,
        runId,
        attempt,
      };

      const rawScore = await scorerFn(ctx, output, planDetails.expectedOutput);
      score = ensureScoreResult(rawScore, scorerName);
    }
  } catch (caught) {
    error = caught;
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startMs;
  const status = error ? "error" : "success";

  if (verbose) {
    if (error) {
      console.log(
        `[eval-express] ${task.name} :: ${planDetails.evalId} failed (${status}).`,
      );
    } else if (score) {
      console.log(
        `[eval-express] ${task.name} :: ${planDetails.evalId} scored ${score.score}.`,
      );
    }
  }

  return {
    id: runId,
    status,
    taskName: task.name,
    taskDescription: task.description,
    evalId: planDetails.evalId,
    evalName: planDetails.evalName,
    attempt,
    params,
    input: planDetails.input,
    expectedOutput: planDetails.expectedOutput,
    output,
    scorer: scorerName,
    score,
    error,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    metadata: planDetails.metadata,
    runFields,
  };
};

export const planTask = <
  EvalParams extends EvalParamsShape,
  TaskInput,
  TaskOutput,
  Scorers extends ScorerRegistry<EvalParams, TaskInput, TaskOutput> = {},
  RunFields extends RunFieldsShape = RunFieldsShape,
>(
  task: TaskDefinition<EvalParams, TaskInput, TaskOutput, Scorers, RunFields>,
): TaskPlan<EvalParams, TaskInput, TaskOutput>[] => {
  const entries = buildPlanEntries(task);
  return entries.map((entry) => entry.plan);
};

export const runTask = async <
  EvalParams extends EvalParamsShape,
  TaskInput,
  TaskOutput,
  Scorers extends ScorerRegistry<EvalParams, TaskInput, TaskOutput> = {},
  RunFields extends RunFieldsShape = RunFieldsShape,
>(
  task: TaskDefinition<EvalParams, TaskInput, TaskOutput, Scorers, RunFields>,
  options: RunTaskOptions = {},
): Promise<
  RunTaskResult<
    TaskDefinition<EvalParams, TaskInput, TaskOutput, Scorers, RunFields>
  >
> => {
  const normalizedOptions: Required<RunTaskOptions> = {
    runsPerEval: Math.max(1, options.runsPerEval ?? 1),
    maxConcurrency: Math.max(1, options.maxConcurrency ?? 1),
    verbose: options.verbose ?? false,
  };

  const entries = buildPlanEntries(task);
  const executionPlans: Array<
    ExecutionPlan<EvalParams, TaskInput, TaskOutput, Scorers, RunFields>
  > = [];

  for (const entry of entries) {
    for (let attempt = 1; attempt <= normalizedOptions.runsPerEval; attempt += 1) {
      executionPlans.push({ entry, attempt });
    }
  }

  const runs = await runWithConcurrency(
    executionPlans,
    (plan) => executePlan(task, plan, normalizedOptions.verbose),
    normalizedOptions.maxConcurrency,
  );

  return {
    runs,
  };
};
