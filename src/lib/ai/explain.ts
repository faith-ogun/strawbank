// F3 step 3: the agent's few sentences on the day, written only from numbers
// code computed. The caller shows them only if every number in them is one of
// those numbers (explanationToShow, eval E4.5); otherwise code's own template
// is shown. The model never works anything out here: it puts the table into
// words.

import { generateText } from "ai";
import { type Currency, formatMoney } from "../money";
import type { ItemReconciliation } from "../reconcile";
import { geminiModel } from "./model";

const INSTRUCTIONS = `You write the evening note for the grower of an unstaffed farm stand, from the day's figures, which code has already worked out.

- Two to four short, plain sentences in British English. No headings, lists or emphasis.
- Use only the numbers and amounts given, written exactly as given. Never add, subtract, total or estimate anything yourself, and never use words such as "half", "dozen", "twice" or "double".
- Lead with what matters most: anything unaccounted for, item by item, with its value.
- "Unaccounted for" is the only word for a gap. Never say stolen, theft, thief, dishonest or anything that blames a customer: a gap can be a miscount, a payment still on its way, or a customer who will pay later.
- If an item is marked uncertain, say that its figure is uncertain and why (the shelf count is not sure, or a payment is waiting for PayPal's confirmation), and do not call it missing.
- If nothing is unaccounted for, say so plainly.
- Say "1 potato", "1 egg", "1 jar of jam": the singular for one.`;

export async function explainDay(input: {
  items: ItemReconciliation[];
  currency: Currency;
  takingsMinor: number;
  confirmedPayments: number;
  pendingPayments: number;
}): Promise<string | undefined> {
  const { currency } = input;
  const lines = input.items
    .filter((i) => i.taken !== 0 || i.paid !== 0)
    .map((i) => {
      const why = i.uncertain ? (i.taken < 0 ? "uncertain: the counts do not add up" : "uncertain") : "sure";
      const gap = i.gap > 0 ? `${i.gap} unaccounted for, worth ${formatMoney(i.gapMinor, currency)}` : i.gap < 0 ? `${-i.gap} more paid for than taken` : "nothing unaccounted for";
      return `- ${i.name.replace(/, each$/i, "")}: ${i.taken} taken, ${i.paid} paid for, ${gap} (${why})`;
    });
  const payments = (n: number) => `${n} payment${n === 1 ? "" : "s"}`;
  const facts = [
    input.confirmedPayments > 0
      ? `Takings confirmed by PayPal: ${formatMoney(input.takingsMinor, currency)} from ${payments(input.confirmedPayments)}.`
      : "No payments were confirmed by PayPal today.",
    input.pendingPayments > 0 ? `${payments(input.pendingPayments)} still waiting for PayPal's confirmation.` : "No payments waiting for PayPal.",
    "Per item:",
    ...(lines.length > 0 ? lines : ["- nothing was taken"]),
  ].join("\n");

  try {
    const { text } = await generateText({
      model: geminiModel("careful"),
      providerOptions: { vertex: { thinkingConfig: { thinkingLevel: "low" } }, google: { thinkingConfig: { thinkingLevel: "low" } } },
      maxRetries: 1,
      timeout: { totalMs: 20_000 },
      instructions: INSTRUCTIONS,
      prompt: facts,
    });
    return text.trim() || undefined;
  } catch (error) {
    console.error("dusk explanation failed:", error instanceof Error ? `${error.name}: ${error.message}` : error);
    return undefined;
  }
}
