import { CONFIG } from "./config.js";
import { validateRsvp, validateMessage, createHttpAdapter, createDemoAdapter, createRequestKeeper, resolveBackend } from "./api.js";
import { bodyBytes, LIMITS } from "./contract.js";

// Cuenta regresiva a la ceremonia confirmada: 3/4/2027 11:00 (Argentina, UTC-3, sin horario de verano)
const TARGET = Date.parse(CONFIG.countdownTarget);

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

  // ---------- Cuenta regresiva (sin segundos: cada 30 s alcanza; se pausa con la pestaña oculta) ----------
  const cd = $(".countdown");
  const cells = $$("[data-cd]");
  const tick = () => {
    const left = TARGET - Date.now();
    if (left <= 0) {
      // El día de la ceremonia y después: un texto que no envejece mal, legible también por lectores de pantalla
      cd.textContent = left > -12 * 3600 * 1000 ? "¡Hoy es el día!" : "Gracias por acompañarnos";
      cd.removeAttribute("role");
      cd.removeAttribute("aria-label");
      clearInterval(timer);
      return;
    }
    const p = parts(left);
    for (const el of cells) el.textContent = p[el.dataset.cd];
  };
  let timer;
  const run = () => { clearInterval(timer); if (!document.hidden) { tick(); timer = setInterval(tick, 30000); } };
  document.addEventListener("visibilitychange", run);
  run();

  // ---------- Revelado de fotos (una vez). Sin JS quedan visibles: la clase .js se agrega arriba ----------
  const io = new IntersectionObserver((entries) => {
    // También lo que ya quedó arriba: con un scroll rápido o un salto de ancla, una foto puede no llegar a "intersectar".
    for (const e of entries) if (e.isIntersecting || e.boundingClientRect.top < 0) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -12% 0px" });
  $$("[data-reveal]").forEach((el) => io.observe(el));

  // ---------- Botón fijo "Confirmar" (móvil): después de la portada, oculto en la sección RSVP ----------
  const fab = $(".fab"), hero = $(".hero"), rsvpSection = $("#confirmar");
  const seen = new Map();
  const fabIO = new IntersectionObserver((entries) => {
    for (const e of entries) seen.set(e.target, e.isIntersecting);
    fab.classList.toggle("is-shown", !seen.get(hero) && !seen.get(rsvpSection));
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


  // ---------- Persistencia: backend configurado, demostración local o falla cerrada ----------
  const backend = resolveBackend(CONFIG, location.hostname);
  const api = backend.kind === "http"
    ? createHttpAdapter(CONFIG.apiBase, { transport: CONFIG.transport, routeStyle: CONFIG.routeStyle, timeoutMs: CONFIG.requestTimeoutMs })
    : backend.kind === "demo"
      ? createDemoAdapter({ fail: review && params.has("falla"), fixtures: review, publishNames: CONFIG.publicNames })
      : null;
  if (api?.demo) $$(".demo-note").forEach((el) => { el.hidden = false; });
  if (!api) console.error(`[invitación] Formularios deshabilitados: ${backend.reason}`);

  // Formularios: quedan deshabilitados sin JS o sin backend válido; acá se habilitan.
  // Con el botón que envió (submitter): así viaja su name/value, como publish=on en mensajes.
  const formData = (form, submitter) => {
    const fd = new FormData(form, submitter), out = {};
    for (const [k, v] of fd) out[k] = k in out ? [].concat(out[k], v) : v;
    return out;
  };
  const showErrors = (form, errors) => {
    for (const field of $$("[data-field]", form)) {
      const msg = errors[field.dataset.field] || "";
      $(".field__err", field).textContent = msg;
      $$("input, textarea", field).forEach((el) => el.toggleAttribute("aria-invalid", !!msg));
    }
    const first = $$("[data-field]", form).find((f) => errors[f.dataset.field] && !f.hidden);
    if (first) $("input, textarea", first).focus();
  };
  // Mensajes según el tipo de error: "rechazado" es definitivo; los inciertos invitan a reintentar sin riesgo de duplicar.
  const failText = (err) => {
    if (err?.kind === "rejected") {
      if (err.code === "rate_limited") return "Recibimos muchos envíos seguidos. Esperá unos minutos y probá de nuevo.";
      if (err.code === "invalid") return "No pudimos registrar los datos. Revisá los campos marcados.";
      if (err.code === "payload_too_large") return "El texto es demasiado largo. Acortalo y probá de nuevo.";
      if (err.code === "closed") return "Este formulario ya no recibe respuestas.";
      return "No pudimos registrar tu respuesta. Probá de nuevo en unos minutos.";
    }
    if (err?.kind === "timeout" || err?.kind === "invalid_response") {
      return "No pudimos confirmar si llegó. Podés volver a enviarla: si ya se había registrado, no se duplica.";
    }
    return "No pudimos enviarlo. Tus datos siguen acá: revisá tu conexión y probá de nuevo.";
  };
  const wire = (form, validate, submit, done) => {
    const body = $(".form__body", form), status = $(".form__status", form), btn = $("button[type=submit]", form);
    if (!api) { status.textContent = "Esta función todavía no está habilitada."; return; }
    const keeper = createRequestKeeper();
    form.addEventListener("reset", () => keeper.settle());
    body.disabled = false;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = formData(form, e.submitter);
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
  const finish = (form, text) => {
    const panel = form.nextElementSibling;
    $(".form__done-text", panel).textContent = text;
    form.hidden = true;
    panel.hidden = false;
    panel.focus();
    $(".form__again", panel).onclick = () => {
      form.reset();
      form.dispatchEvent(new Event("change"));
      $$("textarea", form).forEach((t) => t.dispatchEvent(new Event("input")));
      panel.hidden = true;
      form.hidden = false;
      $("input", form).focus();
    };
  };

  // RSVP
  const rsvp = $("#rsvp-form");
  const ifYes = $(".if-yes", rsvp), people = $("#r-people"), dietOther = $("#r-diet-otra"), dietNotes = $("[data-field=diet_notes]", rsvp);
  people.max = CONFIG.rsvpMaxPeople;
  // El permiso para mostrar el nombre solo se pide si la pareja activó la publicación de nombres.
  $("[data-field=show_name]", rsvp).hidden = !CONFIG.publicNames;
  const sync = () => {
    ifYes.hidden = rsvp.elements.attending.value !== "si";
    dietNotes.hidden = !dietOther.checked;
  };
  rsvp.addEventListener("change", sync);
  sync();
  wire(rsvp, (raw) => validateRsvp(raw, { maxPeople: CONFIG.rsvpMaxPeople, publicNames: CONFIG.publicNames }), (p) => api.submitRsvp(p), (form, d) => {
    finish(form, api.demo
      ? "Así se ve la confirmación. Como es una demostración, esta respuesta no se guardó ni se envió."
      : `${d.attending === "si" ? `¡Gracias, ${d.name}! Recibimos tu confirmación.` : `Gracias por avisarnos, ${d.name}. Recibimos tu respuesta.`} Si necesitás corregir algo, enviá una nueva respuesta: Dolores y Mauro la revisan.`);
    loadStats();
  });

  // Mensajes
  const msgForm = $("#msg-form");
  const msgText = $("#m-text"), msgCount = $(".field__count", msgForm);
  const count = () => { msgCount.textContent = `${Array.from(msgText.value).length} / 500`; };
  msgText.addEventListener("input", count);
  count();
  wire(msgForm, validateMessage, (p) => api.submitMessage(p), (form) => {
    finish(form, api.demo
      ? "Así se ve el envío de un mensaje. Como es una demostración, no se guardó ni se envió."
      : "¡Gracias! Tu mensaje les llega a Dolores y Mauro y aparece acá cuando lo aprueben.");
    count();
  });

  // ---------- Confirmados visibles y contador (agregado; nombres solo con regla activa y consentimiento) ----------
  const statsEl = $(".attendance");
  let statsSeq = 0, statsShown = "";
  async function loadStats() {
    if (!api) return;
    const seq = ++statsSeq;
    try {
      const { people: n, names } = await api.getStats();
      if (seq !== statsSeq) return; // una respuesta vieja nunca pisa a una nueva
      statsEl.dataset.state = "ready"; // también recupera el estado después de un error
      // Solo se repinta si cambió: evita re-anuncios de aria-live al volver a la sección
      const sig = JSON.stringify([n, names]);
      if (sig === statsShown) return;
      statsShown = sig;
      $("[data-count]", statsEl).textContent = n;
      $(".attendance__label", statsEl).textContent = n === 1 ? "persona confirmó su asistencia" : "personas confirmaron su asistencia";
      const list = $(".attendance__names", statsEl);
      list.replaceChildren(...names.map((name) => Object.assign(document.createElement("li"), { textContent: name })));
      list.hidden = names.length === 0;
      $(".attendance__empty", statsEl).hidden = n > 0;
      $(".attendance__count", statsEl).hidden = n === 0;
    } catch {
      if (seq === statsSeq) statsEl.dataset.state = "error";
    }
  }
  if (api) new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) loadStats(); }).observe(statsEl);
  else statsEl.hidden = true;

  // ---------- Mensajes aprobados en rotación (contenido dinámico) ----------
  const wall = $(".wall");
  const quote = $(".wall__quote", wall);
  let msgs = [], mi = 0, rot;
  const paint = () => {
    const m = msgs[mi];
    $("blockquote", quote).textContent = m.text; // textContent: el contenido de invitados nunca se interpreta como HTML
    $("figcaption", quote).textContent = m.name;
    $(".wall__pos", wall).textContent = `${mi + 1} / ${msgs.length}`;
    quote.classList.remove("is-new");
    void quote.offsetWidth;
    quote.classList.add("is-new");
  };
  const step = (d) => { mi = (mi + d + msgs.length) % msgs.length; paint(); };
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
    if (msgs.length) { paint(); play(); }
  }).catch(() => { wall.dataset.state = "error"; });
}
