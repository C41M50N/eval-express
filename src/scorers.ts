import type { BuiltInScorerName, ScorerFn } from "./types.js";

const DEFAULT_STRING_FUZZY_THRESHOLD = 0.9;
const DEFAULT_OBJECT_FUZZY_THRESHOLD = 0.85;

const assertString: (value: unknown, label: string) => asserts value is string = (
  value,
  label,
) => {
  if (typeof value !== "string") {
    throw new Error(`Expected ${label} to be a string.`);
  }
};

const assertObject: (
  value: unknown,
  label: string,
) => asserts value is Record<string, unknown> | ReadonlyArray<unknown> = (
  value,
  label,
) => {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Expected ${label} to be an object.`);
  }
};

const normalizeString = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const levenshteinDistance = (a: string, b: string): number => {
  const aLength = a.length;
  const bLength = b.length;

  if (aLength === 0) {
    return bLength;
  }

  if (bLength === 0) {
    return aLength;
  }

  const previous = new Uint32Array(bLength + 1);
  const current = new Uint32Array(bLength + 1);

  for (let j = 0; j <= bLength; j += 1) {
    previous[j] = j;
  }

  for (let i = 1; i <= aLength; i += 1) {
    current[0] = i;
    const aChar = a.charCodeAt(i - 1);

    for (let j = 1; j <= bLength; j += 1) {
      const bChar = b.charCodeAt(j - 1);
      const cost = aChar === bChar ? 0 : 1;
      const deletion = (previous[j] ?? 0) + 1;
      const insertion = (current[j - 1] ?? 0) + 1;
      const substitution = (previous[j - 1] ?? 0) + cost;
      current[j] = Math.min(deletion, insertion, substitution);
    }

    for (let j = 0; j <= bLength; j += 1) {
      previous[j] = current[j] ?? 0;
    }
  }

  return previous[bLength] ?? 0;
};

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) {
    return true;
  }

  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false;
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }

    return true;
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  for (const key of aKeys) {
    if (!Object.hasOwn(bRecord, key)) {
      return false;
    }

    if (!deepEqual(aRecord[key], bRecord[key])) {
      return false;
    }
  }

  return true;
};

const flattenLeaves = (
  value: unknown,
  path: string,
  out: Map<string, unknown>,
): void => {
  if (value === null || typeof value !== "object") {
    out.set(path, value);
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return;
    }

    value.forEach((item, index) => {
      const nextPath = path ? `${path}.${index}` : String(index);
      flattenLeaves(item, nextPath, out);
    });
    return;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);

  if (keys.length === 0) {
    return;
  }

  for (const key of keys) {
    const nextPath = path ? `${path}.${key}` : key;
    flattenLeaves(record[key], nextPath, out);
  }
};

export const builtInScorers = {
  string_exact_match: (_ctx, output: unknown, expected: unknown) => {
      assertString(output, "output");
      assertString(expected, "expected output");

      const pass = output === expected;
      return {
        score: pass ? 1 : 0,
        pass,
        label: "exact_match",
      };
    },
  string_fuzzy_match: (_ctx, output: unknown, expected: unknown) => {
      assertString(output, "output");
      assertString(expected, "expected output");

      const normalizedOutput = normalizeString(output);
      const normalizedExpected = normalizeString(expected);
      const maxLength = Math.max(normalizedOutput.length, normalizedExpected.length);

      if (maxLength === 0) {
        return {
          score: 1,
          pass: true,
          label: "fuzzy_match",
          details: { distance: 0, maxLength: 0 },
        };
      }

      const distance = levenshteinDistance(normalizedOutput, normalizedExpected);
      const similarity = 1 - distance / maxLength;
      const score = Math.max(0, Math.min(1, similarity));

      return {
        score,
        pass: score >= DEFAULT_STRING_FUZZY_THRESHOLD,
        label: "fuzzy_match",
        details: { distance, maxLength },
      };
    },
  object_exact_match: (_ctx, output: unknown, expected: unknown) => {
      assertObject(output, "output");
      assertObject(expected, "expected output");

      const pass = deepEqual(output, expected);
      return {
        score: pass ? 1 : 0,
        pass,
        label: "exact_match",
      };
    },
  object_fuzzy_match: (_ctx, output: unknown, expected: unknown) => {
      assertObject(output, "output");
      assertObject(expected, "expected output");

      const outputLeaves = new Map<string, unknown>();
      const expectedLeaves = new Map<string, unknown>();

      flattenLeaves(output, "", outputLeaves);
      flattenLeaves(expected, "", expectedLeaves);

      const allPaths = new Set([
        ...outputLeaves.keys(),
        ...expectedLeaves.keys(),
      ]);

      if (allPaths.size === 0) {
        return {
          score: 1,
          pass: true,
          label: "fuzzy_match",
          details: { matched: 0, total: 0 },
        };
      }

      let matched = 0;
      for (const path of allPaths) {
        if (!outputLeaves.has(path) || !expectedLeaves.has(path)) {
          continue;
        }

        if (Object.is(outputLeaves.get(path), expectedLeaves.get(path))) {
          matched += 1;
        }
      }

      const score = matched / allPaths.size;

      return {
        score,
        pass: score >= DEFAULT_OBJECT_FUZZY_THRESHOLD,
        label: "fuzzy_match",
        details: { matched, total: allPaths.size },
      };
  },
} satisfies Record<BuiltInScorerName, ScorerFn<any, unknown, unknown>>;
