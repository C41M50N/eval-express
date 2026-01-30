export type ScoreResult = {
  score: number;
  pass?: boolean;
  label?: string;
  details?: Record<string, unknown>;
};

export type ScoreContext<EvalParams, TaskInput, TaskOutput> = {
  task: {
    name: string;
    description?: string;
  };
  eval: {
    id: string;
    name?: string;
    input: TaskInput;
    expectedOutput: TaskOutput;
    scorer?: string;
    metadata?: Record<string, unknown>;
  } & Partial<EvalParams>;
  params: EvalParams;
  runId: string;
  attempt: number;
};

export type ScorerFn<EvalParams, TaskInput, TaskOutput> = (
  ctx: ScoreContext<EvalParams, TaskInput, TaskOutput>,
  output: TaskOutput,
  expected: TaskOutput,
) => ScoreResult | Promise<ScoreResult>;

export type ScorerRegistry<EvalParams, TaskInput, TaskOutput> = Record<
  string,
  ScorerFn<EvalParams, TaskInput, TaskOutput>
>;

export type BuiltInScorerName =
  | "string_exact_match"
  | "string_fuzzy_match"
  | "object_exact_match"
  | "object_fuzzy_match";

type ObjectLike = Record<string, unknown> | ReadonlyArray<unknown>;

export type BuiltInScorerNameFor<TOutput> = TOutput extends string
  ? "string_exact_match" | "string_fuzzy_match"
  : TOutput extends ObjectLike
    ? "object_exact_match" | "object_fuzzy_match"
    : never;

export type CustomScorerName<Scorers> = Extract<keyof Scorers, string>;

export type ScorerName<Scorers, TaskOutput> =
  | BuiltInScorerNameFor<TaskOutput>
  | CustomScorerName<Scorers>;

type ReservedEvalParams = {
  id?: never;
  name?: never;
  input?: never;
  expectedOutput?: never;
  scorer?: never;
  metadata?: never;
};

export type EvalParamsShape = Record<string, unknown> & ReservedEvalParams;

export type RunFieldsShape = Record<string, unknown>;

export type RunFieldSetter<RunFields extends RunFieldsShape> = (
  fields: RunFields,
) => void;

export type Matrix<EvalParams> = Partial<{
  [Key in keyof EvalParams]: ReadonlyArray<EvalParams[Key]>;
}>;

export type EvalCase<
  EvalParams extends EvalParamsShape,
  TaskInput,
  TaskOutput,
  Scorers extends ScorerRegistry<EvalParams, TaskInput, TaskOutput>,
> = {
  id?: string;
  name?: string;
  input: TaskInput;
  expectedOutput: TaskOutput;
  scorer?: ScorerName<Scorers, TaskOutput>;
  metadata?: Record<string, unknown>;
} & Partial<EvalParams>;

export type TaskRunner<
  EvalParams,
  TaskInput,
  TaskOutput,
  RunFields extends RunFieldsShape = RunFieldsShape,
> = (
  id: string,
  input: TaskInput,
  params: EvalParams,
  setRunFields: RunFieldSetter<RunFields>,
) => TaskOutput | Promise<TaskOutput>;

export type TaskDefinition<
  EvalParams extends EvalParamsShape,
  TaskInput,
  TaskOutput,
  Scorers extends ScorerRegistry<EvalParams, TaskInput, TaskOutput> = {},
  RunFields extends RunFieldsShape = RunFieldsShape,
> = {
  name: string;
  description?: string;
  task: TaskRunner<EvalParams, TaskInput, TaskOutput, RunFields>;
  defaults?: Partial<EvalParams>;
  matrix?: Matrix<EvalParams>;
  scorers?: Scorers;
  scorer?: ScorerName<Scorers, TaskOutput>;
  evals: ReadonlyArray<EvalCase<EvalParams, TaskInput, TaskOutput, Scorers>>;
};

export type TaskDefinitionAny = TaskDefinition<
  any,
  any,
  any,
  ScorerRegistry<any, any, any>,
  RunFieldsShape
>;

export type TaskPlan<EvalParams, TaskInput, TaskOutput> = {
  planId: string;
  taskName: string;
  evalId: string;
  evalName?: string;
  params: EvalParams;
  input: TaskInput;
  expectedOutput: TaskOutput;
  scorer?: string;
  metadata?: Record<string, unknown>;
};

export type TaskPlanFromTask<TTask> = TTask extends TaskDefinition<
  infer EvalParams,
  infer TaskInput,
  infer TaskOutput,
  any,
  any
>
  ? TaskPlan<EvalParams, TaskInput, TaskOutput>
  : never;

export type RunStatus = "success" | "error";

export type EvalRunRecord<
  EvalParams,
  TaskInput,
  TaskOutput,
  RunFields extends RunFieldsShape = RunFieldsShape,
> = {
  id: string;
  status: RunStatus;
  taskName: string;
  taskDescription?: string;
  evalId: string;
  evalName?: string;
  attempt: number;
  params: EvalParams;
  input: TaskInput;
  expectedOutput: TaskOutput;
  output?: TaskOutput;
  scorer?: string;
  score?: ScoreResult;
  error?: unknown;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  metadata?: Record<string, unknown>;
  runFields?: RunFields;
};

export type SaveRunsOptions<
  TRun extends EvalRunRecord<any, any, any, any> = EvalRunRecord<any, any, any, any>,
> = {
  serializer?: (run: TRun) => unknown;
  pretty?: boolean;
};

export type RunTaskOptions = {
  runsPerEval?: number;
  maxConcurrency?: number;
  verbose?: boolean;
};

export type RunRecordFromTask<TTask> = TTask extends TaskDefinition<
  infer EvalParams,
  infer TaskInput,
  infer TaskOutput,
  any,
  infer RunFields
>
  ? EvalRunRecord<EvalParams, TaskInput, TaskOutput, RunFields>
  : never;

export type PlanTaskResult<TTask extends TaskDefinitionAny> =
  Array<TaskPlanFromTask<TTask>>;

export type RunTaskResult<TTask extends TaskDefinitionAny> = {
  runs: Array<RunRecordFromTask<TTask>>;
};
