export async function apiRequest(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || "erro inesperado");
    // A few endpoints (see server/index.js's requireCurrentUser) send a
    // machine-readable `code` alongside the message — e.g. SESSION_SUPERSEDED
    // when a later login elsewhere invalidated this session — so callers can
    // react specifically instead of pattern-matching the pt-BR text.
    if (body.code) err.code = body.code;
    throw err;
  }
  return body;
}
