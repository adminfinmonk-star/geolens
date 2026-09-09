"use client";

import { apiBase } from "@/lib/api";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const API = apiBase();

export type OnboardingProject = {
  id: string;
  name: string;
  domain?: string;
  location?: string;
  language: string;
  timezone: string;
  default_country: string;
  status: string;
};

export type OnboardingProfile = {
  domain: string;
  name: string;
  industry: string;
  tagline: string;
  description: string;
  identityTags: string[];
  targetMarkets: string[];
  products: string[];
  personas: string[];
  reviewed: boolean;
};

export type TopicSug = { name: string; reason: string };
export type PromptSug = {
  text: string;
  country_code: string;
  topic: string;
  branding: string;
  intent_type: string;
  persona: string;
  volume_score: number;
};

type Ctx = {
  loading: boolean;
  error: string | null;
  projectId: string | null;
  project: OnboardingProject | null;
  profile: OnboardingProfile | null;
  topics: string[];
  topicMeta: TopicSug[];
  prompts: PromptSug[];
  selectedPrompts: Set<string>;
  countries: string;
  setTopics: (t: string[]) => void;
  setSelectedPrompts: (s: Set<string>) => void;
  setCountries: (c: string) => void;
  setPrompts: (p: PromptSug[]) => void;
  setTopicMeta: (t: TopicSug[]) => void;
  refresh: () => Promise<void>;
  saveProject: (patch: Partial<OnboardingProject>) => Promise<OnboardingProject>;
  saveProfile: (patch: Partial<OnboardingProfile>) => Promise<OnboardingProfile>;
  generateDiscovery: (opts?: {
    topics?: string[];
  }) => Promise<{ topics: TopicSug[]; prompts: PromptSug[] }>;
  activateSelected: () => Promise<number>;
};

const OnboardingContext = createContext<Ctx | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding outside provider");
  return ctx;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<OnboardingProject | null>(null);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [topicMeta, setTopicMeta] = useState<TopicSug[]>([]);
  const [prompts, setPrompts] = useState<PromptSug[]>([]);
  const [selectedPrompts, setSelectedPrompts] = useState<Set<string>>(new Set());
  const [countries, setCountries] = useState("US,GB");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const me = await fetch(`${API}/v1/auth/me`, { credentials: "include" });
      if (me.status === 401) {
        setError("Please sign in to continue onboarding.");
        setLoading(false);
        return;
      }
      const meData = (await me.json()) as {
        projects: Array<{ id: string; name: string; status?: string }>;
      };
      const onboard =
        meData.projects.find((p) => p.status === "ONBOARDING") ??
        meData.projects[0];
      if (!onboard) {
        setError("No project found. Create an account first.");
        setLoading(false);
        return;
      }
      setProjectId(onboard.id);
      const [projRes, profRes] = await Promise.all([
        fetch(`${API}/v1/projects/${onboard.id}`, { credentials: "include" }),
        fetch(`${API}/v1/projects/${onboard.id}/brand-profile`, {
          credentials: "include",
        }),
      ]);
      if (!projRes.ok || !profRes.ok) {
        setError("Failed to load project");
        setLoading(false);
        return;
      }
      const projData = (await projRes.json()) as { project: OnboardingProject };
      const profData = (await profRes.json()) as { profile: OnboardingProfile };
      setProject(projData.project);
      setProfile({
        ...profData.profile,
        description: profData.profile.description ?? "",
        identityTags: profData.profile.identityTags ?? [],
        targetMarkets: profData.profile.targetMarkets ?? [],
      });
      if (projData.project.default_country) {
        setCountries(
          [projData.project.default_country, "GB"]
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(","),
        );
      }
    } catch {
      setError(`API unreachable at ${API}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveProject = useCallback(
    async (patch: Partial<OnboardingProject>) => {
      if (!projectId) throw new Error("no_project");
      const res = await fetch(`${API}/v1/projects/${projectId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { project: OnboardingProject; error?: string };
      if (!res.ok) throw new Error(data.error ?? "save_failed");
      setProject(data.project);
      return data.project;
    },
    [projectId],
  );

  const saveProfile = useCallback(
    async (patch: Partial<OnboardingProfile>) => {
      if (!projectId) throw new Error("no_project");
      const res = await fetch(`${API}/v1/projects/${projectId}/brand-profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { profile: OnboardingProfile; error?: string };
      if (!res.ok) throw new Error(data.error ?? "save_failed");
      setProfile(data.profile);
      return data.profile;
    },
    [projectId],
  );

  const generateDiscovery = useCallback(
    async (opts?: { topics?: string[] }) => {
      if (!projectId) throw new Error("no_project");
      const res = await fetch(
        `${API}/v1/projects/${projectId}/discovery/generate`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            countries: countries
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean),
            topics: opts?.topics,
            branded_share: 0.2,
          }),
        },
      );
      const data = (await res.json()) as {
        topics: TopicSug[];
        prompts: PromptSug[];
      };
      if (!res.ok) throw new Error("generate_failed");
      setTopicMeta(data.topics);
      if (!opts?.topics) {
        setTopics(data.topics.map((t) => t.name));
      }
      setPrompts(data.prompts);
      return data;
    },
    [projectId, countries],
  );

  const activateSelected = useCallback(async () => {
    if (!projectId) throw new Error("no_project");
    const chosen = prompts.filter((p) => selectedPrompts.has(p.text));
    const res = await fetch(
      `${API}/v1/projects/${projectId}/discovery/activate`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts: chosen }),
      },
    );
    const data = (await res.json()) as { count: number };
    if (!res.ok) throw new Error("activate_failed");
    return data.count;
  }, [projectId, prompts, selectedPrompts]);

  const value = useMemo(
    () => ({
      loading,
      error,
      projectId,
      project,
      profile,
      topics,
      topicMeta,
      prompts,
      selectedPrompts,
      countries,
      setTopics,
      setSelectedPrompts,
      setCountries,
      setPrompts,
      setTopicMeta,
      refresh,
      saveProject,
      saveProfile,
      generateDiscovery,
      activateSelected,
    }),
    [
      loading,
      error,
      projectId,
      project,
      profile,
      topics,
      topicMeta,
      prompts,
      selectedPrompts,
      countries,
      refresh,
      saveProject,
      saveProfile,
      generateDiscovery,
      activateSelected,
    ],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}
