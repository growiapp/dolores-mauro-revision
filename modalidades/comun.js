
export const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
export const ICONS = {
  copas: svg('<path d="M6.2 3.5h4.6l-.4 4.6a2 2 0 0 1-3.8 0zM8.5 10.3V18M6.3 18h4.4M13.2 3.5h4.6l-.4 4.6a2 2 0 0 1-3.8 0zM15.5 10.3V18M13.3 18h4.4M11.2 5.6l1.6-.6"/>'),
  anillos: svg('<circle cx="9" cy="14" r="5.5"/><circle cx="15" cy="14" r="5.5"/><path d="M7.5 5.5 9 3.5l1.5 2"/>'),
  mesa: svg('<circle cx="12" cy="13" r="6.2"/><circle cx="12" cy="13" r="3.4"/><path d="M3.2 6v4.2a1.4 1.4 0 0 0 1.4 1.4M4.6 6v15M20.8 6c-1.3.8-1.9 2.6-1.9 4.6s.6 2.5 1.9 2.6V21"/>'),
  musica: svg('<path d="M9 18.5V5.2l10-2v12.6"/><circle cx="6.8" cy="18.5" r="2.3"/><circle cx="16.8" cy="15.8" r="2.3"/><path d="M9 9.2l10-2"/>'),
  luna: svg('<path d="M15.5 3.6a8.6 8.6 0 1 0 4.9 13.2A7 7 0 0 1 15.5 3.6z"/><path d="M18.5 4.2v2.6M17.2 5.5h2.6"/>'),
};

export const FINCA_MAPA = "https://maps.app.goo.gl/17YRxFkns39AWd3t5";

export const BANK = [["Alias", "DOLOYMAURO.BODA"], ["CVU", "0000076500000016248061"]];

export function cbuOk(cbu) {
  if (!/^\d{22}$/.test(cbu)) return false;
  const check = (digits, w) => (10 - ([...digits].reduce((s, d, i) => s + d * w[i % w.length], 0) % 10)) % 10;
  return check(cbu.slice(0, 7), [7, 1, 3, 9]) === +cbu[7] && check(cbu.slice(8, 21), [3, 9, 7, 1]) === +cbu[21];
}

export function bankRows(bank) {
  if (bank == null) return null;
  const rows = Array.isArray(bank) ? bank : [];
  const get = (k) => rows.find((r) => r[0] === k)?.[1];
  const ok = rows.length > 0 && rows.every((r) => Array.isArray(r) && r.length === 2 && r.every((v) => typeof v === "string" && v.trim()))
    && (get("CBU") || get("CVU") || get("Alias"))
    && (get("CBU") === undefined || cbuOk(get("CBU")))
    && (get("CVU") === undefined || (cbuOk(get("CVU")) && /^000\d{4}\d0/.test(get("CVU"))))
    && (get("Alias") === undefined || /^[A-Za-z0-9.-]{6,20}$/.test(get("Alias")));
  if (!ok) console.error("[invitación] Datos bancarios incompletos o con formato inválido: no se muestran");
  return ok ? rows : null;
}
