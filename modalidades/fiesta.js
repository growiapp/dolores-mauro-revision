import { FINCA_MAPA } from "./comun.js";
import { tarjeta, PAGO, DESPUES_DE_CONFIRMAR } from "./tarjeta.js";

export default {
  id: "fiesta",
  start: "2027-04-03T16:00:00-03:00", // cuenta regresiva: llegada a la finca (Argentina, UTC-3)
  startLabel: "el brindis del 3 de abril de 2027 a las 16:00",
  ics: "public/casamiento-fiesta.ics",
  band: [["16:00", "Brindis · Finca Los Churquis, Volcán"]], // como las otras dos: el hito de inicio. El rango completo (16 a 22) está en El día
  venue: {
    lead: "¡Vení a celebrar con nosotros!", text: "Nos encantaría que seas parte de nuestra fiesta. Te esperamos para brindar, bailar y disfrutar juntos.",
    from: "16:00", to: "22:00", place: "Finca Los Churquis", area: "Volcán, Jujuy", map: FINCA_MAPA,
  },
  extra: tarjeta("$80.000", PAGO.fiesta),
  afterRsvp: DESPUES_DE_CONFIRMAR,
};
