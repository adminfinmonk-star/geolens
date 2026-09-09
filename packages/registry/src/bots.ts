export type BotType = "training" | "search" | "user_query" | "other";

export interface AiBot {
  vendor: string;
  /** Token matched against raw UA (case-insensitive). */
  userAgentToken: string;
  type: BotType;
}

/**
 * Appendix B subset — longest-token-first matching.
 * Categorization is best-effort from published vendor docs.
 */
export const AI_BOTS: AiBot[] = (
  [
  { vendor: "OpenAI", userAgentToken: "OAI-SearchBot", type: "search" },
  { vendor: "OpenAI", userAgentToken: "ChatGPT-User", type: "user_query" },
  { vendor: "OpenAI", userAgentToken: "GPTBot", type: "training" },
  { vendor: "Anthropic", userAgentToken: "Claude-SearchBot", type: "search" },
  { vendor: "Anthropic", userAgentToken: "Claude-User", type: "user_query" },
  { vendor: "Anthropic", userAgentToken: "Claude-Web", type: "search" },
  { vendor: "Anthropic", userAgentToken: "anthropic-ai", type: "training" },
  { vendor: "Anthropic", userAgentToken: "ClaudeBot", type: "training" },
  { vendor: "Google", userAgentToken: "Google-NotebookLM", type: "user_query" },
  { vendor: "Google", userAgentToken: "Google-CloudVertexBot", type: "training" },
  { vendor: "Google", userAgentToken: "Google-Extended", type: "training" },
  { vendor: "Google", userAgentToken: "GoogleOther", type: "other" },
  { vendor: "Google", userAgentToken: "Googlebot", type: "search" },
  { vendor: "Perplexity", userAgentToken: "Perplexity-User", type: "user_query" },
  { vendor: "Perplexity", userAgentToken: "PerplexityBot", type: "search" },
  { vendor: "Microsoft", userAgentToken: "BingPreview", type: "other" },
  { vendor: "Microsoft", userAgentToken: "bingbot", type: "search" },
  { vendor: "Microsoft", userAgentToken: "msnbot", type: "search" },
  { vendor: "Meta", userAgentToken: "meta-externalfetcher", type: "user_query" },
  { vendor: "Meta", userAgentToken: "meta-externalagent", type: "training" },
  { vendor: "Meta", userAgentToken: "FacebookBot", type: "other" },
  { vendor: "Apple", userAgentToken: "Applebot-Extended", type: "training" },
  { vendor: "Apple", userAgentToken: "Applebot", type: "search" },
  { vendor: "Amazon", userAgentToken: "Amazonbot", type: "search" },
  { vendor: "ByteDance", userAgentToken: "Bytespider", type: "training" },
  { vendor: "Common Crawl", userAgentToken: "CCBot", type: "training" },
  { vendor: "Cohere", userAgentToken: "cohere-training-data-crawler", type: "training" },
  { vendor: "Cohere", userAgentToken: "cohere-ai", type: "training" },
  { vendor: "Mistral", userAgentToken: "MistralAI-User", type: "user_query" },
  { vendor: "xAI", userAgentToken: "xAI-Bot", type: "training" },
  { vendor: "You.com", userAgentToken: "YouBot", type: "search" },
  { vendor: "Diffbot", userAgentToken: "Diffbot", type: "training" },
  { vendor: "Allen Institute", userAgentToken: "Ai2Bot-Dolma", type: "training" },
  { vendor: "Allen Institute", userAgentToken: "AI2Bot", type: "training" },
  { vendor: "Firecrawl", userAgentToken: "FirecrawlAgent", type: "user_query" },
  { vendor: "Phind", userAgentToken: "PhindBot", type: "search" },
  { vendor: "Liner", userAgentToken: "LinerBot", type: "search" },
] as const satisfies readonly AiBot[]
).slice().sort((a, b) => b.userAgentToken.length - a.userAgentToken.length);

/** Longest matching token wins. */
export function matchBot(userAgent: string): AiBot | null {
  const ua = userAgent.toLowerCase();
  for (const bot of AI_BOTS) {
    if (ua.includes(bot.userAgentToken.toLowerCase())) return bot;
  }
  return null;
}

export function listSearchBots(): AiBot[] {
  return AI_BOTS.filter((b) => b.type === "search");
}
