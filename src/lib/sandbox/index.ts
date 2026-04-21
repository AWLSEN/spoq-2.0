import { localSandbox } from "./local";
import { orbSandbox } from "./orb";
import { Sandbox } from "./types";

export function getSandbox(): Sandbox {
  const driver = process.env.SANDBOX_DRIVER ?? "local";
  switch (driver) {
    case "local":
      return localSandbox;
    case "orb":
      return orbSandbox;
    default:
      return localSandbox;
  }
}

export type { Sandbox, SandboxEvent } from "./types";
