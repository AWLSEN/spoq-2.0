import ChatBox from "@/components/ChatBox";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl flex flex-col items-center gap-10">
        <header className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-serif text-5xl sm:text-6xl text-[#1a1a1a] leading-tight">
            Tell it what you need.
          </h1>
          <p className="text-lg text-[#6b645a] font-light">
            It gets it done.
          </p>
        </header>

        <ChatBox />

        <ul className="flex flex-wrap justify-center gap-2 text-sm text-[#6b645a]">
          {[
            "Plan a weekend in Goa",
            "Help me write a thank-you email",
            "Find me a dal tadka recipe",
            "Compare electricity plans",
          ].map((s) => (
            <li
              key={s}
              className="rounded-full border border-[#e7e1d5] bg-white px-4 py-2 hover:border-[#1a1a1a] transition-colors cursor-pointer"
            >
              {s}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
