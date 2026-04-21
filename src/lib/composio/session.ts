import { getComposio, hasComposioKey } from "./client";
import { toolkitFor } from "./toolkits";
import { CapabilityKind, CapabilityState } from "@/lib/capabilities/types";
import { HttpMcpServer } from "@/lib/sandbox/types";

/**
 * Given the client's capability state, build an MCP server spec the
 * sandbox can pass to claude-code. We only include toolkits whose
 * capability is marked connected AND whose composio auth is actually
 * ACTIVE for this user_id — client state is optimistic, Composio is
 * the source of truth.
 */
export async function buildMcpServersForUser(
  userId: string,
  caps: CapabilityState
): Promise<HttpMcpServer[]> {
  if (!hasComposioKey() || !userId) return [];

  const wantedToolkits: string[] = [];
  for (const [k, status] of Object.entries(caps)) {
    if (status.state !== "connected") continue;
    const slug = toolkitFor(k as CapabilityKind);
    if (slug && !wantedToolkits.includes(slug)) wantedToolkits.push(slug);
  }
  if (wantedToolkits.length === 0) return [];

  try {
    const composio = getComposio();
    const session = await composio.create(userId, {
      toolkits: wantedToolkits,
      manageConnections: true,
    });
    const info = session.mcp;
    if (!info?.url) return [];
    return [
      {
        name: "composio",
        url: info.url,
        headers: info.headers ?? {},
      },
    ];
  } catch (err) {
    console.warn("[composio] session create failed:", err);
    return [];
  }
}
