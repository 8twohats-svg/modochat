import { useEffect, useRef, useState } from "react";
import { chat, type Mode } from "./lib/api";
import { track } from "./lib/analytics";

type Bubble =
  | { id: string; kind: "user"; text: string; mode: Mode }
  | { id: string; kind: "ai"; text: string; mode: Mode; sourceMessage: string; cached: boolean };

const PLACEHOLDER_MO = "오늘 늦잠 잤어... 같은 거 던져보세요";
const PLACEHOLDER_DO = "주식으로 100만원 날렸어... 같은 거 던져보세요";

function App() {
  const [mode, setMode] = useState<Mode>("mo");
  const [input, setInput] = useState("");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    track.pageView();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, loading]);

  const handleModeChange = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    track.modeSelected(next);
  };

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    if (trimmed.length > 300) return;

    const userBubble: Bubble = {
      id: crypto.randomUUID(),
      kind: "user",
      text: trimmed,
      mode,
    };
    setBubbles((prev) => [...prev, userBubble]);
    setInput("");
    setLoading(true);
    track.messageSent(mode, trimmed.length);

    const res = await chat({ mode, message: trimmed });
    setLoading(false);

    if (!res.ok) {
      track.errorShown(res.kind);
      if (res.kind.startsWith("rate_")) {
        track.rateLimited(res.kind.replace("rate_", "") as "ip_hour" | "ip_day" | "global_day");
      }
      setBubbles((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          kind: "ai",
          text: res.message,
          mode,
          sourceMessage: trimmed,
          cached: false,
        },
      ]);
      return;
    }

    track.messageReceived(mode, res.cached);
    setBubbles((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        kind: "ai",
        text: res.reply,
        mode,
        sourceMessage: trimmed,
        cached: res.cached,
      },
    ]);
  };

  const regenerate = async (bubbleId: string, sourceMessage: string, bubbleMode: Mode) => {
    if (loading) return;
    track.regenerateClicked(bubbleMode);
    setLoading(true);

    const res = await chat({ mode: bubbleMode, message: sourceMessage, regenerate: true });
    setLoading(false);

    if (!res.ok) {
      track.errorShown(res.kind);
      if (res.kind.startsWith("rate_")) {
        track.rateLimited(res.kind.replace("rate_", "") as "ip_hour" | "ip_day" | "global_day");
      }
      setBubbles((prev) =>
        prev.map((b) =>
          b.id === bubbleId && b.kind === "ai"
            ? { ...b, text: res.message, cached: false }
            : b
        )
      );
      return;
    }

    track.messageReceived(bubbleMode, res.cached);
    setBubbles((prev) =>
      prev.map((b) =>
        b.id === bubbleId && b.kind === "ai"
          ? { ...b, text: res.reply, cached: res.cached }
          : b
      )
    );
  };

  const share = async (bubbleId: string, text: string, bubbleMode: Mode) => {
    track.shareClicked();
    const label = bubbleMode === "mo" ? "🟡 모 모드 (칭찬)" : "🔵 도 모드 (디스)";
    const shareText = `${label}\n\n"${text}"\n\n— 모도챗\nhttps://modochat.pages.dev`;
    try {
      await navigator.clipboard.writeText(shareText);
      track.shareCopied();
      setCopied(bubbleId);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  const isMo = mode === "mo";
  const placeholder = isMo ? PLACEHOLDER_MO : PLACEHOLDER_DO;
  const inputCount = input.length;
  const overLimit = inputCount > 300;
  const empty = bubbles.length === 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-4 pt-6 pb-3">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-mo-deep">모</span>
            <span className="text-ink-soft">도</span>
            <span className="text-do-deep">챗</span>
          </h1>
          <p className="text-xs text-ink-soft mt-1">
            모(최고) 아니면 도(최저) — 중간은 없어요
          </p>
        </div>
      </header>

      {/* Mode Toggle */}
      <div className="px-4 pb-3">
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-2 bg-white/60 backdrop-blur rounded-2xl p-1.5 shadow-lg border border-white/80">
            <button
              type="button"
              onClick={() => handleModeChange("mo")}
              className={`py-3 rounded-xl font-bold text-sm transition-all ${
                isMo
                  ? "bg-mo text-white shadow-md scale-[1.02]"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              🟡 모 — 무조건 칭찬
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("do")}
              className={`py-3 rounded-xl font-bold text-sm transition-all ${
                !isMo
                  ? "bg-do text-white shadow-md scale-[1.02]"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              🔵 도 — 무조건 디스
            </button>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {empty && (
            <div className="text-center py-12 animate-fade-in">
              <div className="text-7xl mb-4">{isMo ? "🤗" : "😈"}</div>
              <p className="text-ink-soft leading-relaxed">
                {isMo ? (
                  <>
                    무슨 말을 해도 <span className="font-bold text-mo-deep">무조건 칭찬</span>해드려요.
                    <br />
                    오늘 한 일 던져보세요.
                  </>
                ) : (
                  <>
                    무슨 말을 해도 <span className="font-bold text-do-deep">무조건 디스</span>해드려요.
                    <br />
                    인신공격은 안 하니까 안심하세요.
                  </>
                )}
              </p>
            </div>
          )}

          {bubbles.map((b) =>
            b.kind === "user" ? (
              <div key={b.id} className="flex justify-end animate-slide-right">
                <div
                  className={`max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm ${
                    b.mode === "mo" ? "bg-mo/15 text-ink" : "bg-do/15 text-ink"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{b.text}</p>
                </div>
              </div>
            ) : (
              <div key={b.id} className="flex flex-col items-start gap-1.5 animate-slide-left">
                <div
                  className={`max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 shadow-md ${
                    b.mode === "mo"
                      ? "bg-white border-2 border-mo/30"
                      : "bg-white border-2 border-do/30"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {b.text}
                  </p>
                </div>
                <div className="flex gap-1.5 ml-1">
                  <button
                    type="button"
                    onClick={() => regenerate(b.id, b.sourceMessage, b.mode)}
                    disabled={loading}
                    className="text-xs px-2.5 py-1 bg-white/70 hover:bg-white rounded-full text-ink-soft hover:text-ink transition-colors disabled:opacity-40 border border-ink-soft/15"
                  >
                    🎲 다시 답해줘
                  </button>
                  <button
                    type="button"
                    onClick={() => share(b.id, b.text, b.mode)}
                    className="text-xs px-2.5 py-1 bg-white/70 hover:bg-white rounded-full text-ink-soft hover:text-ink transition-colors border border-ink-soft/15"
                  >
                    {copied === b.id ? "✓ 복사됨" : "📋 공유"}
                  </button>
                </div>
              </div>
            )
          )}

          {loading && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-white border-2 border-ink-soft/15 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <p className="text-sm text-ink-soft animate-pulse-soft">
                  {isMo ? "칭찬을 짜고 있어요..." : "디스를 벼리고 있어요..."}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Input */}
      <div className="px-4 pb-3 pt-2 sticky bottom-0 bg-gradient-to-t from-cream/80 to-transparent backdrop-blur-sm">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={placeholder}
              rows={1}
              className={`flex-1 resize-none rounded-2xl px-4 py-3 bg-white shadow-sm border-2 outline-none transition-colors text-sm ${
                overLimit
                  ? "border-red-400"
                  : isMo
                  ? "border-mo/30 focus:border-mo"
                  : "border-do/30 focus:border-do"
              }`}
              maxLength={400}
            />
            <button
              type="button"
              onClick={send}
              disabled={!input.trim() || loading || overLimit}
              className={`shrink-0 px-5 py-3 rounded-2xl font-bold text-sm text-white shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 ${
                isMo ? "bg-mo-deep" : "bg-do-deep"
              }`}
            >
              보내기
            </button>
          </div>
          <div className="flex justify-between items-center mt-1.5 px-1">
            <p className="text-[11px] text-ink-soft">
              💡 AI가 농담조로 답해요 — 진지하게 받지 마세요
            </p>
            <p className={`text-[11px] ${overLimit ? "text-red-500 font-bold" : "text-ink-soft"}`}>
              {inputCount}/300
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-ink-soft/70 py-4 px-4 space-y-1.5">
        <div className="space-x-3">
          <a href="/privacy/" className="hover:text-ink transition-colors">
            개인정보처리방침
          </a>
          <span>·</span>
          <a href="/terms/" className="hover:text-ink transition-colors">
            이용약관
          </a>
        </div>
        <p>📖 모도챗 © 2026</p>
      </footer>
    </div>
  );
}

export default App;
