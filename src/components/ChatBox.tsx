"use client";

import { useState } from "react";

export default function ChatBox() {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || submitting) return;
    setSubmitting(true);
    // Phase 2 will wire this to /api/chat. For Phase 1 we just echo to prove the form works.
    await new Promise((r) => setTimeout(r, 300));
    window.location.href = `/chat?q=${encodeURIComponent(value)}`;
  }

  return (
    <form
      onSubmit={submit}
      className="w-full flex flex-col gap-3 rounded-3xl border border-[#e7e1d5] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-[#1a1a1a] transition-colors"
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="What do you need?"
        rows={3}
        className="w-full resize-none bg-transparent text-lg text-[#1a1a1a] placeholder-[#a39e93] outline-none"
        autoFocus
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!value.trim() || submitting}
          className="rounded-full bg-[#1a1a1a] px-5 py-2 text-sm font-medium text-white disabled:bg-[#cfc9bd] disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Starting…" : "Go"}
        </button>
      </div>
    </form>
  );
}
