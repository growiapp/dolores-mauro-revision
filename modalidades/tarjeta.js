
export const WHATSAPP = "5493884043368";

const LIMITE_PAGO = "2027-02-15";
const mensaje = (invitacion, cuotas) => ["¡Hola! Les comparto el comprobante de transferencia de la tarjeta de Dolores y Mauro.", "",
  `Invitación: ${invitacion}.`, "", "Nombre y apellido de las personas incluidas en este pago:", "1.", "", "Importe transferido: $",
  ...(cuotas ? ["", "Cuota (si corresponde):"] : [])].join("\n");
const COMPROBANTE = { whatsapp: WHATSAPP, receiptCta: "Enviar comprobante por WhatsApp",
  receiptHint: "En WhatsApp, completá los nombres de las personas incluidas en el pago y adjuntá el comprobante.",
  preview: { title: "Vista previa del mensaje", note: "Esto es una demostración: no se abre WhatsApp ni se envía nada. En la invitación definitiva, este botón abre WhatsApp con este mensaje listo para completar y adjuntar el comprobante." } };
const largo = (iso) => new Date(`${iso}T12:00:00-03:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
const condiciones = ({ installments, surcharge, deadline }) => [
  Number.isInteger(installments) && installments >= 2 &&
    `Podés abonar la tarjeta por transferencia, en hasta ${installments} cuotas${surcharge === 0 ? " sin recargo" : surcharge > 0 ? `, con un recargo del ${surcharge} %` : ""}.`,
  /^\d{4}-\d{2}-\d{2}$/.test(deadline || "") && `La fecha límite para completar el pago es el ${largo(deadline)}.`,
].filter(Boolean);
const pago = (p, invitacion) => ({ ...p, ...COMPROBANTE, receiptText: mensaje(invitacion, p.installments >= 2), lines: condiciones(p) });
export const PAGO = {
  celebracion: pago({ installments: 3, surcharge: 0, deadline: LIMITE_PAGO }, "Celebración completa"),
  fiesta: pago({ installments: null, surcharge: null, deadline: LIMITE_PAGO }, "Brindis"),
};

export const tarjeta = (price, payment) => ({
  id: "tarjeta", title: "Tarjeta",
  price, priceNote: "por persona",
  paragraphs: ["Confirmá quiénes vienen y acá abajo tenés los datos para la tarjeta."],
  steps: [
    { title: "Confirmación", text: "Una respuesta por familia o grupo, en el formulario de más abajo.", link: { href: "#confirmar", label: "Ir al formulario" } },
    { title: "Transferencia", text: `${price} por persona, a esta cuenta:`, bank: true },
  ],
  payment,
});

export const DESPUES_DE_CONFIRMAR = "La tarjeta se transfiere aparte; los datos están más arriba.";
