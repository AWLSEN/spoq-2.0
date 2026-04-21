import { Composio } from "@composio/core";

let cached: Composio | null = null;

export function getComposio(): Composio {
  if (cached) return cached;
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    throw new Error(
      "COMPOSIO_API_KEY not set — add it to .env to enable JIT capability connections"
    );
  }
  cached = new Composio({ apiKey });
  return cached;
}

export function hasComposioKey(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY);
}
