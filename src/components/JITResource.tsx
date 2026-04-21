"use client";

import { CapabilityRequest } from "@/lib/capabilities/types";

interface Props {
  request: CapabilityRequest;
  onConnect: () => void;
  onSkip: () => void;
  busy?: boolean;
}

function prettifyToolkit(slug: string): string {
  return slug
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function JITResource({ request, onConnect, onSkip, busy }: Props) {
  const label = prettifyToolkit(request.kind);
  return (
    <div className="self-stretch rounded-2xl border border-[#e7e1d5] bg-[#fffaf0] p-4 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium text-[#1a1a1a]">
          Can I use your {label}?
        </div>
        <div className="text-sm text-[#6b645a] leading-snug">{request.reason}</div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onConnect}
          disabled={busy}
          className="rounded-full bg-[#1a1a1a] px-4 py-1.5 text-sm text-white disabled:bg-[#cfc9bd] transition-colors"
        >
          {busy ? "Connecting…" : `Connect ${label}`}
        </button>
        <button
          onClick={onSkip}
          disabled={busy}
          className="rounded-full border border-[#e7e1d5] bg-white px-4 py-1.5 text-sm text-[#1a1a1a] disabled:opacity-50 transition-colors hover:border-[#1a1a1a]"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
