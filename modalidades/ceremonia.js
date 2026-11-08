// Modalidad SIN COSTO (enlace ?invitacion=ceremonia): ceremonia religiosa, recepción y el resto del día; sección de regalos.
// Solo lo propio de esta modalidad: este archivo llega únicamente a quien abre este enlace.
import { DESDE_RECEPCION, svg } from "./comun.js";

export default {
  id: "ceremonia",
  start: "2027-04-03T11:30:00-03:00", // cuenta regresiva: ceremonia religiosa (Argentina, UTC-3)
  startLabel: "la ceremonia del 3 de abril de 2027 a las 11:30",
  ics: "public/casamiento-ceremonia.ics",
  band: [["11:30", "Ceremonia religiosa · Tumbaya"], ["12:30", "Recepción · Finca Los Churquis, Volcán"]],
  timeline: [
    // Ubicación verificada por nombre (parroquia Nuestra Señora de los Dolores, Tumbaya): enlace de búsqueda, sin coordenadas
    { time: "11:30", title: "Ceremonia religiosa", place: "Iglesia de Tumbaya",
      svg: svg('<path d="M12 2.5v4M10.3 4.2h3.4M6 21V11.5L12 7l6 4.5V21M4 21h16M10 21v-4.2a2 2 0 0 1 4 0V21"/>'),
      map: "https://www.google.com/maps/search/?api=1&query=Iglesia%20de%20Tumbaya%2C%20Jujuy" },
    ...DESDE_RECEPCION,
  ],
  // Regalos (texto propuesto, a aprobar por Dolores y Mauro). Los datos bancarios salen de comun.js (BANK).
  extra: {
    id: "regalos", title: "Regalos",
    paragraphs: ["Lo más lindo es que estés con nosotros.", "Si además querés hacernos un regalo, te dejamos los datos de nuestra cuenta."],
  },
  afterRsvp: "",
};
