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
  if (canAdd || canListen) {
    if (canAdd) Object.assign($(".playlist__add"), { href: music.collaborateUrl, hidden: false });
    if (canListen) Object.assign($(".playlist__listen"), { href: music.listenUrl, hidden: false });
    if (!canAdd) {
      $("#playlist-title").textContent = "La música del casamiento";
      $(".playlist__text").textContent = "Escuchá la playlist del casamiento.";
    } else if (music.platform) Object.assign($(".playlist__note"), { textContent: `Para sumar canciones necesitás una cuenta de ${music.platform}.`, hidden: false });
    $("#playlist").removeAttribute("data-pending");
  }
  if (music.src) {
    const toggle = $(".music-toggle"), audio = new Audio();
    audio.loop = true;
    audio.preload = "none";
    const paint = () => { toggle.setAttribute("aria-pressed", String(!audio.paused)); toggle.classList.toggle("is-playing", !audio.paused); };
    audio.addEventListener("play", paint);
    audio.addEventListener("pause", paint);
    toggle.hidden = false;
    // El navegador solo permite sonido después de una acción del invitado: este toque es esa acción.
    toggle.addEventListener("click", () => {
      if (!audio.paused) return audio.pause();
      if (!audio.src) audio.src = music.src;
      audio.play().catch(() => paint());
    });
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
      return "No pudimos registrar tu respuesta. Probá de nuevo en unos minutos.";
    }
    if (err?.kind === "timeout" || err?.kind === "invalid_response") {
      return "No pudimos confirmar si llegó. Podés volver a enviarla: si ya se había registrado, no se duplica.";
    }
    return "No pudimos enviarlo. Tus datos siguen acá: revisá tu conexión y probá de nuevo.";
  };
  // Formularios: quedan deshabilitados sin JS, sin backend válido o (RSVP) sin modalidad; acá se habilitan.
  const wire = (form, collect, validate, submit, done) => {
    const body = $(".form__body", form), status = $(".form__status", form), btn = $("button[type=submit]", form);
    if (!api) { status.textContent = "Esta función todavía no está habilitada."; return; }
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
      });
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
    $("[data-slot=timeline]").innerHTML = m.timeline.map((e) => `<li class="tl__item" data-reveal>
      <time class="tl__time" datetime="2027-04-03T${e.time}-03:00">${e.time}</time>
      <span class="tl__icon">${e.svg || icons[e.icon] || ""}</span>
      <div class="tl__body"><h3>${esc(e.title)}</h3>${e.place ? `<p class="tl__place">${esc(e.place)}</p>` : ""}${e.map
        ? `<a class="tl__map" href="${esc(e.map)}" target="_blank" rel="noopener">Ver en el mapa<span class="sr-only"> (se abre en otra pestaña)</span></a>` : ""}</div>
    </li>`).join("");
    observe($("[data-slot=timeline]"));
    const cal = $("[data-slot=cal]");
    $("a", cal).href = m.ics;
    cal.hidden = false;
  }

  function renderExtra(x, bank) {
    const box = $("[data-slot=extra]");
    if (!x) return;
    box.id = x.id;
    box.setAttribute("aria-labelledby", `${x.id}-title`);
    // Mismo encabezado que el resto: rótulo (el título de la sección), una línea grande y el texto
    const head = Object.assign(document.createElement("div"), { className: "head" });
    head.dataset.reveal = "";
    const h = Object.assign(document.createElement("h2"), { className: "eyebrow", id: `${x.id}-title`, textContent: x.title });
    const [first, ...rest] = x.paragraphs;
    const lead = document.createElement("p");
    if (x.price) {
      lead.className = "display contribution__price";
      lead.append(x.price, Object.assign(document.createElement("span"), { className: "contribution__note", textContent: x.priceNote }));
    } else Object.assign(lead, { className: "display contribution__lead", textContent: first });
    head.append(h, lead);
    const parts = [head];
    const texts = x.price ? x.paragraphs : rest;
    // La indicación de transferir solo aparece junto a la cuenta: nunca remite a datos que no se muestran
    for (const t of bank && x.transfer ? [x.transfer, ...texts] : texts) parts.push(Object.assign(document.createElement("p"), { className: "contribution__text", textContent: t }));
    if (bank) {
      const dl = document.createElement("dl");
      dl.className = "bank";
      for (const [k, v] of bank) {
        const row = document.createElement("div");
        const copy = Object.assign(document.createElement("button"), { type: "button", className: "bank__copy", textContent: "Copiar" });
        copy.setAttribute("aria-label", `Copiar ${k}`);
        copy.addEventListener("click", () => navigator.clipboard?.writeText(v).then(() => {
          copy.textContent = "Copiado";
          setTimeout(() => { copy.textContent = "Copiar"; }, 2000);
        }, () => {}));
        row.append(Object.assign(document.createElement("dt"), { textContent: k }), Object.assign(document.createElement("dd"), { textContent: v }), copy);
        dl.append(row);
      }
      parts.push(dl);
    } else {
      // Sin datos verificados no hay bloque bancario; una sección sin importe tampoco se muestra en la vista pública.
      // BLOQUEA LA PUBLICACIÓN: ver deliverables/evolucion-v2/pendientes.md
      parts.push(Object.assign(document.createElement("p"), { className: "tbd", textContent: "Pendiente: datos bancarios de la fuente verificada (bloquea la publicación)." }));
      if (!x.price) box.toggleAttribute("data-pending", true);
    }
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
