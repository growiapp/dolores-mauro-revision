// Modalidad CON COSTO (enlace ?invitacion=celebracion): desde la recepción; tarjeta con importe y datos para transferir.
// Solo lo propio de esta modalidad: este archivo llega únicamente a quien abre este enlace.
import { DESDE_RECEPCION } from "./comun.js";

export default {
  id: "celebracion",
  start: "2027-04-03T12:30:00-03:00", // cuenta regresiva: recepción (Argentina, UTC-3)
  startLabel: "la recepción del 3 de abril de 2027 a las 12:30",
  ics: "public/casamiento-celebracion.ics",
  band: [["12:30", "Recepción · Finca Los Churquis, Volcán"], ["13:00", "Ceremonia civil · En la finca"]],
  timeline: DESDE_RECEPCION,
  // Tarjeta. Valor por persona, fijo: no depende de cuántas personas se confirmen en el formulario.
  extra: {
    id: "tarjeta", title: "Tarjeta",
    price: "$180.000", priceNote: "por persona",
    // Una línea de introducción y dos pasos, en orden. El segundo lleva los datos bancarios (main.js); sin datos verificados,
    // no se muestra ninguna cuenta. El sitio no verifica pagos: nada lo insinúa
    paragraphs: ["Confirmá quiénes vienen y acá abajo tenés los datos para la tarjeta."],
    steps: [
      { title: "Confirmación", text: "Una respuesta por familia o grupo, en el formulario de más abajo.", link: { href: "#confirmar", label: "Ir al formulario" } },
      { title: "Transferencia", text: "$180.000 por persona, a esta cuenta:", bank: true },
    ],
  },
  afterRsvp: "La tarjeta se transfiere aparte; los datos están más arriba.",
};
