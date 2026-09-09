/**
 * Browser → same-origin `/backend` (Next rewrite → API) so session cookies stick.
 * Server → hit API directly (see api-server.ts for cookie forwarding).
 *
 * Never call an absolute API origin from the browser: localhost vs 127.0.0.1
 * splits the cookie jar and every authed project request becomes 401.
 */
export function apiBase(): string {
  if (typeof window === "undefined") {
    return (
      process.env.API_INTERNAL_URL?.replace(/\/$/, "") ||
      "http://127.0.0.1:3001"
    );
  }
  const pub = process.env.NEXT_PUBLIC_API_URL;
  if (pub && pub.length > 0 && !/^https?:\/\//i.test(pub)) {
    return pub.replace(/\/$/, "");
  }
  return "/backend";
}
