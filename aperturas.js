// Aperturas en revisión (A1 y A2) sobre el sitio real: index.html?apertura=a1|a2 (lo decide el script de la apertura actual,
// que deja data-apertura en <html>). Corre durante el análisis, antes de la portada: muestra el diálogo sin destello.
// Termina exactamente en la portada (la misma foto y el mismo encuadre). Sin localStorage ni sessionStorage.
{
  const root = document.documentElement, which = root.dataset.apertura;
  const tpl = which && document.getElementById(`apertura-${which}`);
  if (tpl) {
    const d = tpl.content.firstElementChild.cloneNode(true), btn = d.querySelector("button");
    tpl.after(d);
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    root.classList.add("sealed", "photo-led"); // la entrada de la portada espera al relevo
    d.showModal(); btn.focus({ preventScroll: true }); // botón real: Enter y Espacio abren; Esc también
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    let hero, img;

    // Geometría de la foto de la portada tal como la pinta el sitio (object-fit: cover + object-position del breakpoint)
    const cover = (fx, fy) => {
      const r = hero.getBoundingClientRect(), pos = getComputedStyle(img).objectPosition;
      const [px, py] = pos.split(" ").map((v) => parseFloat(v) / 100);
      const ratio = (img.naturalWidth || 3) / (img.naturalHeight || 2), h = Math.max(r.width / ratio, r.height), w = h * ratio;
      return { r, pos, x: (r.width - w) * px + fx * w, y: (r.height - h) * py + fy * h };
    };
    const box = (r) => `top:${r.top}px;left:${r.left}px;width:${r.width}px;height:${r.height}px;`;
    const scenes = {
      // A1: el plano general ocupa la portada con su encuadre; la cámara arranca acercada sobre la pareja
      a1: {
        place() {
          const c = cover(0.468, 0.79), wide = d.querySelector(".a1__wide");
          wide.style.cssText = box(c.r) + `--ox:${c.x}px;--oy:${c.y}px`;
          wide.querySelector("img").style.objectPosition = c.pos;
        },
        times: (red) => red ? { reveal: 350, end: 600 } : { reveal: 1250, end: 1660 },
      },
      // A2: la lámina es la portada en chico (mismo archivo, encuadre y proporción), reducida con transform hasta su lugar
      a2: {
        place() {
          const c = cover(0, 0), r = c.r, print = d.querySelector(".a2__print"), slot = d.querySelector(".a2__slot");
          d.style.setProperty("--ar", (r.width / r.height).toFixed(4));
          const s = slot.getBoundingClientRect();
          print.style.cssText = box(r) + `--dx:${s.left - r.left}px;--dy:${s.top - r.top}px;--s:${s.width / r.width}`;
          print.querySelector("img").style.objectPosition = c.pos;
          d.querySelector(".a2__caption").style.cssText = `top:${s.bottom + 18}px;right:${innerWidth - s.right}px`;
          d.classList.add("is-fit");
        },
        times: (red) => red ? { reveal: 300, end: 650 } : { reveal: 1250, end: 1480 },
      },
    };
    const scene = scenes[which];
    const measure = () => {
      hero = document.querySelector(".hero"); img = hero?.querySelector(".hero__media img");
      if (!img) return;
      if (scrollY) scrollTo(0, 0);
      scene.place();
    };
    const fit = () => d.classList.contains("is-opening") || measure();
    const ready = new Promise((res) => document.readyState === "loading" ? addEventListener("DOMContentLoaded", res, { once: true }) : res());
    ready.then(fit);
    ready.then(() => img?.decode?.().catch(() => {})).then(fit);
    document.fonts?.ready.then(fit);
    addEventListener("resize", fit);

    let done = false;
    const finish = () => {
      if (done) return; done = true;
      root.classList.remove("sealed");
      d.close(); d.remove();
      document.querySelector(".hero__names")?.focus({ preventScroll: true }); // el foco sigue a la portada, sin mover la página
    };
    // Relojes sobre la línea de tiempo de animaciones (no setTimeout): siguen a las transiciones si el navegador las ralentiza
    const after = (ms, fn) => document.body.animate([], ms).finished.then(fn);
    const go = async () => {
      if (d.classList.contains("is-opening")) return;
      d.classList.add("is-opening"); // responde al toque ya, aunque la página todavía esté cargando
      await ready;
      measure();
      d.getBoundingClientRect(); // fija el estado de partida antes de la escena
      d.classList.add("is-playing");
      const { reveal, end } = scene.times(reduce.matches);
      after(reveal, () => root.classList.remove("sealed")); // entra el nombre de la portada
      after(end, finish);
    };
    btn.addEventListener("click", go);
    d.addEventListener("cancel", (e) => { e.preventDefault(); go(); });
    d.addEventListener("touchstart", () => {}, { passive: true }); // iOS: habilita :active
  }
}
