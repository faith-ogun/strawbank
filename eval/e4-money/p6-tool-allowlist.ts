import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import fc from "fast-check";
import { MODEL_TOOLS, modelTools, paypalToolkitTools } from "../../src/agent/toolkit";
import { AGENT_TOOLS, TOOLKIT_ACTIONS, ToolNotAllowed, pickAgentTools, runAgentTool } from "../../src/agent/tools";
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

export const p6 = [
  moneyProperty(
    "E4.6",
    "The PayPal Agent Toolkit, as configured, offers the agent exactly its allowlisted tools",
    configuredExactly,
    1,
  ),
  moneyProperty("E4.6b", "The agent never calls a tool outside its allowlist", onlyAllowlistedRun),
  moneyProperty("E4.6c", "No tool handed to the model can move money; refunds run only from code", modelNeverMovesMoney, 1),
];
