import type { ScoreResult } from "../types.js";

export type ScoredItem = {
  score?: ScoreResult | null;
};

export type PassRateOptions = {
  threshold?: number;
  includeMissing?: boolean;
};

export type ScoreSummary = {
  total: number;
  scored: number;
  averageScore: number | null;
  medianScore: number | null;
  passRate: number | null;
};

const collectScores = <T extends ScoredItem>(items: readonly T[]): number[] => {
  const scores: number[] = [];

  for (const item of items) {
    if (!item.score) {
      continue;
    }

    scores.push(item.score.score);
  }

  return scores;
};

export const meanScore = <T extends ScoredItem>(
  items: readonly T[],
): number | null => {
  const scores = collectScores(items);
  if (scores.length === 0) {
    return null;
  }

  const total = scores.reduce((sum, value) => sum + value, 0);
  return total / scores.length;
};

export const medianScore = <T extends ScoredItem>(
  items: readonly T[],
): number | null => {
  const scores = collectScores(items);
  if (scores.length === 0) {
    return null;
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    const lower = sorted[mid - 1];
    const upper = sorted[mid];

    if (lower === undefined || upper === undefined) {
      return null;
    }

    return (lower + upper) / 2;
  }

  const value = sorted[mid];
  return value === undefined ? null : value;
};

export const passRate = <T extends ScoredItem>(
  items: readonly T[],
  options: PassRateOptions = {},
): number | null => {
  const { threshold, includeMissing = false } = options;

  let passCount = 0;
  let total = 0;

  for (const item of items) {
    if (!item.score) {
      if (includeMissing) {
        total += 1;
      }
      continue;
    }

    if (typeof item.score.pass === "boolean") {
      total += 1;
      if (item.score.pass) {
        passCount += 1;
      }
      continue;
    }

    if (typeof threshold === "number") {
      total += 1;
      if (item.score.score >= threshold) {
        passCount += 1;
      }
      continue;
    }
  }

  if (total === 0) {
    return null;
  }

  return passCount / total;
};

export const summarizeScores = <T extends ScoredItem>(
  items: readonly T[],
  options: PassRateOptions = {},
): ScoreSummary => {
  const scores = collectScores(items);

  return {
    total: items.length,
    scored: scores.length,
    averageScore: meanScore(items),
    medianScore: medianScore(items),
    passRate: passRate(items, options),
  };
};
