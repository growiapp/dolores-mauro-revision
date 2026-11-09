export const CONFIG = {
  mode: "demo",
  apiBase: null,
  transport: "text",       // Apps Script: text/plain evita la verificación previa CORS (validado en 2B.1–2B.3)
  routeStyle: "query",     // Apps Script publica una sola URL: ?route=rsvp
  requestTimeoutMs: 30000, // validado en 2B.3 con el lock de 20 s: no reducir
  demoHosts: ["growiapp.github.io"], // vista previa privada (build-preview.mjs)

  rsvpMaxPeople: 10,

  rotateEvery: 8000,

  music: { src: null, listenUrl: "https://open.spotify.com/playlist/4Cs5jVekV4gS03QL88cIHg", collaborateUrl: null, collaborateUntil: null, platform: "Spotify", suggestUrl: null },
};
