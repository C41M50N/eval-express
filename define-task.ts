import type {
  EvalParamsShape,
  ScorerRegistry,
  TaskDefinition,
} from "./types.js";

export function defineTask<
  EvalParams extends EvalParamsShape,
  TaskInput,
  TaskOutput,
>(): <
  Scorers extends ScorerRegistry<EvalParams, TaskInput, TaskOutput> = {},
>(
  task: TaskDefinition<EvalParams, TaskInput, TaskOutput, Scorers>,
) => TaskDefinition<EvalParams, TaskInput, TaskOutput, Scorers>;
export function defineTask<
  EvalParams extends EvalParamsShape,
  TaskInput,
  TaskOutput,
  Scorers extends ScorerRegistry<EvalParams, TaskInput, TaskOutput> = {},
>(
  task: TaskDefinition<EvalParams, TaskInput, TaskOutput, Scorers>,
): TaskDefinition<EvalParams, TaskInput, TaskOutput, Scorers>;
export function defineTask(task?: TaskDefinition<any, any, any, any>) {
  if (task) {
    return task;
  }

  return (taskConfig: TaskDefinition<any, any, any, any>) => taskConfig;
}
