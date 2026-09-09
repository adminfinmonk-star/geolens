import { createHmac, timingSafeEqual } from "node:crypto";

export type StripeCheckoutInput = {
  plan_code: string;
  amount_cents: number;
  currency: string;
  success_url: string;
  cancel_url: string;
  client_reference_id: string;
  metadata: Record<string, string>;
};

/**
 * Create a Stripe Checkout Session via HTTPS when STRIPE_SECRET_KEY is set.
 * Price is inline `price_data` so no Stripe Dashboard price IDs are required.
 */
export async function createStripeCheckoutSession(
  input: StripeCheckoutInput,
): Promise<{ id: string; url: string }> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("stripe_not_configured");

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("success_url", input.success_url);
  params.set("cancel_url", input.cancel_url);
  params.set("client_reference_id", input.client_reference_id);
  params.set(
    "line_items[0][price_data][currency]",
    input.currency,
  );
  params.set(
    "line_items[0][price_data][unit_amount]",
    String(input.amount_cents),
  );
  params.set(
    "line_items[0][price_data][recurring][interval]",
    "month",
  );
  params.set(
    "line_items[0][price_data][product_data][name]",
    `GeoLens ${input.plan_code}`,
  );
  params.set("line_items[0][quantity]", "1");
  for (const [k, v] of Object.entries(input.metadata)) {
    params.set(`metadata[${k}]`, v);
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const body = (await res.json()) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };
  if (!res.ok || !body.id || !body.url) {
    throw new Error(body.error?.message ?? "stripe_checkout_failed");
  }
  return { id: body.id, url: body.url };
}

/** Verify Stripe-Signature header (v1 schemes). */
export function verifyStripeWebhookSignature(
  rawBody: string,
  header: string | undefined,
  secret = process.env.STRIPE_WEBHOOK_SECRET,
): boolean {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim() ?? "", v?.trim() ?? ""];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (Number.isNaN(age) || age > 300) return false;
  const payload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
