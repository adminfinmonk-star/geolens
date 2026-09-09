import { z } from "zod";

export const OperatorSchema = z.enum([
  "in",
  "not_in",
  "has_all",
  "gt",
  "gte",
  "lt",
  "lte",
]);

export const PredicateSchema = z.object({
  field: z.string(),
  operator: OperatorSchema,
  values: z.array(z.union([z.string(), z.number()])),
});

export const ReportRequestSchema = z.object({
  project_id: z.string().optional(),
  date_from: z.string(),
  date_to: z.string(),
  dimensions: z.array(z.string()).default([]),
  filters: z.array(PredicateSchema).default([]),
  having: z.array(PredicateSchema).default([]),
  brand_ids: z.array(z.string()).optional(),
});

export type ReportRequest = z.infer<typeof ReportRequestSchema>;
export type Predicate = z.infer<typeof PredicateSchema>;

export const BrandMetricsRowSchema = z.object({
  brand_id: z.string(),
  brand_name: z.string(),
  visibility: z.number(),
  share_of_voice: z.number(),
  position: z.number().nullable(),
  sentiment: z.number().nullable(),
  mention_count: z.number(),
  visibility_count: z.number(),
  visibility_total: z.number(),
});

export type BrandMetricsRow = z.infer<typeof BrandMetricsRowSchema>;

export const ProjectStatusSchema = z.enum([
  "ONBOARDING",
  "TRIAL",
  "TRIAL_ENDED",
  "CUSTOMER",
  "CUSTOMER_ENDED",
  "PITCH",
  "PITCH_ENDED",
  "PAUSED",
  "API_PARTNER",
  "DELETED",
]);

export const CreateProjectSchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional(),
  default_country: z.string().length(2).default("US"),
  timezone: z.string().default("UTC"),
});

export type CreateProject = z.infer<typeof CreateProjectSchema>;

export * from "./openapi.js";
