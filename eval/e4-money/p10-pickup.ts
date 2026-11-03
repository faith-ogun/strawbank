import fc from "fast-check";
import { buildLines, createOrderBody } from "../../src/lib/orders";
import { toOrderRequest } from "../../src/lib/paypal/orders";
import { assert, catalogueArb, currencyArb, moneyProperty } from "./shared";

// Nothing a stand sells is shipped: the customer takes it off the shelf. So
// every order tells PayPal so, in PayPal's own field for it: fulfilment type
// PICKUP_IN_STORE (which PayPal says keeps Seller Protection), at the stand's
// own name and address, in the wire body and in the SDK request alike. No
// made-up tracking number, and never "SHIPPING".

const placeArb = fc.record({
  line1: fc.stringMatching(/^[A-Za-z0-9 ,.'-]{1,60}$/),
  town: fc.stringMatching(/^[A-Za-z .'-]{1,40}$/),
  country: fc.constantFrom("IE", "GB", "US"),
});

const collectedAtTheStand = fc.property(
  catalogueArb,
  currencyArb,
  placeArb,
  fc.stringMatching(/^[A-Za-z][A-Za-z ']{0,40}$/),
  (catalogue, currency, place, standName) => {
    const lines = buildLines(catalogue, { [catalogue[0].key]: 1 });
    const body = createOrderBody(lines, currency, "ref", "stand/2026-11-03", { name: standName, ...place });
    const shipping = body.purchase_units[0].shipping;
    assert(shipping?.type === "PICKUP_IN_STORE", `the order says ${shipping?.type}, not a pickup at the stand`);
    assert(shipping.name.full_name === standName, "the pickup names someone else");
    assert(
      shipping.address.address_line_1 === place.line1 && shipping.address.admin_area_2 === place.town && shipping.address.country_code === place.country,
      "the pickup address is not the stand's",
    );

    const sent = toOrderRequest(body, { returnUrl: "https://example.test/ok", cancelUrl: "https://example.test/no" }).purchaseUnits[0].shipping;
    assert(String(sent?.type) === "PICKUP_IN_STORE", "the SDK request lost the pickup");
    assert(sent?.name?.fullName === standName, "the SDK request names someone else");
    assert(sent?.address?.addressLine1 === place.line1 && sent.address.adminArea2 === place.town && sent.address.countryCode === place.country, "the SDK request has another address");
  },
);

export const p10 = [moneyProperty("E4.12", "Every order tells PayPal the goods were collected at the stand, at the stand's own address", collectedAtTheStand)];
