// Contrato de datos v2 (deliverables/phase2b-preparation/data-contract-v2.md).
// Módulo sin dependencias del DOM: lo usan el navegador, los tests y sirve de referencia para el servidor.

export const LIMITS = { name: 80, msgName: 60, companions: 300, dietNotes: 200, comments: 500, text: 500, bodyBytes: 4096 };
export const DIETS = { vegetariano: "Vegetariano", vegano: "Vegano", "sin-tacc": "Sin TACC (celíaco)", otra: "Otra" };

// Caracteres invisibles o peligrosos: controles (Cc) y de formato (Cf: ancho cero, bidi, BOM…).
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
// Sin "??" (ES2020): el mismo archivo se despliega en Apps Script (backend/build.mjs) y así no depende de su versión de V8.
const orEmpty = (v) => (v === null || v === undefined ? "" : v);
const cpLength = (s) => Array.from(s).length;
const cpSlice = (s, max) => Array.from(s).slice(0, max).join("");

// Una línea: NFC, sin invisibles, espacios colapsados.
export function cleanLine(v, max) {
  const s = String(orEmpty(v)).normalize("NFC").replace(/\s+/g, " ").replace(INVISIBLE, "").replace(/ {2,}/g, " ").trim();
  return cpSlice(s, max);
}

// Texto largo: conserva saltos de línea (como máximo una línea en blanco seguida).
export function cleanText(v, max) {
  const s = String(orEmpty(v)).normalize("NFC").replace(/\r\n?/g, "\n")
    .split("\n").map((l) => l.replace(/\s+/g, " ").replace(INVISIBLE, "").replace(/ {2,}/g, " ").trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n").trim();
  return cpSlice(s, max);
}

const letters = (s) => (s.match(/\p{L}/gu) || []).length;
const bool = (v) => v === true || v === "on" || v === "true";

// Clave de agrupación de posibles duplicados (NO reemplaza nada: solo agrupa para revisión).
export const dedupeKey = (name) => cleanLine(name, 200).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N} ]/gu, "").trim();

// RSVP. `publicNames` indica si la regla de publicación de nombres está activa (decisión de la pareja).
export function validateRsvp(input, { maxPeople = 10, publicNames = false } = {}) {
  const errors = {};
  const data = {
    name: cleanLine(input.name, LIMITS.name),
    attending: input.attending === "si" || input.attending === "no" ? input.attending : "",
    people: 0,
    companions: cleanLine(input.companions, LIMITS.companions),
    diet: [...new Set([].concat(input.diet == null ? [] : input.diet))].filter((d) => Object.prototype.hasOwnProperty.call(DIETS, d)), // sin Object.hasOwn: también corre en Apps Script
    diet_notes: cleanLine(input.diet_notes, LIMITS.dietNotes),
    comments: cleanText(input.comments, LIMITS.comments),
    show_name: publicNames && bool(input.show_name),
  };
  if (letters(data.name) < 2) errors.name = "Escribí tu nombre y apellido.";
  if (!data.attending) errors.attending = "Elegí si vas a poder venir.";
  if (data.attending === "si") {
    const raw = String(orEmpty(input.people)).trim();
    const n = /^\d{1,2}$/.test(raw) ? Number(raw) : NaN;
    if (!(n >= 1 && n <= maxPeople)) errors.people = `Indicá cuántas personas confirman (de 1 a ${maxPeople}).`;
    else data.people = n;
    if (data.diet.includes("otra") && !data.diet_notes) errors.diet_notes = "Contanos qué restricción alimentaria tenés.";
  } else {
    // Quien no asiste no suma personas ni datos de menú, y nunca aparece en la lista pública.
    Object.assign(data, { companions: "", diet: [], diet_notes: "", show_name: false });
  }
  return { ok: Object.keys(errors).length === 0, errors, data };
}

export function validateMessage(input) {
  const errors = {};
  const data = { name: cleanLine(input.name, LIMITS.msgName), text: cleanText(input.text, LIMITS.text), publish: bool(input.publish) };
  if (letters(data.name) < 2) errors.name = "Escribí tu nombre.";
  if (cpLength(data.text.replace(/\s/g, "")) < 3) errors.text = "Escribí tu mensaje.";
  return { ok: Object.keys(errors).length === 0, errors, data };
}

// Tamaño del cuerpo tal como viaja (UTF-8).
export const bodyBytes = (obj) => new TextEncoder().encode(JSON.stringify(obj)).length;

// ---------- Lecturas públicas: se validan antes de pintar ----------
export function parseStats(body) {
  if (!body || body.ok !== true || !Number.isInteger(body.people) || body.people < 0 || !Array.isArray(body.names)) return null;
  const names = body.names.filter((n) => typeof n === "string").map((n) => cleanLine(n, LIMITS.name)).filter((n) => letters(n) >= 2).slice(0, 500);
  return { people: body.people, names };
}

export function parseMessages(body) {
  if (!body || body.ok !== true || !Array.isArray(body.items)) return null;
  return body.items
    .filter((m) => m && typeof m.name === "string" && typeof m.text === "string")
    .map((m) => ({ name: cleanLine(m.name, LIMITS.msgName), text: cleanText(m.text, LIMITS.text) }))
    .filter((m) => m.name && m.text)
    .slice(0, 50);
}

// ---------- Contador público (implementación de referencia de la política v2) ----------
// Registros: { id, status: "received"|"accepted"|"discarded", superseded_by, attending, people, name, show_name, created_at }
// - Solo computan respuestas "accepted" no reemplazadas por la administración.
// - Posibles duplicados (misma clave de nombre) computan UNA vez: el mayor `people` entre sus "sí".
//   Un "no" nunca resta automáticamente un "sí" (evita suplantación); lo resuelve la administración.
// - Cada respuesta computa como máximo `capPerResponse` personas hasta que la administración la revise.
// - Nombres: solo si la regla está activa, la persona dio permiso y asiste.
export function computePublicStats(records, { capPerResponse = 10, publishNames = false } = {}) {
  const groups = new Map();
  for (const r of records) {
    if (r.status !== "accepted" || r.superseded_by || r.attending !== "si") continue;
    const k = dedupeKey(r.name);
    const people = Math.min(Number.isInteger(r.people) ? r.people : 0, r.reviewed ? Infinity : capPerResponse);
    const g = groups.get(k) || { people: 0, name: null };
    g.people = Math.max(g.people, people);
    if (publishNames && r.show_name && !g.name) g.name = cleanLine(r.name, LIMITS.name);
    groups.set(k, g);
  }
  const all = [...groups.values()];
  return { ok: true, code: "stats", people: all.reduce((n, g) => n + g.people, 0), names: publishNames ? all.map((g) => g.name).filter(Boolean) : [] };
}
