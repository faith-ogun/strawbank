// The honesty-box IOU, through PayPal Invoicing. Real honesty boxes take IOU
// notes; Strawbank's is a PayPal invoice. A customer with no PayPal to hand
// leaves an email address; code prices the counted basket exactly as an order
// would be priced; PayPal sends the invoice and holds the record. Paying it
// through PayPal, or the grower recording cash, closes it. Until then the
// dusk report counts its items as a payment on its way, never as walked.
// The model plays no part here.

import { type Currency, paypalAmount } from "./money";
import { type OrderLine, orderTotalMinor } from "./orders";

/** PayPal's own invoice statuses that Strawbank acts on. */
export type InvoiceStatus = "DRAFT" | "SENT" | "SCHEDULED" | "UNPAID" | "PARTIALLY_PAID" | "PAID" | "MARKED_AS_PAID" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "MARKED_AS_REFUNDED" | "PAYMENT_PENDING";

export type Iou = {
  invoiceId: string;
  standId: string;
  date: string;
  lines: OrderLine[];
  totalMinor: number;
  currency: Currency;
  /** Enough for the grower to recognise it ("a…@gmail.com"); PayPal holds the address itself. */
  maskedEmail: string;
  status: InvoiceStatus;
  /** PayPal's page where the customer pays the invoice. */
  payUrl?: string;
  countId?: string;
  createdAt: string;
  paidBy?: "paypal" | "cash";
};

/** How the dusk report counts an IOU: paid, on its way, or not owed. */
export function iouPayment(status: InvoiceStatus): "confirmed" | "pending" | "unpaid" {
  if (status === "PAID" || status === "MARKED_AS_PAID") return "confirmed";
  if (status === "CANCELLED" || status === "REFUNDED" || status === "MARKED_AS_REFUNDED" || status === "DRAFT") return "unpaid";
  return "pending";
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/;

export function isEmail(text: string): boolean {
  return EMAIL.test(text) && text.length <= 254;
}

/** "anna@example.com" -> "a…@example.com". */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}…@${domain}`;
}

export type InvoiceBody = {
  detail: {
    currency_code: Currency;
    invoice_date: string;
    reference: string;
    note: string;
    payment_term: { term_type: "NET_10" };
  };
  invoicer: { business_name: string };
  primary_recipients: [{ billing_info: { email_address: string } }];
  items: { name: string; quantity: string; unit_amount: { currency_code: Currency; value: string }; unit_of_measure: "QUANTITY" }[];
  configuration: { allow_tip: false; partial_payment: { allow_partial_payment: false }; tax_inclusive: false };
};

/** The Invoicing v2 body for an IOU: the same lines and prices the order would have had. */
export function invoiceBody(input: { lines: OrderLine[]; currency: Currency; email: string; standName: string; standId: string; date: string }): InvoiceBody {
  if (input.lines.length === 0 || orderTotalMinor(input.lines) <= 0) throw new RangeError("an IOU needs something in the basket");
  return {
    detail: {
      currency_code: input.currency,
      invoice_date: input.date,
      reference: `${input.standId}/${input.date}`,
      note: `Your IOU from the honesty box at ${input.standName}, ${input.date}. Thank you for being honest.`,
      payment_term: { term_type: "NET_10" },
    },
    invoicer: { business_name: input.standName },
    primary_recipients: [{ billing_info: { email_address: input.email } }],
    items: input.lines.map((line) => ({
      name: line.name.replace(/, each$/i, ""),
      quantity: String(line.quantity),
      unit_amount: paypalAmount(line.unitMinor, input.currency),
      unit_of_measure: "QUANTITY",
    })),
    configuration: { allow_tip: false, partial_payment: { allow_partial_payment: false }, tax_inclusive: false },
  };
}
