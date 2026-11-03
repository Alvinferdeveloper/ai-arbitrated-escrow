// In-memory sliding window per key. Each serverless instance keeps its own
// counts, so this only slows casual abuse; it is not a hard quota.

const hits = new Map<string, number[]>();

export function allowRequest(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
