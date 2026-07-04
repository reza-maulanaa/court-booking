export function pgErrorCode(e: unknown): string | undefined {
  if (!e || typeof e !== "object") return undefined;
  if ("code" in e && typeof e.code === "string") return e.code;
  if ("cause" in e) return pgErrorCode((e as { cause?: unknown }).cause);
  return undefined;
}
