export interface AssistantHost {
  platform: string;
  hostSuffix: string;
  displayName: string;
}

/** Appendix C — AI assistant referral registry (hostname suffix). */
export const ASSISTANT_HOSTS: AssistantHost[] = [
  { platform: "OpenAI", hostSuffix: "chatgpt.com", displayName: "ChatGPT" },
  { platform: "OpenAI", hostSuffix: "chat.openai.com", displayName: "ChatGPT" },
  { platform: "OpenAI", hostSuffix: "openai.com", displayName: "OpenAI" },
  { platform: "Google", hostSuffix: "gemini.google.com", displayName: "Gemini" },
  { platform: "Google", hostSuffix: "bard.google.com", displayName: "Bard" },
  { platform: "Google", hostSuffix: "aistudio.google.com", displayName: "AI Studio" },
  { platform: "Google", hostSuffix: "notebooklm.google.com", displayName: "NotebookLM" },
  { platform: "Microsoft", hostSuffix: "copilot.microsoft.com", displayName: "Copilot" },
  { platform: "Microsoft", hostSuffix: "edgeservices.bing.com", displayName: "Bing Copilot" },
  { platform: "Perplexity", hostSuffix: "perplexity.ai", displayName: "Perplexity" },
  { platform: "Anthropic", hostSuffix: "claude.ai", displayName: "Claude" },
  { platform: "Meta", hostSuffix: "meta.ai", displayName: "Meta AI" },
  { platform: "xAI", hostSuffix: "grok.com", displayName: "Grok" },
  { platform: "xAI", hostSuffix: "x.ai", displayName: "xAI" },
  { platform: "Mistral", hostSuffix: "chat.mistral.ai", displayName: "Le Chat" },
  { platform: "DeepSeek", hostSuffix: "chat.deepseek.com", displayName: "DeepSeek" },
  { platform: "Other", hostSuffix: "poe.com", displayName: "Poe" },
  { platform: "Other", hostSuffix: "you.com", displayName: "You.com" },
  { platform: "Other", hostSuffix: "phind.com", displayName: "Phind" },
];

const UTM_ASSISTANTS: Record<string, { platform: string; displayName: string }> = {
  chatgpt: { platform: "OpenAI", displayName: "ChatGPT" },
  perplexity: { platform: "Perplexity", displayName: "Perplexity" },
  copilot: { platform: "Microsoft", displayName: "Copilot" },
  gemini: { platform: "Google", displayName: "Gemini" },
  claude: { platform: "Anthropic", displayName: "Claude" },
};

export function classifyAssistantReferral(input: {
  source?: string;
  medium?: string;
  referrerHost?: string;
  utmSource?: string;
}): { isAiAssistant: boolean; platform?: string; displayName?: string; method?: string } {
  const utm = (input.utmSource ?? "").toLowerCase();
  if (utm && UTM_ASSISTANTS[utm]) {
    return {
      isAiAssistant: true,
      ...UTM_ASSISTANTS[utm],
      method: "utm_source",
    };
  }
  const host = (input.referrerHost ?? input.source ?? "").toLowerCase().replace(/^www\./, "");
  if (host) {
    const hit = ASSISTANT_HOSTS.find((h) => host === h.hostSuffix || host.endsWith(`.${h.hostSuffix}`));
    if (hit) {
      return {
        isAiAssistant: true,
        platform: hit.platform,
        displayName: hit.displayName,
        method: "referrer",
      };
    }
  }
  // GA4 native AI channel grouping (simplified)
  if ((input.medium ?? "").toLowerCase() === "ai" || (input.source ?? "").trim().toLowerCase() === "ai assistants") {
    return {
      isAiAssistant: true,
      platform: "GA4",
      displayName: "AI Assistants (GA4)",
      method: "ga4_channel",
    };
  }
  return { isAiAssistant: false };
}
