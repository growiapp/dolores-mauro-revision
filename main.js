import { CONFIG } from "./config.js";
import { validateRsvp, validateMessage, createHttpAdapter, createDemoAdapter, createRequestKeeper, resolveBackend } from "./api.js";
import { bodyBytes, LIMITS, MODALITIES } from "./contract.js";

// Días de calendario (Argentina, UTC-3) entre dos instantes: el sábado del casamiento es "hoy" desde la medianoche
export function daysUntil(target, now) {
  const day = (t) => Math.floor((t - 3 * 3600e3) / 86400e3);
  return day(target) - day(now);
}

export function parts(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86400), h: Math.floor(t / 3600) % 24, m: Math.floor(t / 60) % 60, s: t % 60 };
}

if (typeof document !== "undefined") {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const params = new URLSearchParams(location.search);
  // "2027-01-15" → "15 de enero de 2027" (hora de Argentina); "" si no es una fecha
  const longDate = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? new Date(`${iso}T12:00:00-03:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }) : "");
  // Plazo para confirmar: hasta el día rsvpUntil inclusive, en Argentina (UTC-3). El servidor lo hace cumplir; acá se anuncia
  const rsvpUntil = longDate(CONFIG.rsvpUntil);
  const rsvpOver = !!rsvpUntil && new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10) > CONFIG.rsvpUntil;
  const rsvpOverText = `El plazo para confirmar terminó el ${rsvpUntil}.`;
  const review = params.has("revision");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  document.documentElement.classList.add("js");

  // ---------- Revelado de fotos y del cronograma (una vez). Sin JS quedan visibles: la clase .js se agrega arriba ----------
  const io = new IntersectionObserver((entries) => {
    // También lo que ya quedó arriba: con un scroll rápido o un salto de ancla, algo puede no llegar a "intersectar".
    for (const e of entries) if (e.isIntersecting || e.boundingClientRect.top < 0) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -12% 0px" });
  const observe = (root = document) => $$("[data-reveal]", root).forEach((el) => io.observe(el));
  observe();

  // ---------- Botón fijo "Confirmar" (móvil): solo entre la portada y el RSVP. Una vez alcanzado el RSVP no vuelve, así no tapa
  // los mensajes, la playlist, la foto del cierre ni la navegación del pie ----------
  const fab = $(".fab"), hero = $(".hero"), rsvpSection = $("#confirmar");
  const seen = new Map();
  const fabIO = new IntersectionObserver((entries) => {
    for (const e of entries) seen.set(e.target, e);
    const h = seen.get(hero), r = seen.get(rsvpSection);
    const reached = r && (r.isIntersecting || r.boundingClientRect.top < 0);
    fab.classList.toggle("is-shown", !!h && !h.isIntersecting && !reached);
  });
  fabIO.observe(hero);
  fabIO.observe(rsvpSection);

  // ---------- Galería: lightbox accesible. Sin JS, cada miniatura abre la foto grande ----------
  const items = $$(".gallery__item");
  const box = $(".lightbox");
  const boxImg = $("img", box), boxCount = $(".lightbox__count", box);
  let at = 0, opener = null;
  const show = (i) => {
    at = (i + items.length) % items.length;
    const a = items[at], img = $("img", a);
    boxImg.src = a.href;
    boxImg.alt = img.alt;
    boxCount.textContent = `${at + 1} / ${items.length}`;
  };
  items.forEach((a, i) => a.addEventListener("click", (e) => { e.preventDefault(); opener = a; show(i); box.showModal(); }));
  $(".lightbox__prev", box).addEventListener("click", () => show(at - 1));
  $(".lightbox__next", box).addEventListener("click", () => show(at + 1));
  $(".lightbox__close", box).addEventListener("click", () => box.close());
  // Deslizar para pasar de foto. Un deslizamiento que termina sobre el fondo no debe cerrar el visor.
  let x0 = null, swiped = false;
  box.addEventListener("pointerdown", (e) => { x0 = e.clientX; swiped = false; });
  box.addEventListener("pointerup", (e) => {
    const dx = x0 === null ? 0 : e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 40) { swiped = true; show(at + (dx < 0 ? 1 : -1)); }
  });
  // Tocar fuera de la foto (fondo o márgenes) cierra; tocar la foto no.
  box.addEventListener("click", (e) => { if ((e.target === box || e.target.tagName === "FIGURE") && !swiped) box.close(); });
  box.addEventListener("close", () => opener?.focus());
  box.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(at - 1);
    if (e.key === "ArrowRight") show(at + 1);
  });

  // ---------- Música: playlist (escuchar y, si hay un enlace de colaboración vigente, sumar canciones) y audio de fondo ----------
  // Un enlace público solo deja escuchar; para sumar canciones hace falta el de colaboración, que vence (Spotify: 7 días).
  // Los textos salen de qué enlaces hay y si siguen vigentes, nunca del dominio. Ver config.js
  const music = CONFIG.music || {};
  const https = (u) => typeof u === "string" && /^https:\/\/\S+$/.test(u);
  const canAdd = https(music.collaborateUrl) && Date.parse(music.collaborateUntil) > Date.now();
  const canListen = https(music.listenUrl);
  // Formulario de sugerencias (p. ej. Google Forms): no pide cuenta ni vence; los novios curan y suman las canciones.
  // Si además hay colaboración vigente, manda la colaboración; al vencer, queda el formulario.
  const canSuggest = !canAdd && https(music.suggestUrl);
  if (canAdd || canListen || canSuggest) {
    if (canAdd) {
      const add = Object.assign($(".playlist__add"), { href: music.collaborateUrl, hidden: false });
      $(".playlist__text").textContent = "Ayudanos a llenar la pista: sumá esa canción que no puede faltar y armemos la playlist entre todos.";
      // Si vence con la página abierta: no se abre un enlace vencido, el botón desaparece
      add.addEventListener("click", (e) => { if (Date.parse(music.collaborateUntil) <= Date.now()) { e.preventDefault(); add.hidden = true; } });
    }
    if (canListen) Object.assign($(".playlist__listen"), { href: music.listenUrl, hidden: false });
    if (canSuggest) {
      const b = Object.assign($(".playlist__add"), { href: music.suggestUrl, hidden: false });
      b.firstChild.textContent = "Sugerir canciones";
      $(".playlist__text").textContent = "Contanos qué canciones te gustaría escuchar ese día: las vamos a tener en cuenta para la playlist.";
    }
    // Sin aclaraciones técnicas: los botones dicen qué hacen; la cuenta y los permisos los resuelve la plataforma
    $("#playlist").removeAttribute("data-pending");
    // Reproductor oficial (portada y canciones) para una playlist de Spotify. Se crea al acercarse a la sección
    const id = canListen && /^https:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]{22})(?:[?#].*)?$/.exec(music.listenUrl)?.[1];
    const box = $("[data-slot=player]");
    if (id && box) {
      const load = () => {
        const f = Object.assign(document.createElement("iframe"), {
          src: `https://open.spotify.com/embed/playlist/${id}?utm_source=generator`, title: "Playlist de Dolores y Mauro en Spotify",
          loading: "lazy", allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
        });
        f.setAttribute("height", "152");
        box.replaceChildren(f);
        box.hidden = false;
      };
      new IntersectionObserver((es, o) => { if (es.some((e) => e.isIntersecting)) { o.disconnect(); load(); } }, { rootMargin: "600px 0px" }).observe($("#playlist"));
    }
  }
  // Música de la apertura: UNA sola pista. Nunca suena antes de un toque: arranca con «Abrir invitación» (A1, A2 o la clásica
  // llaman a window.__musica.abrir dentro del mismo clic, que es lo que habilita el sonido) y sigue después. El botón fijo la
  // pausa y la retoma donde estaba. Si el archivo falla, el botón desaparece y la invitación sigue igual. Con «ahorro de
  // datos» no arranca sola: queda el botón.
  if (music.src) {
    const toggle = $(".music-toggle"), audio = Object.assign(new Audio(), { loop: true, preload: "none" });
    let broken = false;
    const paint = () => {
      const on = !audio.paused;
      toggle.setAttribute("aria-pressed", String(on));
      toggle.setAttribute("aria-label", on ? "Pausar la música" : "Escuchar la música");
      toggle.classList.toggle("is-playing", on);
    };
    const fail = () => { broken = true; audio.pause(); toggle.hidden = true; console.warn("[invitación] No se pudo reproducir la música"); };
    audio.addEventListener("play", paint);
    audio.addEventListener("pause", paint);
    audio.addEventListener("error", fail);
    const play = () => {
      if (broken || !audio.paused) return; // sin reinicios ni dos reproducciones a la vez
      if (!audio.src) audio.src = music.src;
      // NotAllowedError: el navegador pide otro toque. AbortError: se pausó antes de arrancar (p. ej. cambió de pestaña). No son fallas
      audio.play().then(paint, (e) => (e && (e.name === "NotAllowedError" || e.name === "AbortError") ? paint() : fail()));
    };
    paint();
    toggle.hidden = false;
    toggle.addEventListener("click", () => (audio.paused ? play() : audio.pause()));
    // Si la invitación deja de verse (otra pestaña, ventana minimizada, celular en segundo plano o salida de la página), la
    // música se pausa y queda en pausa al volver: la retoma el invitado con el botón, desde donde estaba. Un simple cambio de
    // foco no la pausa (la ventana puede seguir a la vista), salvo que sea para tocar el reproductor de Spotify: dos audios no.
    const hush = () => { if (!audio.paused) audio.pause(); };
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") hush(); });
    addEventListener("pagehide", hush);
    addEventListener("blur", () => setTimeout(() => { if (document.activeElement?.closest("[data-slot=player]")) hush(); }));
    window.__musica = { abrir: () => { if (!navigator.connection?.saveData) play(); }, audio };
  }

  // ---------- Persistencia: backend configurado, demostración local o falla cerrada ----------
  const backend = resolveBackend(CONFIG, location.hostname);
  const api = backend.kind === "http"
    ? createHttpAdapter(CONFIG.apiBase, { transport: CONFIG.transport, routeStyle: CONFIG.routeStyle, timeoutMs: CONFIG.requestTimeoutMs })
    : backend.kind === "demo"
      ? createDemoAdapter({ fail: review && params.has("falla"), fixtures: review })
      : null;
  if (api?.demo) $$(".demo-note").forEach((el) => { el.hidden = false; });
  if (!api) console.error(`[invitación] Formularios deshabilitados: ${backend.reason}`);

  // Errores por campo: cada [data-field] pinta el suyo (también los de cada integrante, "members.2.name")
  const own = (field, sel) => $$(sel, field).filter((el) => el.closest("[data-field]") === field);
  const showErrors = (form, errors) => {
    for (const field of $$("[data-field]", form)) {
      const msg = errors[field.dataset.field] || "";
      const err = own(field, ".field__err")[0];
      if (err) err.textContent = msg;
      own(field, "input, textarea, select").forEach((el) => el.toggleAttribute("aria-invalid", !!msg));
    }
    const first = $$("[data-field]", form).find((f) => errors[f.dataset.field] && !f.closest("[hidden]"));
    if (first) (own(first, "input, textarea, select")[0] || $("button", first))?.focus();
  };
  // Mensajes según el tipo de error: "rechazado" es definitivo; los inciertos invitan a reintentar sin riesgo de duplicar.
  const failText = (err) => {
    if (err?.kind === "rejected") {
      if (err.code === "rate_limited") return "Recibimos muchos envíos seguidos. Esperá unos minutos y probá de nuevo.";
      if (err.code === "invalid") return "No pudimos registrar los datos. Revisá los campos marcados.";
      if (err.code === "payload_too_large") return "Hay demasiado texto. Acortalo y probá de nuevo.";
      if (err.code === "closed") return "Este formulario ya no recibe respuestas.";
      if (err.code === "rsvp_deadline") return rsvpUntil ? rsvpOverText : "El plazo para confirmar ya terminó.";
      return "No pudimos registrar tu respuesta. Probá de nuevo en unos minutos.";
    }
    if (err?.kind === "timeout" || err?.kind === "invalid_response") {
      return "No pudimos confirmar si llegó. Podés enviarla de nuevo: si ya estaba registrada, no se duplica.";
    }
    return "No pudimos enviarlo. Tus datos siguen acá: revisá tu conexión y probá de nuevo.";
  };
  // Formularios: quedan deshabilitados sin JS, sin backend válido o (RSVP) sin modalidad; acá se habilitan.
  const wire = (form, collect, validate, submit, done, closedText = "") => {
    const body = $(".form__body", form), status = $(".form__status", form), btn = $("button[type=submit]", form);
    if (!api) { status.textContent = "Este formulario todavía no está disponible."; return; }
    if (closedText) { status.textContent = closedText; return; }
    const keeper = createRequestKeeper();
    form.addEventListener("reset", () => keeper.settle());
    body.disabled = false;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = collect(form, e.submitter);
      const { ok, errors, data } = validate(raw);
      showErrors(form, errors);
      if (!ok) { status.textContent = "Revisá los campos marcados."; return; }
      // La trampa anti-bots viaja al servidor, que registra el envío como descartado (no se finge nada en el cliente).
      const content = { ...data, website: typeof raw.website === "string" ? raw.website.slice(0, 200) : "" };
      const payload = { ...content, request_id: keeper.idFor(content) };
      if (bodyBytes(payload) > LIMITS.bodyBytes) { status.textContent = failText({ kind: "rejected", code: "payload_too_large" }); return; }
      btn.disabled = true;
      status.textContent = "Enviando…";
      try {
        await submit(payload);
        keeper.settle();
        status.textContent = "";
        done(form, data);
      } catch (err) {
        if (err?.kind === "rejected" && err.errors) showErrors(form, err.errors);
        status.textContent = failText(err);
      } finally {
        btn.disabled = false;
      }
    });
  };
  // Con el botón que envió (submitter): así viaja su name/value, como publish=on en mensajes.
  const formData = (form, submitter) => Object.fromEntries(new FormData(form, submitter));
  const finish = (form, text, again) => {
    const panel = form.nextElementSibling;
    $(".form__done-text", panel).textContent = text;
    form.hidden = true;
    panel.hidden = false;
    panel.focus();
    $(".form__again", panel).onclick = () => {
      form.reset();
      again?.();
      panel.hidden = true;
      form.hidden = false;
      $("input", form).focus();
    };
  };

  // ---------- Mensajes (no dependen de la modalidad) ----------
  const msgForm = $("#msg-form");
  const msgText = $("#m-text"), msgCount = $(".field__count", msgForm);
  const count = () => { msgCount.textContent = `${Array.from(msgText.value).length} / 500`; };
  msgText.addEventListener("input", count);
  count();
  wire(msgForm, formData, validateMessage, (p) => api.submitMessage(p), (form) => {
    finish(form, api.demo
      ? "Así se ve el envío de un mensaje. Como es una demostración, no se guardó ni se envió."
      : "¡Gracias! Tu mensaje les llega a Dolores y Mauro y aparece acá cuando lo aprueben.", count);
    count();
  });

  // ---------- RSVP por familia o grupo: una fila por cada integrante que asiste; la cantidad se calcula ----------
  const rsvp = $("#rsvp-form");
  if (rsvpUntil) Object.assign($("[data-slot=rsvp-until]"), { textContent: rsvpOver ? rsvpOverText : `hasta el ${rsvpUntil}`, hidden: false });
  if (rsvpOver) fab.hidden = true; // vencido el plazo, el botón fijo no invita a confirmar
  const transportBox = $("[data-field=transport]", rsvp);
  const membersBox = $(".members", rsvp), list = $(".members__list", rsvp), addBtn = $(".members__add", rsvp), countEl = $(".members__count", rsvp);
  const rowTpl = $("#member-row");
  const max = CONFIG.rsvpMaxPeople;
  const rows = () => $$(".member", list);
  // Numera filas, ids y etiquetas; los errores del servidor ("members.1.name") caen en la fila correcta.
  const renumber = () => {
    rows().forEach((li, i) => {
      for (const f of $$("[data-field]", li)) {
        const key = f.dataset.field.split(".").pop();
        f.dataset.field = `members.${i}.${key}`;
        const input = $("input, select", f), id = `r-m${i}-${key}`;
        input.id = id;
        $("label", f).htmlFor = id;
        $(".member__who", f) && ($(".member__who", f).textContent = `, persona ${i + 1}`);
      }
      $(".member__n", li).textContent = `Persona ${i + 1}`;
      const name = $("[name=member-name]", li).value.trim();
      $(".member__remove", li).setAttribute("aria-label", `Quitar a ${name || `la persona ${i + 1}`}`);
      $(".member__remove", li).hidden = rows().length === 1;
    });
    const n = rows().length;
    countEl.textContent = `${n} ${n === 1 ? "persona" : "personas"}`;
    addBtn.disabled = n >= max;
    addBtn.title = n >= max ? `Como máximo ${max} personas por respuesta` : "";
  };
  const addRow = (name = "", follow = false) => {
    const li = rowTpl.content.firstElementChild.cloneNode(true);
    const input = $("[name=member-name]", li);
    input.value = name;
    // La primera persona arranca con el nombre de quien completa y lo sigue mientras no la editen (pueden ser personas distintas)
    if (follow) li.dataset.follow = "";
    const diet = $("select", li), notes = $(".member__notes", li);
    diet.addEventListener("change", () => { notes.hidden = diet.value !== "otra"; });
    input.addEventListener("input", () => { delete li.dataset.follow; renumber(); });
    $(".member__remove", li).addEventListener("click", () => {
      const next = li.nextElementSibling || li.previousElementSibling;
      li.remove();
      renumber();
      $("input", next)?.focus();
    });
    list.append(li);
    renumber();
    return li;
  };
  addBtn.addEventListener("click", () => $("input", addRow()).focus());
  const sync = () => {
    const yes = rsvp.elements.attending.value === "si";
    membersBox.hidden = !yes;
    transportBox.hidden = !yes;
    transportBox.querySelectorAll("input").forEach((i) => { i.required = yes; });
    // Al elegir "sí" por primera vez, la primera persona es quien completa (se puede cambiar)
    if (yes && !rows().length) addRow($("#r-name").value.trim(), true);
  };
  $("#r-name").addEventListener("input", () => {
    const first = rows()[0];
    if (first && "follow" in first.dataset) { $("[name=member-name]", first).value = $("#r-name").value.trim(); renumber(); }
  });
  rsvp.addEventListener("change", (e) => { if (e.target.name === "attending") sync(); });
  const resetMembers = () => { list.replaceChildren(); sync(); };
  const collectRsvp = (form) => {
    const fd = formData(form);
    return {
      group: fd.group, name: fd.name, attending: fd.attending, website: fd.website, modality: mod?.id,
      transport: fd.attending === "si" ? fd.transport || "" : "",
      members: fd.attending === "si" ? rows().map((li) => ({
        name: $("[name=member-name]", li).value, diet: $("select", li).value, diet_notes: $("[name=member-notes]", li).value,
      })) : [],
    };
  };

  // ---------- Modalidad del enlace: carga SOLO su módulo (lo exclusivo de la otra no llega a esta página) ----------
  // No es un control de acceso: el enlace separa la experiencia. Sin modalidad válida, no se muestra nada exclusivo.
  const wanted = params.get("invitacion");
  let mod = null;
  (MODALITIES.includes(wanted) ? import(`./modalidades/${wanted}.js`).then((m) => m.default) : Promise.resolve(null))
    .then(async (m) => {
      mod = m;
      if (!mod) return noModality();
      const { ICONS, BANK, bankRows } = await import("./modalidades/comun.js");
      renderDay(mod, ICONS);
      renderExtra(mod.extra, bankRows(BANK));
      startCountdown(mod);
      // Enlace directo (#confirmar…): el cronograma y la sección de la modalidad se pintan después del salto al ancla y lo
      // empujan hacia abajo. Chromium lo compensa solo (scroll anchoring); Safari no: se vuelve a llevar al destino
      if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ behavior: "instant" });
      wire(rsvp, collectRsvp, (raw) => validateRsvp(raw, { maxPeople: max }), (p) => api.submitRsvp(p), (form, d) => {
        const thanks = d.attending === "si"
          ? `¡Gracias, ${d.group}! Recibimos su confirmación: ${d.people} ${d.people === 1 ? "persona" : "personas"}.`
          : `Gracias por avisarnos, ${d.group}. Recibimos su respuesta.`;
        finish(form, api.demo
          ? "Así se ve la confirmación. Como es una demostración, esta respuesta no se guardó ni se envió."
          : `${thanks} ${mod.afterRsvp ? mod.afterRsvp + " " : ""}Si necesitan corregir algo, envíen una nueva respuesta: Dolores y Mauro la revisan.`, resetMembers);
      }, rsvpOver ? rsvpOverText : "");
    })
    .catch((err) => { console.error("[invitación] No se pudo cargar la modalidad", err); noModality(); });

  function noModality() {
    $("[data-slot=nomod]").hidden = false;
    $(".band").classList.add("band--plain");
    $(".form__status", rsvp).textContent = "Para confirmar, abrí la invitación desde el enlace que te enviaron.";
  }

  function renderDay(m, icons) {
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    $("[data-slot=band]").innerHTML = m.band.map(([t, s]) => `<li><time datetime="2027-04-03T${t}-03:00">${t}</time> <span>${esc(s)}</span></li>`).join("");
    const mapLink = (href, cls) => `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">Cómo llegar<span class="sr-only"> (se abre en otra pestaña)</span></a>`;
    // Sin cronograma (brindis): un solo bloque con la invitación, horario, lugar y mapa; la lista vacía no queda en la página
    if (m.venue) {
      const v = m.venue, at = (t) => `<time datetime="2027-04-03T${t}-03:00">${t}</time>`, venue = $("[data-slot=venue]");
      $("[data-slot=timeline]").remove();
      venue.innerHTML = `${v.lead ? `<h3 class="venue__lead">${esc(v.lead)}</h3>` : ""}${v.text ? `<p class="venue__text">${esc(v.text)}</p>` : ""}<p class="venue__hours"><span class="sr-only">De </span>${at(v.from)}<span class="venue__rule" aria-hidden="true"></span><span class="sr-only"> a </span>${at(v.to)}</p>
        <p class="venue__place">${esc(v.place)}</p><p class="venue__area">${esc(v.area)}</p>${v.map ? mapLink(v.map, "btn btn--line venue__map") : ""}`;
      venue.hidden = false;
    } else $("[data-slot=timeline]").innerHTML = m.timeline.map((e) => `<li class="tl__item" data-reveal>
      <time class="tl__time" datetime="2027-04-03T${e.time}-03:00">${e.time}</time>
      <span class="tl__icon">${e.svg || icons[e.icon] || ""}</span>
      <div class="tl__body"><h3>${esc(e.title)}</h3>${e.place ? `<p class="tl__place">${esc(e.place)}</p>` : ""}${e.map ? mapLink(e.map, "tl__map") : ""}</div>
    </li>`).join("");
    observe($("#el-dia"));
    const cal = $("[data-slot=cal]");
    $("a", cal).href = m.ics;
    if (m.venue) $(".note", cal).textContent = "Guardá el horario y la ubicación para tenerlos a mano.";
    cal.hidden = false;
  }

  // Copiar al portapapeles: API moderna; si no está o la niegan, el método clásico; si tampoco, false (se selecciona el dato).
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* sigue con el método clásico */ }
    const ta = Object.assign(document.createElement("textarea"), { value: text, readOnly: true });
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    return ok;
  }
  // Datos bancarios: cada dato con su propio botón, aviso «Copiado» y, si el navegador no deja copiar, el dato queda
  // seleccionado para copiarlo a mano. El aviso se lee también con lector de pantalla.
  function bankList(bank) {
    const wrap = Object.assign(document.createElement("div"), { className: "bank-wrap" });
    const dl = Object.assign(document.createElement("dl"), { className: "bank" });
    const status = Object.assign(document.createElement("p"), { className: "bank__status" });
    status.setAttribute("role", "status");
    for (const [k, v] of bank) {
      const row = document.createElement("div");
      const dd = Object.assign(document.createElement("dd"), { textContent: v });
      const copy = Object.assign(document.createElement("button"), { type: "button", className: "bank__copy", textContent: "Copiar" });
      copy.setAttribute("aria-label", `Copiar ${k}`);
      let timer;
      copy.addEventListener("click", async () => {
        const ok = await copyText(v);
        clearTimeout(timer);
        if (ok) {
          copy.textContent = "Copiado";
          copy.classList.add("is-done");
          status.textContent = `${k} copiado.`;
        } else {
          const r = document.createRange();
          r.selectNodeContents(dd);
          getSelection().removeAllRanges();
          getSelection().addRange(r);
          status.textContent = `No se pudo copiar solo: el ${k.toLowerCase() === "alias" ? "alias" : "número"} quedó seleccionado para que lo copies.`;
        }
        timer = setTimeout(() => { copy.textContent = "Copiar"; copy.classList.remove("is-done"); status.textContent = ""; }, 2500);
      });
      row.append(Object.assign(document.createElement("dt"), { textContent: k }), dd, copy);
      dl.append(row);
    }
    wrap.append(dl, status);
    return wrap;
  }

  // Condiciones de pago de esa invitación (payment.lines: los textos vienen del módulo de la invitación). El botón lleva a
  // UN solo número (sin número, no hay botón); el mensaje precargado no tiene datos personales. Nada dice ni insinúa que el
  // sitio verifique pagos ni que el envío acredite nada.
  // Solo con el backend de producción (config.js mode "http") el botón abre la conversación real. En demo o revisión muestra
  // el mensaje preparado en un diálogo y no escribe a nadie. Lo decide la configuración publicada, no un parámetro de la URL.
  function paymentTerms(p, el) {
    if (!p) return [];
    const out = [], lines = p.lines || [];
    if (lines.length) out.push(el("p", "terms", lines.join(" ")));
    if (p.receiptCta && /^\d{10,15}$/.test(p.whatsapp || "")) {
      if (p.receiptHint) out.push(el("p", "terms__hint", p.receiptHint));
      if (backend.kind === "http") {
        const a = el("a", "btn btn--line terms__wa", p.receiptCta);
        Object.assign(a, { href: `https://wa.me/${p.whatsapp}?text=${encodeURIComponent(p.receiptText || "")}`, target: "_blank", rel: "noopener" });
        a.append(el("span", "sr-only", " (se abre en otra pestaña)"));
        out.push(a);
      } else out.push(...messagePreview(p, el));
    }
    return out;
  }

  function messagePreview(p, el) {
    const btn = Object.assign(el("button", "btn btn--line terms__wa", p.receiptCta), { type: "button" });
    btn.setAttribute("aria-haspopup", "dialog");
    const dlg = el("dialog", "msg-preview");
    dlg.setAttribute("aria-labelledby", "msg-preview-title");
    const title = Object.assign(el("h3", "msg-preview__title", p.preview?.title || ""), { id: "msg-preview-title" });
    const close = Object.assign(el("button", "btn btn--solid msg-preview__close", "Cerrar"), { type: "button" });
    dlg.append(title, el("p", "msg-preview__note", p.preview?.note || ""), el("pre", "msg-preview__text", p.receiptText || ""), close);
    btn.addEventListener("click", () => dlg.showModal());
    close.addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); // tocar el fondo cierra
    dlg.addEventListener("close", () => btn.focus());
    return [btn, dlg];
  }

  function renderExtra(x, bank) {
    const box = $("[data-slot=extra]");
    if (!x) return;
    box.id = x.id;
    box.setAttribute("aria-labelledby", `${x.id}-title`);
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    // Mismo encabezado que el resto: rótulo (el título de la sección) y una línea grande (el importe o una frase)
    const head = el("div", "head");
    head.dataset.reveal = "";
    const h = el("h2", "eyebrow", x.title);
    h.id = `${x.id}-title`;
    head.append(h);
    if (x.price) {
      const p = el("p", "display contribution__price", x.price);
      p.append(el("span", "contribution__note", x.priceNote));
      head.append(p);
    }
    if (x.lead) head.append(el("p", "display contribution__lead", x.lead));
    const parts = [head];
    // Con pasos, la introducción menciona los datos: sin datos verificados no se muestra (nunca remite a una cuenta ausente)
    for (const t of x.steps && !bank ? [] : x.paragraphs || []) parts.push(el("p", "contribution__text", t));
    const pending = () => el("p", "tbd", "Pendiente: datos bancarios de la fuente verificada (bloquea la publicación).");
    if (x.steps) {
      // Pasos numerados; el que lleva la cuenta solo la muestra con datos verificados (nunca remite a una cuenta ausente)
      const ol = el("ol", "steps");
      ol.dataset.reveal = "";
      x.steps.forEach((s, i) => {
        const li = el("li", "steps__item fx");
        li.append(el("span", "steps__n", String(i + 1)));
        const body = el("div", "steps__body");
        body.append(el("h3", "steps__title", s.title));
        if (!s.bank || bank) body.append(el("p", "steps__text", s.text));
        if (s.link) body.append(Object.assign(el("a", "steps__link", s.link.label), { href: s.link.href }));
        if (s.bank) body.append(bank ? bankList(bank) : pending());
        if (s.bank && bank) body.append(...paymentTerms(x.payment, el)); // sin cuenta verificada, tampoco condiciones de pago
        li.append(body);
        ol.append(li);
      });
      parts.push(ol);
    } else if (bank) parts.push(bankList(bank));
    else {
      // Sin datos verificados no hay bloque bancario; una sección sin importe tampoco se muestra en la vista pública.
      parts.push(pending());
      if (!x.price) box.toggleAttribute("data-pending", true);
    }
    if (x.closing) parts.push(el("p", "contribution__closing", x.closing));
    box.replaceChildren(...parts);
    box.hidden = false;
    observe(box);
  }

  // ---------- Cuenta regresiva: los días que faltan (de calendario, en Argentina). Cada 30 s; se pausa con la pestaña oculta ----------
  function startCountdown(m) {
    const cd = $(".countdown"), target = Date.parse(m.start);
    cd.setAttribute("aria-label", `Cuenta regresiva hasta ${m.startLabel}`);
    let timer;
    const tick = () => {
      const left = target - Date.now();
      if (left <= 0) {
        // El día y después: un texto que no envejece mal, legible también por lectores de pantalla
        cd.textContent = left > -12 * 3600 * 1000 ? "¡Hoy es el día!" : "Gracias por acompañarnos";
        cd.removeAttribute("role");
        cd.removeAttribute("aria-label");
        clearInterval(timer);
        return;
      }
      const d = daysUntil(target, Date.now());
      if (d <= 1) return void (cd.textContent = d === 1 ? "¡Es mañana!" : "¡Hoy es el día!");
      $("[data-cd=d]", cd).textContent = d;
    };
    const run = () => { clearInterval(timer); if (!document.hidden) { tick(); timer = setInterval(tick, 30000); } };
    document.addEventListener("visibilitychange", run);
    run();
    cd.classList.add("is-ready");
  }

  // ---------- Mensajes aprobados en rotación (contenido dinámico) ----------
  const wall = $(".wall");
  const quote = $(".wall__quote", wall);
  let msgs = [], mi = 0, rot;
  const paintMsg = () => {
    const m = msgs[mi];
    $("blockquote", quote).textContent = m.text; // textContent: el contenido de invitados nunca se interpreta como HTML
    $("figcaption", quote).textContent = m.name;
    $(".wall__pos", wall).textContent = `${mi + 1} / ${msgs.length}`;
    quote.classList.remove("is-new");
    void quote.offsetWidth;
    quote.classList.add("is-new");
  };
  const step = (d) => { mi = (mi + d + msgs.length) % msgs.length; paintMsg(); };
  // La rotación se pausa al pasar el puntero, al enfocar, con el botón Pausar o al navegar a mano (WCAG 2.2.2).
  const pause = $(".wall__pause", wall);
  let held = false;
  const engaged = () => wall.matches(":hover") || wall.contains(document.activeElement);
  const stop = () => clearInterval(rot);
  const play = () => { stop(); if (msgs.length > 1 && !reduced.matches && !document.hidden && !held && !engaged()) rot = setInterval(() => step(1), CONFIG.rotateEvery); };
  const hold = (on) => { held = on; pause.setAttribute("aria-pressed", on); pause.textContent = on ? "Reanudar" : "Pausar"; on ? stop() : play(); };
  pause.addEventListener("click", () => hold(!held));
  $(".wall__prev", wall).addEventListener("click", () => { step(-1); hold(true); });
  $(".wall__next", wall).addEventListener("click", () => { step(1); hold(true); });
  wall.addEventListener("pointerenter", stop);
  wall.addEventListener("focusin", stop);
  wall.addEventListener("pointerleave", () => { if (!wall.contains(document.activeElement)) play(); });
  wall.addEventListener("focusout", (e) => { if (!wall.contains(e.relatedTarget) && !wall.matches(":hover")) play(); });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : play()));
  reduced.addEventListener?.("change", () => { pause.hidden = msgs.length < 2 || reduced.matches; play(); });
  if (!api) wall.hidden = true;
  else api.getMessages().then((list) => {
    msgs = list;
    wall.dataset.state = msgs.length ? "ready" : "empty";
    $(".wall__nav", wall).hidden = msgs.length < 2;
    pause.hidden = msgs.length < 2 || reduced.matches;
    if (msgs.length) { paintMsg(); play(); }
  }).catch(() => { wall.dataset.state = "error"; });
}
