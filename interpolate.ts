export type InterpolateValues = Record<string, string>;

const ESCAPED_OPEN = "__ESCAPED_DOUBLE_CURLY__";

export const interpolate = (
  template: string,
  values: InterpolateValues,
): string => {
  if (!template.includes("{{")) {
    return template;
  }

  const escaped = template.replace(/\\\{\{/g, ESCAPED_OPEN);
  const interpolated = escaped.replace(
    /\{\{([a-zA-Z0-9_.-]+)\}\}/g,
    (match, key) => {
      if (!Object.hasOwn(values, key)) {
        return match;
      }

      const value = values[key];
      return value === undefined ? match : value;
    },
  );

  return interpolated.split(ESCAPED_OPEN).join("{{");
};
