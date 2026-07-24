import type { Location } from "react-router-dom";

/** Where to send a user after they log in / sign up.
 * Priority: an explicit `?next=` (from a public "log in" link), then the
 * location the auth guard bounced them from (router state), then `fallback`.
 * Only same-origin paths are honoured — never an absolute URL (open-redirect). */
export function returnTo(location: Location, fallback = "/"): string {
  const next = new URLSearchParams(location.search).get("next");
  if (isSafePath(next)) return next as string;
  const from = (location.state as { from?: string } | null)?.from;
  if (isSafePath(from)) return from as string;
  return fallback;
}

function isSafePath(path: string | null | undefined): boolean {
  // Must be a root-relative path ("/x"), not "//host" or "https://host".
  return !!path && path.startsWith("/") && !path.startsWith("//");
}
