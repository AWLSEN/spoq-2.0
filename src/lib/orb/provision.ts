import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getOrbClient, OrbApiError } from "./client";

const COMPUTER_NAME = process.env.ORB_COMPUTER_NAME ?? "spoq-dev-sam";

interface Provisioned {
  id: string;
  url: string;
}

let cached: Provisioned | null = null;

/**
 * Dev-mode: get-or-create the single Orb computer Sam uses for all chat.
 * Caches the result in-process. If ORB_COMPUTER_ID + ORB_COMPUTER_URL are
 * set in .env we trust them and skip the API roundtrip.
 */
export async function getDevComputer(): Promise<Provisioned> {
  if (cached) return cached;

  const idFromEnv = process.env.ORB_COMPUTER_ID;
  const urlFromEnv = process.env.ORB_COMPUTER_URL;
  if (idFromEnv && urlFromEnv) {
    cached = { id: idFromEnv, url: urlFromEnv.replace(/\/$/, "") };
    return cached;
  }

  const client = getOrbClient();

  const existing = await client.listComputers().catch((err) => {
    if (err instanceof OrbApiError && err.status === 401) {
      throw new Error(
        "Orb 401 on listComputers — the token in ORB_SESSION_TOKEN is stale. Re-run `orb login`."
      );
    }
    throw err;
  });

  let record = existing.find((c) => c.name === COMPUTER_NAME);

  if (!record) {
    record = await client.createComputer({
      name: COMPUTER_NAME,
      runtime_mb: 2048,
      disk_mb: 8192,
      user_id: "spoq-dev",
    });
    const tomlPath = join(process.cwd(), "agent-wrapper", "orb.toml");
    if (existsSync(tomlPath)) {
      const toml = readFileSync(tomlPath, "utf8");
      await client.uploadConfig(record.id, toml);
    }
  }

  const url = pickUrl(record);
  if (!url) {
    throw new Error(
      `Orb computer ${record.id} (${record.name}) has no public url yet — run \`orb build ${record.id}\` then retry.`
    );
  }

  cached = { id: record.id, url: url.replace(/\/$/, "") };
  return cached;
}

function pickUrl(c: { url?: string; public_url?: string; short_id?: string }): string | null {
  if (c.url) return c.url;
  if (c.public_url) return c.public_url;
  if (c.short_id) return `https://${c.short_id}.orbcloud.dev`;
  return null;
}
