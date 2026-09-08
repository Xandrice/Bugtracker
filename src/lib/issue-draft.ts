export function mergeIssueTemplate<T extends Record<string, string>>(
  draft: T, template: Partial<T>, dirty: ReadonlySet<string>, replace = false,
): T {
  const next = { ...draft };
  for (const key of Object.keys(template) as Array<keyof T>) {
    if (replace || !dirty.has(String(key))) next[key] = template[key] as T[keyof T];
  }
  return next;
}
