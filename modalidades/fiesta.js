import { FINCA_MAPA } from "./comun.js";
import { tarjeta, PAGO, DESPUES_DE_CONFIRMAR } from "./tarjeta.js";

export default {
  id: "fiesta",
  start: "2027-04-03T16:00:00-03:00", // cuenta regresiva: llegada a la finca (Argentina, UTC-3)
  startLabel: "el brindis del 3 de abril de 2027 a las 16:00",
  ics: "public/casamiento-fiesta.ics",
  band: [["16:00", "a 22:00 · Finca Los Churquis, Volcán"]], // la banda dice el horario completo (no hay cronograma)
  venue: {
    lead: "¡Vení a brindar con nosotros!", text: "Queremos compartir con vos el cierre de un día muy especial.",
    from: "16:00", to: "22:00", place: "Finca Los Churquis", area: "Volcán, Jujuy", map: FINCA_MAPA,
  },
  extra: tarjeta("$80.000", PAGO.fiesta),
  afterRsvp: DESPUES_DE_CONFIRMAR,
};
