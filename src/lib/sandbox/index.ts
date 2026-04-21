import { localSandbox } from "./local";
import { Sandbox } from "./types";

export function getSandbox(): Sandbox {
  const driver = process.env.SANDBOX_DRIVER ?? "local";
  switch (driver) {
    case "local":
      return localSandbox;
    // case "orb":
    //   return orbSandbox; // TODO: wire once Orb auth is sorted
    default:
      return localSandbox;
  }
}

export type { Sandbox, SandboxEvent } from "./types";
