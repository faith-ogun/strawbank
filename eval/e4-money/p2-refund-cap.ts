import fc from "fast-check";
import { MAX_QUANTITY } from "../../src/lib/orders";
import { MIN_RECOUNT_CONFIDENCE, decideRefund } from "../../src/lib/refunds";
import { scenarioArb, simulate } from "./refund-sim";
import { assert, catalogueArb, moneyProperty } from "./shared";

const claimArb = catalogueArb.chain((catalogue) => {
  const lines = fc
    .tuple(...catalogue.map(() => fc.integer({ min: 1, max: MAX_QUANTITY })))
    .map((qs) => catalogue.map((item, i) => ({ key: item.key, name: item.name, unitMinor: item.unitMinor, quantity: qs[i] })));
  const countsArb = fc
    .tuple(...catalogue.map(() => fc.option(fc.integer({ min: 0, max: MAX_QUANTITY }), { nil: undefined })))
    .map((qs) => Object.fromEntries(catalogue.flatMap((item, i) => (qs[i] === undefined ? [] : [[item.key, qs[i]]]))));
  return fc
    .record({
      lines,
      claimed: countsArb,
      recount: countsArb,
      recountAgrees: fc.boolean(),
      recountConfidence: fc.oneof(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.constantFrom(MIN_RECOUNT_CONFIDENCE, MIN_RECOUNT_CONFIDENCE - 0.01, MIN_RECOUNT_CONFIDENCE - 0.05),
      ),
      refundableMinor: fc.integer({ min: 0, max: 2_000_000 }),
      limitMinor: fc.integer({ min: 0, max: 10_000 }),
      // Often put the limit and what is left within a few cents of the amount due.
      nearDue: fc.option(fc.record({ limit: fc.integer({ min: -3, max: 3 }), left: fc.integer({ min: -3, max: 3 }) })),
    })
    .map(({ nearDue, recountAgrees, ...generated }) => {
      // Half the time the photo backs the claim, so the agent route is tested too.
      const input = recountAgrees ? { ...generated, recount: generated.claimed } : generated;
      if (!nearDue) return input;
      const due = refundDue(input.lines, input.claimed);
      return {
        ...input,
        limitMinor: Math.max(0, due + nearDue.limit),
        refundableMinor: Math.max(0, due + nearDue.left),
      };
    });
});

function refundDue(lines: { key: string; quantity: number; unitMinor: number }[], claimed: Record<string, number>) {
  return lines.reduce((sum, line) => sum + Math.max(0, line.quantity - (claimed[line.key] ?? 0)) * line.unitMinor, 0);
}

const decisionWithinCap = fc.property(claimArb, (input) => {
  const due = refundDue(input.lines, input.claimed);
  const decision = decideRefund(input);
  if (decision.route === "none") return;
  assert(decision.amountMinor > 0, "a refund of nothing was proposed");
  assert(decision.amountMinor <= input.refundableMinor, "refund exceeds what is left on the capture");
  assert(decision.amountMinor <= due, "refund exceeds the difference x the price");
  if (decision.route === "agent") {
    assert(decision.amountMinor <= input.limitMinor, "the agent was allowed a refund over the grower's limit");
    assert(decision.amountMinor === due, "the agent was allowed a capped refund");
    assert(input.recountConfidence >= MIN_RECOUNT_CONFIDENCE, "the agent was allowed to act on an uncertain recount");
    const backed = input.lines.every((line) => {
      const claimed = input.claimed[line.key] ?? 0;
      return claimed >= line.quantity || (input.recount[line.key] ?? 0) <= claimed;
    });
    assert(backed, "the agent was allowed a refund the photo does not support");
  }
});

const refundsWithinCapture = fc.asyncProperty(scenarioArb, async (scenario) => {
  const { captures, store, paypal } = await simulate(scenario);
  assert(paypal.overRefundsRefused === 0, "we asked PayPal for more than was left on a capture");
  for (const capture of captures.values()) {
    const atPayPal = paypal.refunded.get(capture.captureId) ?? 0;
    assert(atPayPal <= capture.amountMinor, `PayPal refunded ${atPayPal} of ${capture.amountMinor}`);
    const recorded = [...store.refunds.values()]
      .filter((r) => r.captureId === capture.captureId && r.status !== "FAILED")
      .reduce((sum, r) => sum + r.amountMinor, 0);
    assert(recorded <= capture.amountMinor, `the ledger holds ${recorded} of refunds on ${capture.amountMinor}`);
    assert(recorded >= atPayPal, "PayPal refunded money our records do not count");
  }
});

export const p2 = [
  moneyProperty(
    "E4.2",
    "A refund decision never exceeds the captured amount minus earlier refunds; the agent acts only within its limit, on a confident recount that backs the claim",
    decisionWithinCap,
  ),
  moneyProperty(
    "E4.2b",
    "Under repeated, concurrent and failing requests, refunds on a capture never exceed what was captured",
    refundsWithinCapture,
  ),
];
