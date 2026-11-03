import fc from "fast-check";
import { REPLACED_TEXT, allowedFromConversation, checkedText, toMessages } from "../../src/lib/ai/studio-turn";
import { assert, moneyProperty } from "./shared";

// The ledger's AI assistant (AG Studio's agents on Gemini) writes prose about
// money it never computed, so its words pass the same kind of check as the
// dusk explanation: every number must already be in what the ledger's tools
// returned or in the grower's own question, or code's line replaces the text.
// And Gemini 3 rejects a conversation whose calls and results are out of
// order, so the regrouping that puts them right is checked too.

const amount = fc.integer({ min: 0, max: 50_000 }).map((minor) => minor / 100);
const count = fc.integer({ min: 0, max: 500 });

const proseCase = fc.record({
  rows: fc.array(fc.record({ item: fc.constantFrom("Eggs", "Onions", "Potatoes", "Jam"), taken: count, unaccounted: count, value: amount }), { minLength: 1, maxLength: 8 }),
  question: fc.constantFrom("Which items walk on Saturdays?", "How did last week go?", "Show me the refunds"),
  pick: fc.nat(100),
  unseen: fc.integer({ min: 501, max: 99_999 }),
  asMoney: fc.boolean(),
});

const onlyLedgerNumbersShown = fc.property(proseCase, ({ rows, question, pick, unseen, asMoney }) => {
  const input = [
    { type: "message" as const, role: "user" as const, content: [{ type: "text", text: question }] },
    { type: "function_call" as const, callId: "c1", name: "execute_query", arguments: "{}" },
    { type: "function_call_output" as const, callId: "c1", output: JSON.stringify({ rows }) },
  ];
  const allowed = allowedFromConversation(input);

  const row = rows[pick % rows.length];
  const fromLedger = asMoney ? `${row.item}: €${row.value.toFixed(2)} unaccounted for.` : `${row.item}: ${row.taken} taken.`;
  assert(checkedText(fromLedger, allowed).text === fromLedger, `a sentence using the ledger's own number was replaced: ${fromLedger}`);

  const made = asMoney ? `€${(unseen / 100).toFixed(2)}` : String(unseen);
  if (!allowed.includes(asMoney ? unseen / 100 : unseen)) {
    const invented = `${row.item}: ${made} unaccounted for.`;
    assert(checkedText(invented, allowed).text === REPLACED_TEXT, `a number the ledger never gave was shown: ${invented}`);
  }
  assert(checkedText("Potatoes walk most on Saturdays.", allowed).by === "model", "a sentence with no numbers was replaced");
  assert(checkedText("Half the eggs went unpaid for.", allowed).text === REPLACED_TEXT, "a number in words was shown");
});

const turnsCase = fc.array(
  fc.record({ calls: fc.integer({ min: 1, max: 4 }), signed: fc.boolean(), saysSomething: fc.boolean() }),
  { minLength: 1, maxLength: 6 },
);

const callsBeforeResults = fc.property(turnsCase, (turns) => {
  // As Studio lists a conversation: each call next to its result, a turn's first call signed by Gemini.
  type Item = Parameters<typeof toMessages>[0][number];
  const input: Item[] = [{ type: "message", role: "user", content: [{ type: "text", text: "Which items walk on Saturdays?" }] }];
  const signatures: Record<string, string> = {};
  turns.forEach((turn, t) => {
    for (let c = 0; c < turn.calls; c++) {
      const callId = `t${t}c${c}`;
      if (c === 0 && turn.signed) signatures[callId] = `sig-${callId}`;
      input.push({ type: "function_call", callId, name: `tool_${c}`, arguments: JSON.stringify({ c }) });
      input.push({ type: "function_call_output", callId, output: `result ${c}` });
    }
    if (turn.saysSomething) input.push({ type: "message", role: "assistant", content: [{ type: "text", text: "Looking." }] });
  });

  const messages = toMessages(input, signatures);
  const answered = new Set<string>();
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "assistant" || typeof m.content === "string") continue;
    const ids = m.content.flatMap((p) => (p.type === "tool-call" ? [p.toolCallId] : []));
    if (ids.length === 0) continue;
    const next = messages[i + 1];
    assert(next?.role === "tool", "calls were not followed by their results");
    const results = next.content.flatMap((p) => (p.type === "tool-result" ? [p.toolCallId] : []));
    assert(JSON.stringify(results) === JSON.stringify(ids), `a turn's results do not match its calls: ${ids} then ${results}`);
    for (const p of m.content) {
      if (p.type !== "tool-call") continue;
      const back = (p.providerOptions?.vertex as { thoughtSignature?: string } | undefined)?.thoughtSignature;
      assert(back === signatures[p.toolCallId], `signature for ${p.toolCallId} was not put back as received`);
    }
    ids.forEach((id) => answered.add(id));
  }
  const all = input.flatMap((item) => (item.type === "function_call" ? [item.callId] : []));
  assert(all.every((id) => answered.has(id)) && answered.size === all.length, "a call went missing or was sent twice");

  // One model turn's calls travel together: Gemini wants them all before any result.
  const messageOf = new Map<string, number>();
  messages.forEach((m, i) => {
    if (m.role === "assistant" && typeof m.content !== "string") for (const p of m.content) if (p.type === "tool-call") messageOf.set(p.toolCallId, i);
  });
  turns.forEach((turn, t) => {
    const where = new Set(Array.from({ length: turn.calls }, (_, c) => messageOf.get(`t${t}c${c}`)));
    assert(where.size === 1, `turn ${t}'s calls were split across ${where.size} messages`);
  });
});

export const p8 = [
  moneyProperty("E4.8", "The ledger assistant shows only numbers the ledger's own tools returned or the grower wrote", onlyLedgerNumbersShown),
  moneyProperty("E4.9", "Each Gemini turn's calls reach Gemini before their results, signed as received, none lost", callsBeforeResults),
];
