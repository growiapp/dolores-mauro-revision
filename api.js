// Adaptadores de persistencia (contrato v2). Ningún éxito se da por bueno sin una confirmación verificable del servidor.
import { parseStats, parseMessages, computePublicStats } from "./contract.js";
export { DIETS, validateRsvp, validateMessage } from "./contract.js";

// kind: "network" | "timeout" | "invalid_response" → resultado incierto (puede haberse guardado; reintentar es seguro)
//       "rejected"                                  → el servidor respondió y NO guardó (code + errors por campo)
export class ApiError extends Error {
  constructor(kind, { code = "", errors = null, status = 0 } = {}) {
    super(`${kind}${code ? `:${code}` : ""}`);
    Object.assign(this, { kind, code, errors, status });
  }
  get uncertain() { return this.kind !== "rejected"; }
}

const EXPECTED = { rsvp: "received", messages: "pending_moderation" };

// transport "json": backend del mismo origen (Cloudflare). "text": Apps Script (evita la verificación previa CORS).
// routeStyle "path": base/rsvp. "query": base?route=rsvp (Apps Script publica una sola URL).
export function createHttpAdapter(base, { transport = "json", routeStyle = "path", timeoutMs = 20000, fetchImpl = (...a) => globalThis.fetch(...a) } = {}) {
  const url = (route) => routeStyle === "query"
    ? `${base}${base.includes("?") ? "&" : "?"}route=${encodeURIComponent(route)}`
    : `${base.replace(/\/$/, "")}/${route}`;

  async function call(route, body) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    let res, text;
    try {
      const init = { signal: ctrl.signal, credentials: "omit", cache: "no-store", redirect: "follow" };
      if (body !== undefined) {
        init.method = "POST";
        init.headers = { "Content-Type": transport === "text" ? "text/plain;charset=utf-8" : "application/json" };
        init.body = JSON.stringify(body);
      }
      res = await fetchImpl(url(route), init);
      // Una respuesta opaca (no-cors) no se puede leer: jamás cuenta como éxito.
      if (res.type === "opaque" || res.type === "opaqueredirect") throw new ApiError("invalid_response", { status: res.status });
      text = await res.text();
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (e?.name === "AbortError") throw new ApiError("timeout");
      // Un envío cuya respuesta el navegador no deja leer (p. ej., la página de error de Apps Script, sin CORS)
      // pudo haberse guardado: es incierto. Solo es "network" (no salió) si el navegador informa que no hay conexión.
      throw new ApiError(body !== undefined && globalThis.navigator?.onLine !== false ? "invalid_response" : "network");
    } finally {
      clearTimeout(t);
    }
    let json;
    try { json = JSON.parse(text); } catch { throw new ApiError("invalid_response", { status: res.status }); }
    if (!json || typeof json !== "object" || typeof json.ok !== "boolean") throw new ApiError("invalid_response", { status: res.status });
    if (json.ok === false) {
      const errors = json.errors && typeof json.errors === "object" ? json.errors : null;
      throw new ApiError("rejected", { code: String(json.code || "error"), errors, status: res.status });
    }
    return json;
  }

  // Éxito verificable: ok + código esperado + id del registro + eco del request_id enviado.
  // "busy": el servidor no pudo tomar el lock y NO guardó. Un único reintento automático con el mismo request_id.
  const write = async (route, payload) => {
    let r, retried = false;
    try {
      r = await call(route, payload);
    } catch (e) {
      if (e.kind !== "rejected" || e.code !== "busy") throw e;
      await new Promise((res) => setTimeout(res, 300 + Math.random() * 700));
      retried = true;
      r = await call(route, payload);
    }
    if (r.code !== EXPECTED[route] || typeof r.id !== "string" || !r.id || r.request_id !== payload.request_id) {
      throw new ApiError("invalid_response");
    }
    return retried ? { ...r, retried } : r;
  };
  const read = async (route, parse) => {
    const parsed = parse(await call(route));
    if (parsed === null) throw new ApiError("invalid_response");
    return parsed;
  };

  return {
    demo: false,
    submitRsvp: (payload) => write("rsvp", payload),
    submitMessage: (payload) => write("messages", payload),
    getStats: () => read("public/stats", parseStats),
    getMessages: () => read("public/messages", parseMessages),
  };
}

// Adaptador de DEMOSTRACIÓN: memoria de la pestaña. No guarda, no envía y no notifica a nadie.
// Aplica la misma política de contador que el servidor (computePublicStats).
export function createDemoAdapter({ fail = false, fixtures = false, publishNames = false } = {}) {
  const records = fixtures ? FIXTURES.records.map((r) => ({ ...r })) : [];
  const wait = () => new Promise((r) => setTimeout(r, 400));
  const guard = async () => { await wait(); if (fail) throw new ApiError("network"); };
  return {
    demo: true,
    async submitRsvp(p) { await guard(); records.push({ ...p, id: p.request_id, status: p.website ? "discarded" : "accepted" }); return { ok: true, code: "demo" }; },
    async submitMessage() { await guard(); return { ok: true, code: "demo" }; },
    async getStats() { return parseStats(computePublicStats(records, { publishNames: publishNames || fixtures })); },
    async getMessages() { return fixtures ? parseMessages({ ok: true, items: FIXTURES.messages }) : []; },
  };
}

// request_id ligado al contenido: mismo contenido → mismo id (reintento idempotente);
// contenido distinto → id nuevo; tras una confirmación verificada → se libera.
export function createRequestKeeper(newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`) {
  let fingerprint = null, id = null;
  return {
    idFor(payload) {
      const f = JSON.stringify(payload);
      if (f !== fingerprint) { fingerprint = f; id = newId(); }
      return id;
    },
    settle() { fingerprint = null; id = null; },
  };
}

// Qué backend usar. La demostración nunca se activa por accidente fuera de un entorno local:
// si la configuración no es válida, los formularios quedan deshabilitados (falla cerrada).
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
export function resolveBackend(config, hostname) {
  if (config.mode === "http") {
    const b = typeof config.apiBase === "string" ? config.apiBase : "";
    const ok = /^https:\/\/[^/\s]+/.test(b) || /^\/[^\s]*$/.test(b) || (LOCAL_HOSTS.has(hostname) && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(b));
    return ok ? { kind: "http" } : { kind: "unavailable", reason: "apiBase inválido para mode http" };
  }
  if (config.mode === "demo") {
    return LOCAL_HOSTS.has(hostname) || (config.demoHosts || []).includes(hostname)
      ? { kind: "demo" } : { kind: "unavailable", reason: `demo no habilitada en ${hostname}` };
  }
  return { kind: "unavailable", reason: "mode desconocido" };
}

// Datos de ejemplo (no son invitados reales), solo para el modo revisión. Nunca se muestran en la vista pública.
export const FIXTURES = {
  records: [
    { id: "f1", status: "accepted", attending: "si", people: 12, name: "Familia de ejemplo", show_name: true },
    { id: "f2", status: "accepted", attending: "si", people: 2, name: "Invitada de ejemplo", show_name: true },
    { id: "f3", status: "accepted", attending: "si", people: 1, name: "Invitada de ejemplo", show_name: true },
    { id: "f4", status: "accepted", attending: "si", people: 3, name: "Invitado de ejemplo", show_name: false },
    { id: "f5", status: "discarded", attending: "si", people: 9, name: "Bot de ejemplo", show_name: true },
  ],
  messages: [
    { name: "Invitada de ejemplo", text: "¡Qué alegría! Ahí vamos a estar para celebrarlos." },
    { name: "Familia de ejemplo", text: "Les deseamos un camino lleno de risas, de viajes y de tardes compartidas. Gracias por hacernos parte de un día tan especial; los vamos a abrazar fuerte." },
    { name: "Invitado de ejemplo", text: "¡Felicitaciones!\nNos vemos en abril." },
  ],
};
