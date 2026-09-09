import { cookies } from "next/headers";
import { apiBase } from "./api";

/** Server-only fetch that forwards the geo_session cookie to the API. */
export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${apiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init?.headers);
  try {
    const jar = await cookies();
    const session = jar.get("geo_session")?.value;
    if (session && !headers.has("cookie")) {
      headers.set("cookie", `geo_session=${session}`);
    }
  } catch {
    /* cookies() unavailable outside a request */
  }
  return fetch(url, {
    ...init,
    headers,
    credentials: init?.credentials ?? "include",
    cache: init?.cache ?? "no-store",
  });
}
