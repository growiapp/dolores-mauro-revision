import { DESDE_RECEPCION } from "./cronograma.js";
import { tarjeta, PAGO, DESPUES_DE_CONFIRMAR } from "./tarjeta.js";

export default {
  id: "celebracion",
  start: "2027-04-03T12:30:00-03:00", // cuenta regresiva: recepción (Argentina, UTC-3)
  startLabel: "la recepción del 3 de abril de 2027 a las 12:30",
  ics: "public/casamiento-celebracion.ics",
  band: [["12:30", "Recepción · Finca Los Churquis, Volcán"], ["13:00", "Ceremonia civil · En la finca"]],
  timeline: DESDE_RECEPCION,
  extra: tarjeta("$180.000", PAGO.celebracion),
  afterRsvp: DESPUES_DE_CONFIRMAR,
};
