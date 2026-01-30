import type { EvalRunRecord, SaveRunsOptions } from "./types.js";

type BunLike = {
  write: (path: string, data: string) => Promise<unknown> | unknown;
};

const createJsonReplacer = () => {
  const seen = new WeakSet<object>();

  return (_key: string, value: unknown) => {
    if (typeof value === "bigint") {
      return value.toString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }

    if (value instanceof Map) {
      return Object.fromEntries(value.entries());
    }

    if (value instanceof Set) {
      return Array.from(value.values());
    }

    if (typeof value === "function") {
      return `[Function${value.name ? `: ${value.name}` : ""}]`;
    }

    if (typeof value === "symbol") {
      return value.toString();
    }

    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }

      seen.add(value);
    }

    return value;
  };
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
  const replacer = createJsonReplacer();
  const space = options.pretty ? 2 : undefined;

  const payload = runs.map((run) => serializer(run));
  const json = JSON.stringify(payload, replacer, space);

  await writeFile(filePath, json ?? "[]");
};
