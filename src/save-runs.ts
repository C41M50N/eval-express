import type { EvalRunRecord, SaveRunsOptions } from "./types.js";

type BunLike = {
  write: (path: string, data: string) => Promise<unknown> | unknown;
};

const hasToJSON = (value: unknown): value is { toJSON: (key: string) => unknown } =>
  ((typeof value === "object" && value !== null) || typeof value === "bigint") &&
  typeof (value as { toJSON?: unknown }).toJSON === "function";

const toSerializable = (root: unknown): unknown => {
  // Objects on the path from the root to the value being visited. Only these
  // form a cycle; objects shared between siblings or runs are serialized in full.
  const ancestors = new Set<object>();

  const visit = (key: string, input: unknown): unknown => {
    // Mirror JSON.stringify, which applies toJSON (e.g. Date) before anything else.
    const value = hasToJSON(input) ? input.toJSON(key) : input;

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (typeof value === "function") {
      return `${value.name.length > 0 ? value.name : "anonymous"}()`;
    }

    if (typeof value === "symbol") {
      return value.toString();
    }

    if (typeof value !== "object" || value === null) {
      return value;
    }

    if (ancestors.has(value)) {
      return "[Circular]";
    }

    ancestors.add(value);

    try {
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }

      if (value instanceof Map) {
        return Object.fromEntries(
          Array.from(value, ([entryKey, entryValue]) => [entryKey, visit(String(entryKey), entryValue)]),
        );
      }

      if (value instanceof Set) {
        return Array.from(value, (item, index) => visit(String(index), item));
      }

      if (Array.isArray(value)) {
        return value.map((item, index) => visit(String(index), item));
      }

      const record = value as Record<string, unknown>;

      return Object.fromEntries(Object.keys(record).map((entryKey) => [entryKey, visit(entryKey, record[entryKey])]));
    } finally {
      ancestors.delete(value);
    }
  };

  return visit("", root);
};

const writeFile = async (filePath: string, contents: string): Promise<void> => {
  const bun = (globalThis as { Bun?: BunLike }).Bun;

  if (bun?.write) {
    await bun.write(filePath, contents);
    return;
  }

  const { writeFile } = await import("node:fs/promises");
  await writeFile(filePath, contents, "utf8");
};

export const saveRuns = async <TRun extends EvalRunRecord<any, any, any, any>>(
  runs: readonly TRun[],
  filePath: string,
  options: SaveRunsOptions<TRun> = {},
): Promise<void> => {
  const serializer = options.serializer ?? ((run: TRun) => run);
  const space = options.pretty ? 2 : undefined;

  const payload = runs.map((run) => serializer(run));
  const json = JSON.stringify(toSerializable(payload), null, space);

  await writeFile(filePath, json ?? "[]");
};
