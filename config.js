// Configuración pública del sitio. Nunca poner credenciales acá: este archivo se publica tal cual.
export const CONFIG = {
  // Backend. "demo": memoria de la pestaña; solo se activa en localhost/127.0.0.1 o en `demoHosts`.
  // "http": backend real; `apiBase` debe ser https://… o una ruta del mismo origen ("/api").
  // Si la configuración no es válida, los formularios quedan deshabilitados (nunca cae en demo sin avisar).
  //
  // Producción: Google Apps Script. Para ACTIVARLA, después del despliegue y la prueba con datos ficticios
  // (deliverables/evolucion-v2/activacion.md), cambiar solo: mode: "http" y apiBase: "<URL /exec del despliegue>".
  mode: "demo",
  apiBase: null,
  transport: "text",       // Apps Script: text/plain evita la verificación previa CORS (validado en 2B.1–2B.3)
  routeStyle: "query",     // Apps Script publica una sola URL: ?route=rsvp
  requestTimeoutMs: 30000, // validado en 2B.3 con el lock de 20 s: no reducir
  demoHosts: ["growiapp.github.io"], // vista previa privada (build-preview.mjs)

  // Máximo de personas por respuesta de un grupo. Tiene que coincidir con Config maximo_personas de la planilla.
  rsvpMaxPeople: 10,

  // Rotación de mensajes aprobados (ms). Se desactiva con prefers-reduced-motion.
  rotateEvery: 8000,

  // Música. src: audio de fondo SOLO con permiso de uso (archivo propio o licenciado; nunca descargado de Spotify).
  // Mientras sea null no aparece el botón. Nunca suena sola: la inicia el invitado.
  //
  // Playlist del casamiento: dos enlaces DISTINTOS, ambos https y confirmados por Dolores y Mauro.
  //   listenUrl: el enlace público de la playlist. Solo permite ESCUCHARLA (no da permiso para sumar canciones).
  //   collaborateUrl + collaborateUntil: el enlace de invitación a colaborar y su vencimiento (fecha y hora ISO).
  //     En Spotify ese enlace se genera desde la playlist («Invitar colaboradores») y vale 7 días: poner como vencimiento
  //     la fecha en que se generó + 7 días. Vencido, el sitio deja de ofrecer «Sumar canciones» solo (sin republicar) y
  //     queda, si existe, «Escuchar la playlist». Quien ya se unió sigue pudiendo agregar canciones.
  //   platform: nombre para el aviso «necesitás una cuenta de …» (p. ej. "Spotify"). Los textos no se deducen del dominio.
  // Sin ningún enlace vigente, la sección «Playlist» no aparece en la vista pública.
  music: { src: null, listenUrl: null, collaborateUrl: null, collaborateUntil: null, platform: null },
};
