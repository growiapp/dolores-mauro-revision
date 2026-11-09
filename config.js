export const CONFIG = {
  mode: "demo",
  apiBase: null,
  transport: "text",       // Apps Script: text/plain evita la verificación previa CORS (validado en 2B.1–2B.3)
  routeStyle: "query",     // Apps Script publica una sola URL: ?route=rsvp
  requestTimeoutMs: 30000, // validado en 2B.3 con el lock de 20 s: no reducir
  demoHosts: ["growiapp.github.io"], // vista previa privada (build-preview.mjs)

  rsvpMaxPeople: 10,

  rotateEvery: 8000,

  music: { src: null, listenUrl: "https://open.spotify.com/playlist/4Cs5jVekV4gS03QL88cIHg", collaborateUrl: "https://open.spotify.com/playlist/4Cs5jVekV4gS03QL88cIHg?si=AaJmz9IBQaGhYgwIbMUtEw&utm_source=copy-link&pt=2a5ba5b58d50fc23a58424732c2ae78a&pi=PXByfvXPQCG4r", collaborateUntil: "2026-11-16T21:54:14.030Z", platform: "Spotify", suggestUrl: null },
};
