const DEFAULT_BASE_URL = "https://api.orbcloud.dev";

export class OrbApiError extends Error {
  constructor(public status: number, public body: string, msg: string) {
    super(msg);
    this.name = "OrbApiError";
  }
}

interface ComputerRecord {
  id: string;
  name: string;
  status?: string;
  url?: string;
  public_url?: string;
  short_id?: string;
  runtime_mb?: number;
  disk_mb?: number;
  [k: string]: unknown;
}

export class OrbClient {
  private baseUrl: string;
  private token: string;

  constructor(token: string, baseUrl: string = DEFAULT_BASE_URL) {
    this.token = token;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request(
    method: string,
    path: string,
    init?: { body?: unknown; contentType?: string }
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
    };
    let body: string | undefined;
    if (init?.body !== undefined) {
      if (init.contentType === "application/toml") {
        headers["content-type"] = "application/toml";
        body = typeof init.body === "string" ? init.body : String(init.body);
      } else {
        headers["content-type"] = "application/json";
        body = JSON.stringify(init.body);
      }
    }
    const res = await fetch(`${this.baseUrl}${path}`, { method, headers, body });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new OrbApiError(
        res.status,
        text,
        `orb ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`
      );
    }
    return res;
  }

  async listComputers(): Promise<ComputerRecord[]> {
    const res = await this.request("GET", "/v1/computers");
    const data = (await res.json()) as unknown;
    if (Array.isArray(data)) return data as ComputerRecord[];
    if (data && typeof data === "object" && Array.isArray((data as { computers?: unknown[] }).computers)) {
      return (data as { computers: ComputerRecord[] }).computers;
    }
    return [];
  }

  async createComputer(params: {
    name: string;
    runtime_mb?: number;
    disk_mb?: number;
    user_id?: string;
  }): Promise<ComputerRecord> {
    const res = await this.request("POST", "/v1/computers", {
      body: {
        name: params.name,
        user_id: params.user_id ?? "spoq",
        runtime_mb: params.runtime_mb ?? 2048,
        disk_mb: params.disk_mb ?? 8192,
      },
    });
    return (await res.json()) as ComputerRecord;
  }

  async getComputer(computerId: string): Promise<ComputerRecord> {
    const res = await this.request("GET", `/v1/computers/${computerId}`);
    return (await res.json()) as ComputerRecord;
  }

  async uploadConfig(computerId: string, tomlContent: string): Promise<unknown> {
    const res = await this.request("POST", `/v1/computers/${computerId}/config`, {
      body: tomlContent,
      contentType: "application/toml",
    });
    return res.json();
  }

  async buildComputer(
    computerId: string,
    orgSecrets?: Record<string, string>
  ): Promise<unknown> {
    const res = await this.request("POST", `/v1/computers/${computerId}/build`, {
      body: orgSecrets ? { org_secrets: orgSecrets } : {},
    });
    return res.json();
  }

  async deployAgent(
    computerId: string,
    task: string,
    count: number = 1,
    orgSecrets?: Record<string, string>
  ): Promise<unknown> {
    const body: Record<string, unknown> = { task, count };
    if (orgSecrets) body.org_secrets = orgSecrets;
    const res = await this.request("POST", `/v1/computers/${computerId}/agents`, {
      body,
    });
    return res.json();
  }
}

export function hasOrbKey(): boolean {
  return Boolean(process.env.ORB_API_TOKEN || process.env.ORB_SESSION_TOKEN);
}

export function getOrbClient(): OrbClient {
  const token = process.env.ORB_SESSION_TOKEN || process.env.ORB_API_TOKEN;
  if (!token) {
    throw new Error(
      "ORB_SESSION_TOKEN (or ORB_API_TOKEN) not set — run `orb login --email <you> --base-url https://api.orbcloud.dev` and paste ~/.orb/credentials.token into .env"
    );
  }
  const baseUrl = process.env.ORB_BASE_URL || DEFAULT_BASE_URL;
  return new OrbClient(token, baseUrl);
}
