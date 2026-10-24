import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import fc from "fast-check";
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

export const p6 = [
  moneyProperty(
    "E4.6",
    "The PayPal Agent Toolkit, as configured, offers the agent exactly its allowlisted tools",
    configuredExactly,
    1,
  ),
  moneyProperty("E4.6b", "The agent never calls a tool outside its allowlist", onlyAllowlistedRun),
];
