import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import fc from "fast-check";
import { MODEL_TOOLS, modelTools, paypalToolkitTools } from "../../src/agent/toolkit";
import { AGENT_TOOLS, TOOLKIT_ACTIONS, ToolNotAllowed, ToolTimedOut, pickAgentTools, runAgentTool } from "../../src/agent/tools";
import { ToolkitRefundGateway } from "../../src/lib/paypal/refunds";
import { RefundRejected } from "../../src/lib/refunds";
import { assert, moneyProperty } from "./shared";

// Placeholder credentials: building the toolkit makes no network call, and no
// tool from it is ever run here.
function toolkitTools(actions: ConstructorParameters<typeof PayPalAgentToolkit>[0]["configuration"]["actions"]) {
  return new PayPalAgentToolkit({ clientId: "eval", clientSecret: "eval", configuration: { actions, context: { sandbox: true } } }).getTools();
}

// Every action switched on, to learn every tool name the toolkit has.
const everything = new Proxy({}, { get: () => new Proxy({}, { get: () => true, has: () => true }), has: () => true });
const ALL_TOOLKIT_TOOLS = Object.keys(toolkitTools(everything));

const configuredExactly = fc.property(fc.constant(null), () => {
  const names = Object.keys(toolkitTools(TOOLKIT_ACTIONS)).sort();
  assert(JSON.stringify(names) === JSON.stringify([...AGENT_TOOLS].sort()), `the toolkit offers ${names.join(", ")}`);
  assert(ALL_TOOLKIT_TOOLS.length > AGENT_TOOLS.length, "could not list the toolkit's tools");
});

const nameArb = fc.oneof(fc.constantFrom(...ALL_TOOLKIT_TOOLS), fc.constantFrom(...AGENT_TOOLS), fc.string({ maxLength: 30 }));

const onlyAllowlistedRun = fc.asyncProperty(
  fc.uniqueArray(nameArb, { maxLength: 60 }),
  fc.array(nameArb, { minLength: 1, maxLength: 20 }),
  async (offered, calls) => {
    const ran: string[] = [];
    const tools = Object.fromEntries(offered.map((name) => [name, { execute: () => ran.push(name) }]));
    const picked = Object.keys(pickAgentTools(tools));
    assert(picked.every((name) => (AGENT_TOOLS as readonly string[]).includes(name)), `picked ${picked.join(", ")}`);

    for (const name of calls) {
      const before = ran.length;
      const allowed = (AGENT_TOOLS as readonly string[]).includes(name) && offered.includes(name);
      try {
        await runAgentTool(tools, name, {});
        assert(allowed, `"${name}" ran but is not on the allowlist`);
        assert(ran.length === before + 1 && ran.at(-1) === name, `calling "${name}" ran something else`);
      } catch (error) {
        if (!(error instanceof ToolNotAllowed)) throw error;
        assert(!allowed, `"${name}" is allowed but was refused`);
        assert(ran.length === before, `"${name}" was refused but some tool ran`);
      }
    }
  },
);

// The model is handed the toolkit's tools through the AI SDK v7 adapter. None
// of them may move money: create_refund runs only from code, with code's amount.
const modelNeverMovesMoney = fc.property(fc.constant(null), () => {
  const tools = modelTools(paypalToolkitTools({ credentials: { clientId: "eval", clientSecret: "eval" } }));
  const names = Object.keys(tools).sort();
  assert(!names.includes("create_refund"), "the model was handed create_refund");
  assert(JSON.stringify(names) === JSON.stringify([...MODEL_TOOLS].sort()), `the model was handed ${names.join(", ")}`);
  assert(names.every((n) => (AGENT_TOOLS as readonly string[]).includes(n)), "a tool outside the allowlist reached the model");
  for (const [name, t] of Object.entries(tools)) {
    assert(t.inputSchema !== undefined && typeof t.execute === "function", `"${name}" is not an AI SDK v7 tool`);
  }
});

// The toolkit sends its requests with no timeout of its own. A call that never
// answers must end at our deadline as "no answer": never as a refusal, which
// would free the refund's amount for a second try (E4.2c keeps it pending).
const never = () => new Promise<never>(() => {});
/** Fails the case if `promise` has not settled well after the deadline, so a missing deadline fails rather than hangs. */
async function watched<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error(`still waiting after ${ms} ms`)), ms)))]);
  } finally {
    clearTimeout(timer);
  }
}
const toolCallsEnd = fc.asyncProperty(fc.integer({ min: 1, max: 25 }), fc.boolean(), async (deadlineMs, answers) => {
  const tools = { create_refund: { execute: answers ? async () => '{"id":"R1","status":"COMPLETED"}' : never } };
  const started = Date.now();
  try {
    const reply = await watched(runAgentTool(tools, "create_refund", {}, deadlineMs), deadlineMs + 500);
    assert(answers && reply === '{"id":"R1","status":"COMPLETED"}', "a call that never answers resolved");
  } catch (error) {
    assert(!answers, `a call that answered at once was cut off: ${String(error)}`);
    assert(error instanceof ToolTimedOut, `a call with no answer ended as ${String(error)}`);
    assert(Date.now() - started >= deadlineMs - 1, "the call was cut off before its deadline");
  }

  const gateway = new ToolkitRefundGateway(() => tools, deadlineMs);
  const input = { captureId: "CAP", amountMinor: 60, currency: "EUR" as const, idempotencyKey: "refund-x" };
  if (answers) {
    assert((await gateway.refund(input)).status === "COMPLETED", "the refund's answer was lost");
  } else {
    const outcome = await watched(gateway.refund(input), deadlineMs + 500).then(
      () => "answered",
      (error: unknown) => (error instanceof RefundRejected ? "refused" : error instanceof ToolTimedOut ? "unknown" : String(error)),
    );
    assert(outcome === "unknown", `a refund with no answer ended as "${outcome}", not unknown`);
  }
});

export const p6 = [
  moneyProperty(
    "E4.6",
    "The PayPal Agent Toolkit, as configured, offers the agent exactly its allowlisted tools",
    configuredExactly,
    1,
  ),
  moneyProperty("E4.6b", "The agent never calls a tool outside its allowlist", onlyAllowlistedRun),
  moneyProperty("E4.6c", "No tool handed to the model can move money; refunds run only from code", modelNeverMovesMoney, 1),
  moneyProperty("E4.6d", "A PayPal toolkit call with no answer ends at its deadline as unknown, never as refused", toolCallsEnd, 50),
];
