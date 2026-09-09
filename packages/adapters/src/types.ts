export interface EngineRequest {
  prompt: string;
  countryCode: string;
  language?: string;
  channelId: string;
  modelId: string;
  runDate: string;
  seed?: string;
}

export interface RawSource {
  url: string;
  title?: string;
  cited: boolean;
  citationCount: number;
  citationPosition?: number;
  retrievalRank: number;
}

export interface RawAd {
  advertiserName: string;
  adUnitType: string;
  adsRequestId?: string;
  targetUrl: string;
  cards: {
    title: string;
    body?: string;
    imageUrl?: string;
    targetUrl: string;
  }[];
}

export interface RawProduct {
  name: string;
  brand?: string;
  merchant?: string;
  position: number;
  price?: { amount: number; currency: string };
  rating?: number;
  attributes?: Record<string, string | number | boolean>;
  queries?: string[];
}

export type Feature =
  | { type: "web_search" }
  | { type: "shopping" }
  | { type: "maps" }
  | { type: string; [key: string]: unknown };

export interface EngineResponse {
  status: "ok" | "empty" | "error" | "blocked";
  errorCode?: string;
  text: string;
  sources: RawSource[];
  fanouts: { text: string; type: "search" | "shopping" | "synthetic" }[];
  ads: RawAd[];
  products: RawProduct[];
  maps: { name: string; url?: string }[];
  features: Feature[];
  raw: unknown;
  meta: {
    modelReported?: string;
    latencyMs: number;
    surfaceKind: "ui" | "api" | "simulator";
  };
}

export interface EngineAdapter {
  readonly channelId: string;
  readonly surfaceKind: "ui" | "api" | "simulator";
  readonly capabilities: {
    fanouts: boolean;
    ads: boolean;
    shopping: boolean;
    maps: boolean;
    geo: "full" | "partial" | "none";
    citationsDistinctFromSources: boolean;
  };
  run(req: EngineRequest): Promise<EngineResponse>;
  health(): Promise<{ ok: boolean; detail?: string }>;
}
