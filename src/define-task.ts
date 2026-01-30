import type {
  EvalParamsShape,
  RunFieldsShape,
  ScorerRegistry,
  TaskDefinition,
} from "./types.js";

export function defineTask<
  EvalParams extends EvalParamsShape,
  TaskInput,
  TaskOutput,
>(): <
  Scorers extends ScorerRegistry<EvalParams, TaskInput, TaskOutput> = {},
  RunFields extends RunFieldsShape = RunFieldsShape,
>(
  task: TaskDefinition<EvalParams, TaskInput, TaskOutput, Scorers, RunFields>,
) => TaskDefinition<EvalParams, TaskInput, TaskOutput, Scorers, RunFields>;
export function defineTask<
  EvalParams extends EvalParamsShape,
  TaskInput,
  TaskOutput,
  Scorers extends ScorerRegistry<EvalParams, TaskInput, TaskOutput> = {},
  RunFields extends RunFieldsShape = RunFieldsShape,
>(
  task: TaskDefinition<EvalParams, TaskInput, TaskOutput, Scorers, RunFields>,
): TaskDefinition<EvalParams, TaskInput, TaskOutput, Scorers, RunFields>;
export function defineTask(task?: TaskDefinition<any, any, any, any, any>) {
  if (task) {
    return task;
  }

  return (taskConfig: TaskDefinition<any, any, any, any, any>) => taskConfig;
}
