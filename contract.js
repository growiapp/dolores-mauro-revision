// Contrato de datos v3: RSVP por familia o grupo (deliverables/evolucion-v2/README.md §RSVP).
// Módulo sin dependencias del DOM: lo usan el navegador, los tests y el servidor (backend/build.mjs lo copia a Contrato.gs).

export const LIMITS = { group: 80, name: 80, member: 80, dietNotes: 120, msgName: 60, text: 500, bodyBytes: 8192 };
export const DIETS = { vegetariano: "Vegetariano", vegano: "Vegano", "sin-tacc": "Sin TACC (celíaco)", otra: "Otra" };
// Modalidades de invitación (ids públicos de los enlaces). Sus nombres legibles viven solo en el servidor.
// V4: "fiesta" (desde las 16) es la tercera invitación; se cuenta aparte de "celebracion".
export const MODALITIES = ["ceremonia", "celebracion", "fiesta"];

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

// RSVP de una familia o grupo: una respuesta con quién confirma (name), el grupo y las personas que asisten.
// La cantidad no se escribe: es la cantidad de personas listadas. Quien no asiste no lista personas.
// Errores por integrante: "members.<i>.name" y "members.<i>.diet_notes" (los pinta el formulario junto a cada fila).
export function validateRsvp(input, { maxPeople = 10 } = {}) {
  const errors = {};
  const data = {
    group: cleanLine(input.group, LIMITS.group),
    name: cleanLine(input.name, LIMITS.name),
    attending: input.attending === "si" || input.attending === "no" ? input.attending : "",
    members: [],
    people: 0,
    modality: MODALITIES.indexOf(input.modality) >= 0 ? input.modality : "",
    // Transporte: solo si asisten. "si" | "no"; sin respuesta queda "" (y es un error).
    transport: "",
  };
  if (letters(data.group) < 2) errors.group = "Escribí el nombre de la familia o del grupo.";
  if (letters(data.name) < 2) errors.name = "Escribí tu nombre y apellido.";
  if (!data.attending) errors.attending = "Elegí si van a poder venir.";
  if (!data.modality) errors.modality = "Abrí la invitación desde el enlace que te enviaron.";
  if (data.attending === "si") {
    const raw = Array.isArray(input.members) ? input.members : [];
    if (raw.length > maxPeople) errors.members = `Como máximo ${maxPeople} personas por respuesta. Si son más, envíen otra respuesta.`;
    raw.slice(0, maxPeople).forEach((m, i) => {
      const o = m && typeof m === "object" && !Array.isArray(m) ? m : {};
      const member = {
        name: cleanLine(o.name, LIMITS.member),
        diet: Object.prototype.hasOwnProperty.call(DIETS, o.diet) ? o.diet : "", // sin Object.hasOwn: también corre en Apps Script
        diet_notes: "",
      };
      if (member.diet === "otra") member.diet_notes = cleanLine(o.diet_notes, LIMITS.dietNotes);
      if (letters(member.name) < 2) errors["members." + i + ".name"] = "Escribí el nombre de esta persona.";
      if (member.diet === "otra" && !member.diet_notes) errors["members." + i + ".diet_notes"] = "Contanos qué restricción tiene.";
      data.members.push(member);
    });
    if (!raw.length) errors.members = "Agregá al menos una persona que asista.";
    data.people = data.members.length;
    data.transport = input.transport === "si" || input.transport === "no" ? input.transport : "";
    if (!data.transport) errors.transport = "Contanos si van a necesitar transporte.";
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

// ---------- Lectura pública: se valida antes de pintar ----------
export function parseMessages(body) {
  if (!body || body.ok !== true || !Array.isArray(body.items)) return null;
  return body.items
    .filter((m) => m && typeof m.name === "string" && typeof m.text === "string")
    .map((m) => ({ name: cleanLine(m.name, LIMITS.msgName), text: cleanText(m.text, LIMITS.text) }))
    .filter((m) => m.name && m.text)
    .slice(0, 50);
}
