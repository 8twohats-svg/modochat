declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

function fire(eventName: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...params });
}

export const track = {
  pageView: () => fire("page_view"),
  modeSelected: (mode: "mo" | "do") => fire("mode_selected", { mode }),
  messageSent: (mode: "mo" | "do", length: number) =>
    fire("message_sent", { mode, length }),
  messageReceived: (mode: "mo" | "do", cached: boolean) =>
    fire("message_received", { mode, cached }),
  regenerateClicked: (mode: "mo" | "do") =>
    fire("regenerate_clicked", { mode }),
  shareClicked: () => fire("share_clicked"),
  shareCopied: () => fire("share_copied"),
  rateLimited: (type: "ip_hour" | "ip_day" | "global_day") =>
    fire("rate_limited", { type }),
  errorShown: (kind: string) => fire("error_shown", { kind }),
};
