import { Suspense } from "react";
import ChatSession from "@/components/ChatSession";

export default function Home() {
  return (
    <Suspense fallback={<div className="p-10 text-[#6b645a]">one moment…</div>}>
      <ChatSession />
    </Suspense>
  );
}
