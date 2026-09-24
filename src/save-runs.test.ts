import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defineTask } from "./define-task.js";
import { runTask } from "./run.js";
import { saveRuns } from "./save-runs.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "eval-express-save-runs-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const saveAndRead = async (runs: readonly unknown[]): Promise<any> => {
  const filePath = join(dir, "runs.json");
  await saveRuns(runs as any, filePath);
  return JSON.parse(await readFile(filePath, "utf8"));
};

describe("saveRuns", () => {
  it("keeps params and expected output shared across runsPerEval attempts", async () => {
    const task = defineTask<{ model: string }, string, { title: string }>({
      name: "shared-references",
      task: async () => ({ title: "ok" }),
      defaults: { model: "test-model" },
      evals: [{ input: "hello", expectedOutput: { title: "ok" }, metadata: { tag: "a" } }],
    });

    const { runs } = await runTask(task, { runsPerEval: 3 });
    const saved = await saveAndRead(runs);

    expect(saved).toHaveLength(3);
    for (const run of saved) {
      expect(run.params).toEqual({ model: "test-model" });
      expect(run.expectedOutput).toEqual({ title: "ok" });
      expect(run.metadata).toEqual({ tag: "a" });
    }
  });

  it("serializes an object shared by sibling keys in full", async () => {
    const shared = { value: 1 };
    const [saved] = await saveAndRead([{ left: shared, right: shared, list: [shared, shared] }]);

    expect(saved).toEqual({
      left: { value: 1 },
      right: { value: 1 },
      list: [{ value: 1 }, { value: 1 }],
    });
  });

  it("marks self-references as circular", async () => {
    const node: Record<string, unknown> = { name: "node" };
    node.self = node;
    node.children = [node];

    const [saved] = await saveAndRead([node]);

    expect(saved).toEqual({ name: "node", self: "[Circular]", children: ["[Circular]"] });
  });

  it("marks self-referencing maps and sets as circular", async () => {
    const map = new Map<string, unknown>();
    map.set("self", map);
    const set = new Set<unknown>();
    set.add(set);

    const [saved] = await saveAndRead([{ map, set }]);

    expect(saved).toEqual({ map: { self: "[Circular]" }, set: ["[Circular]"] });
  });

  it("converts non-JSON values", async () => {
    const error = new Error("boom");
    const namedFn = function namedFn() {};

    const [saved] = await saveAndRead([
      {
        big: 10n,
        date: new Date("2026-01-02T03:04:05.000Z"),
        error,
        map: new Map([["a", 1]]),
        set: new Set([1, 2]),
        fn: namedFn,
        anonymousFn: (() => () => {})(),
        symbol: Symbol("tag"),
        missing: undefined,
        list: [undefined],
      },
    ]);

    expect(saved).toEqual({
      big: "10",
      date: "2026-01-02T03:04:05.000Z",
      error: { name: "Error", message: "boom", stack: error.stack },
      map: { a: 1 },
      set: [1, 2],
      fn: "namedFn()",
      anonymousFn: "anonymous()",
      symbol: "Symbol(tag)",
      list: [null],
    });
  });
});
