import { BrandMetricsRowSchema, ReportRequestSchema } from "./index.js";

/** Generated OpenAPI 3.0 document from contracts (never hand-maintained long-term). */
export function buildOpenApiDocument(opts?: { serverUrl?: string }) {
  return {
    openapi: "3.0.3",
    info: {
      title: "GeoLens Customer API",
      version: "1.0.0",
      description: [
        "Public REST API for brand visibility analytics.",
        "",
        "### Aggregation formulas",
        "- visibility = visibility_count / visibility_total",
        "- share_of_voice = brand_mentions / all_brand_mentions",
        "- position = mean position among chats where brand appears",
        "",
        "### filters vs having",
        "filters shrink the chat set before aggregation; having filters metric rows after.",
        "",
        "### Pitfalls",
        "1. Empty/error chats must not depress visibility denominators.",
        "2. SoV collapses when the brand set changes — compare like-for-like windows.",
      ].join("\n"),
    },
    servers: [{ url: opts?.serverUrl ?? "http://127.0.0.1:3001" }],
    paths: {
      "/customer/v1/reports/brands": {
        post: {
          summary: "Brand metrics report (§8.1)",
          description:
            "Same numbers as dashboard Overview and MCP reports.brands.",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: zodToJsonSchemaRough(ReportRequestSchema),
              },
            },
          },
          responses: {
            "200": {
              description: "Brand metric rows",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: zodToJsonSchemaRough(BrandMetricsRowSchema),
                      },
                      total_count: { type: "integer" },
                      meta: { type: "object" },
                    },
                  },
                },
              },
            },
            "401": { description: "Invalid API Key" },
            "429": { description: "Rate limited" },
          },
        },
      },
      "/customer/v1/bi/brands": {
        get: {
          summary: "BI connector flat brands feed",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            {
              name: "project_id",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Flat connector rows" },
          },
        },
      },
      "/openapi.json": {
        get: {
          summary: "This OpenAPI document",
          responses: { "200": { description: "OpenAPI 3.0 JSON" } },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
        },
      },
    },
  };
}

/** Minimal zod → JSON Schema for OpenAPI generation without extra deps. */
function zodToJsonSchemaRough(schema: {
  shape?: Record<string, unknown>;
  _def?: { typeName?: string };
}): Record<string, unknown> {
  const shape = (schema as { shape?: Record<string, { _def?: { typeName?: string } }> })
    .shape;
  if (!shape) return { type: "object" };
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, val] of Object.entries(shape)) {
    const t = val?._def?.typeName ?? "";
    if (t.includes("ZodNumber")) properties[key] = { type: "number" };
    else if (t.includes("ZodBoolean")) properties[key] = { type: "boolean" };
    else if (t.includes("ZodArray")) properties[key] = { type: "array", items: {} };
    else if (t.includes("ZodNullable"))
      properties[key] = { type: ["number", "null"] };
    else properties[key] = { type: "string" };
    if (!t.includes("ZodOptional") && !t.includes("ZodDefault")) {
      required.push(key);
    }
  }
  return {
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
  };
}
