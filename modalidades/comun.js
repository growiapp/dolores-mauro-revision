// Contenido que comparten las dos modalidades de invitación. Nada exclusivo de una modalidad va acá (tampoco en los
// comentarios): eso vive en el módulo de cada enlace, y cada página carga solo el suyo.
// No es un control de acceso: el enlace separa la experiencia, no protege la información.

// Íconos de línea para el cronograma (24×24, trazo del color del texto)
export const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
export const ICONS = {
  copas: svg('<path d="M6.2 3.5h4.6l-.4 4.6a2 2 0 0 1-3.8 0zM8.5 10.3V18M6.3 18h4.4M13.2 3.5h4.6l-.4 4.6a2 2 0 0 1-3.8 0zM15.5 10.3V18M13.3 18h4.4M11.2 5.6l1.6-.6"/>'),
  anillos: svg('<circle cx="9" cy="14" r="5.5"/><circle cx="15" cy="14" r="5.5"/><path d="M7.5 5.5 9 3.5l1.5 2"/>'),
  mesa: svg('<circle cx="12" cy="13" r="6.2"/><circle cx="12" cy="13" r="3.4"/><path d="M3.2 6v4.2a1.4 1.4 0 0 0 1.4 1.4M4.6 6v15M20.8 6c-1.3.8-1.9 2.6-1.9 4.6s.6 2.5 1.9 2.6V21"/>'),
  musica: svg('<path d="M9 18.5V5.2l10-2v12.6"/><circle cx="6.8" cy="18.5" r="2.3"/><circle cx="16.8" cy="15.8" r="2.3"/><path d="M9 9.2l10-2"/>'),
  luna: svg('<path d="M15.5 3.6a8.6 8.6 0 1 0 4.9 13.2A7 7 0 0 1 15.5 3.6z"/><path d="M18.5 4.2v2.6M17.2 5.5h2.6"/>'),
};

const FINCA = "Finca Los Churquis, Volcán";
// Desde la recepción hasta el final: lo mismo para todos los invitados
export const DESDE_RECEPCION = [
  { time: "12:30", title: "Recepción", place: FINCA, icon: "copas" },
  { time: "13:00", title: "Ceremonia civil", place: "Finca Los Churquis", icon: "anillos" },
  { time: "14:00", title: "Almuerzo", icon: "mesa" },
  { time: "15:00", title: "Baile", icon: "musica" },
  { time: "22:00", title: "Fin de la celebración", icon: "luna" },
];

// Datos bancarios: la misma cuenta para las dos modalidades.
// PENDIENTE: completarlos SOLO desde la fuente verificada que entreguen Dolores y Mauro (ver deliverables/evolucion-v2).
// Forma: [["Titular", "…"], ["Banco", "…"], ["CBU", "…"], ["Alias", "…"]]. Mientras sea null, el sitio no muestra datos.
export const BANK = null;

// Validación al incorporar los datos: titular, banco y al menos CBU o alias, sin campos vacíos; CBU de 22 dígitos;
// alias de 6 a 20 caracteres (letras, números, punto y guion). Si algo no cierra, el sitio no muestra NINGÚN dato bancario
// (nunca datos incompletos) y lo avisa en la consola.
export function bankRows(bank) {
  if (bank == null) return null;
  const rows = Array.isArray(bank) ? bank : [];
  const get = (k) => rows.find((r) => r[0] === k)?.[1];
  const ok = rows.length > 0 && rows.every((r) => Array.isArray(r) && r.length === 2 && r.every((v) => typeof v === "string" && v.trim()))
    && get("Titular") && get("Banco") && (get("CBU") || get("Alias"))
    && (get("CBU") === undefined || /^\d{22}$/.test(get("CBU")))
    && (get("Alias") === undefined || /^[A-Za-z0-9.-]{6,20}$/.test(get("Alias")));
  if (!ok) console.error("[invitación] Datos bancarios incompletos o con formato inválido: no se muestran");
  return ok ? rows : null;
}
