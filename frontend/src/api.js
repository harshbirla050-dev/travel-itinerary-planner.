const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"
 .trim()
     .replace(/\/+$/, "")
     .replace(/\/api$/, "");

// Anonymous per-browser identity. Swap for Supabase Auth user id when you add login.
export function userId() {
  let id = localStorage.getItem("wf_user");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("wf_user", id);
  }
  return id;
}

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { "Content-Type": "application/json", "X-User-Id": userId(), ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = Array.isArray(body.detail) ? body.detail.map((d) => d.msg).join(", ") : body.detail;
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  list: () => req("/api/trips"),
  get: (id) => req(`/api/trips/${id}`),
  generate: (body) => req("/api/trips/generate", { method: "POST", body: JSON.stringify(body) }),
  save: (id, itinerary, title) => req(`/api/trips/${id}`, { method: "PUT", body: JSON.stringify({ itinerary, title }) }),
  regenDay: (id, day, feedback) =>
    req(`/api/trips/${id}/regenerate-day/${day}`, { method: "POST", body: JSON.stringify({ feedback }) }),
  remove: (id) => req(`/api/trips/${id}`, { method: "DELETE" }),
};
