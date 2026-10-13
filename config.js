// Configuración pública del sitio. Nunca poner credenciales acá: este archivo se publica tal cual.
export const CONFIG = {
  // Ceremonia confirmada (Datos boda Dolores y Mauro.txt). Argentina: UTC-3, sin horario de verano.
  countdownTarget: "2027-04-03T11:00:00-03:00",

  // Backend. "demo": memoria de la pestaña; solo se activa en localhost/127.0.0.1 o en `demoHosts`.
  // "http": backend real; `apiBase` debe ser https://… o una ruta del mismo origen ("/api").
  // Si la configuración no es válida, los formularios quedan deshabilitados (nunca cae en demo sin avisar).
  //
  // Producción (fase 2B.4): Google Apps Script. Para ACTIVARLA, después del despliegue y la prueba previa al lanzamiento
  // (deliverables/phase2b-backend/deploy.md), cambiar solo: mode: "http" y apiBase: "<URL /exec del despliegue>".
  mode: "demo",
  apiBase: null,
  transport: "text",       // Apps Script: text/plain evita la verificación previa CORS (validado en 2B.1–2B.3)
  routeStyle: "query",     // Apps Script publica una sola URL: ?route=rsvp
  requestTimeoutMs: 30000, // validado en 2B.3 con el lock de 20 s: no reducir
  demoHosts: ["growiapp.github.io"], // vista previa privada (build-preview.mjs)

  // Publicación de nombres de confirmados: decisión de la pareja, PENDIENTE. Mientras sea false
  // no se pide el permiso ni se muestran nombres; el contador de personas sí se muestra.
  publicNames: false,

  // Tope técnico de personas por respuesta (la política de acompañantes está pendiente).
  rsvpMaxPeople: 10,

  // Rotación de mensajes aprobados (ms). Se desactiva con prefers-reduced-motion.
  rotateEvery: 8000,
};
