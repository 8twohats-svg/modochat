export type Mode = "mo" | "do";

export type ChatResponse =
  | { ok: true; reply: string; cached: boolean }
  | { ok: false; kind: "rate_ip_hour" | "rate_ip_day" | "rate_global_day" | "too_long" | "blocked" | "server"; message: string };

export async function chat(args: {
  mode: Mode;
  message: string;
  regenerate?: boolean;
}): Promise<ChatResponse> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(args),
    });
    const data = (await res.json()) as ChatResponse;
    return data;
  } catch {
    return {
      ok: false,
      kind: "server",
      message: "응답을 못 받았어요. 잠시 후 다시 시도해주세요.",
    };
  }
}
