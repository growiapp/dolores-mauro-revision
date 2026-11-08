// Modalidad CON COSTO (enlace ?invitacion=celebracion): desde la recepción; tarjeta con importe y datos para transferir.
// Solo lo propio de esta modalidad: este archivo llega únicamente a quien abre este enlace.
import { DESDE_RECEPCION } from "./comun.js";

export default {
  id: "celebracion",
  start: "2027-04-03T12:30:00-03:00", // cuenta regresiva: recepción (Argentina, UTC-3)
  startLabel: "la recepción del 3 de abril de 2027 a las 12:30",
  ics: "public/casamiento-celebracion.ics",
  band: [["12:30", "Recepción · Finca Los Churquis, Volcán"], ["13:00", "Ceremonia civil · Finca Los Churquis"]],
  timeline: DESDE_RECEPCION,
  // Tarjeta. Valor por persona, fijo: no depende de cuántas personas se confirmen en el formulario.
  extra: {
    id: "tarjeta", title: "Tarjeta",
    price: "$180.000", priceNote: "por persona",
    // La línea de transferencia solo se muestra junto a los datos bancarios (main.js): nunca remite a una cuenta ausente
    transfer: "Podés abonarla por transferencia a la cuenta de abajo.",
    paragraphs: ["Confirmar la asistencia y abonar la tarjeta son pasos separados."],
  },
  afterRsvp: "Confirmar la asistencia y abonar la tarjeta son pasos separados.",
};
