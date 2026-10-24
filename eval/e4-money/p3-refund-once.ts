import fc from "fast-check";
import { scenarioArb, simulate } from "./refund-sim";
import { assert, moneyProperty } from "./shared";

const oneRefundPerRequest = fc.asyncProperty(scenarioArb, async (scenario) => {
  const { paypal, store, results } = await simulate(scenario);
  for (const [key, calls] of paypal.callsByKey) assert(calls <= 1, `${key} reached PayPal ${calls} times`);
  for (const [key, refunds] of paypal.refundsByKey) assert(refunds <= 1, `${key} produced ${refunds} refunds`);
  for (const { requestId, outcome } of results) {
    if (outcome.kind !== "duplicate") continue;
    const record = store.refunds.get(requestId);
    assert(record && record.amountMinor === outcome.record.amountMinor, `a repeat of ${requestId} saw a different refund`);
  }
});

export const p3 = [
  moneyProperty("E4.3", "The same refund request never produces two refunds", oneRefundPerRequest),
];
