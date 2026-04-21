import { Suspense } from "react";
import ChatSession from "@/components/ChatSession";

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-10 text-[#6b645a]">Loading…</div>}>
      <ChatSession />
    </Suspense>
  );
}
