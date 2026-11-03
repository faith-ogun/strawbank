// The ledger's AI assistant: Strawbank's own agent, fronting AG Studio's
// built-in team. It reads the grower's question, looks at the ledger, runs
// one tool of ours (unpaid-for items by day of the week, worked out by code
// from the rows), and hands the building to Studio's planning, page, widget
// and data agents. Every agent runs on Gemini through geminiAdapter. None of
// them has a PayPal tool: refunds stay with code and the Agent Toolkit (F4).

import { type AgAiHarness, type AgStudioApi, createAiHarness, directLlmRunner } from "ag-studio";
import type { LedgerRows } from "@/lib/ledger-rows";
import { geminiAdapter } from "./gemini-adapter";

const HELPERS = ["planning", "page", "widget", "data"] as const;
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Per item and day of the week: items unaccounted for and uncertain, summed by code. */
export function gapsByWeekday(rows: LedgerRows) {
  const names = new Map(rows.items.map((i) => [i.key, i.item]));
  const table = new Map<string, { item: string; weekday: string; days: number; taken: number; unaccounted: number; uncertain: number }>();
  for (const r of rows.itemDays) {
    const weekday = WEEKDAYS[(new Date(`${r.date}T12:00:00Z`).getUTCDay() + 6) % 7];
    const key = `${r.itemKey}/${weekday}`;
    const row = table.get(key) ?? { item: names.get(r.itemKey) ?? r.itemKey, weekday, days: 0, taken: 0, unaccounted: 0, uncertain: 0 };
    row.days += 1;
    row.taken += r.taken;
    row.unaccounted += r.unaccounted;
    row.uncertain += r.uncertain;
    table.set(key, row);
  }
  return [...table.values()].sort((a, b) => b.unaccounted - a.unaccounted || WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday));
}

export const PROMPT_STARTERS = [
  { label: "Which items walk on Saturdays?", prompt: "Which items go unaccounted for most on Saturdays? Build me a widget that shows it." },
  { label: "Refunds the agent made", prompt: "Add a widget showing the refunds the agent made on its own, next to the ones I decided." },
  { label: "Week by week", prompt: "Show how much was paid for, week by week, against what was taken." },
];

export function ledgerHarness(api: AgStudioApi, rows: LedgerRows): AgAiHarness {
  const adapter = geminiAdapter();
  const weekdayTool = api.defineAiTool({
    name: "unaccounted_by_weekday",
    description:
      "Strawbank's own count, worked out by code from the ledger rows: for each item and day of the week, the days open, items taken, items unaccounted for and items uncertain. Use it to answer which items go unpaid for on which days, then build a widget so the grower sees it.",
    params: (s) => s.object({}),
    execute: (_args, ctx) => {
      const table = gapsByWeekday(rows);
      return ctx.success(table.length ? "The table, most unaccounted for first." : "No closed days in the ledger yet.", { table });
    },
  });

  return createAiHarness(api, ({ builtIn, tools: { studio, delegateTo } }) => ({
    agents: [
      directLlmRunner({
        id: "stand-keeper",
        name: "Strawbank",
        adapter,
        description: "Answers the grower's questions about their stand by building widgets on the ledger.",
        schema: (s) => s.undefined(),
        maxTurns: 16,
        instructions: () => {
          const tables = api
            .getAiContext()
            .schema()
            .tables.map((t) => t.name)
            .join(", ");
          return [
            "You are Strawbank's ledger assistant for an unstaffed farm stand in County Monaghan, Ireland. The grower asks about their stand; you answer by building or changing widgets on this AG Studio dashboard.",
            `The data: ${tables}. ${rows.practice ? "These are simulated practice days, not real sales: say so if asked." : "These are the stand's real records."}`,
            "How to work:",
            "- Look first: view_schema, view_page, and unaccounted_by_weekday for questions about days of the week.",
            "- Then delegate the building: 'planning' for a layout when several widgets are needed, 'page' to add, place or remove widgets and page filters, 'widget' to configure one widget, 'data' to look a figure up.",
            "- The calendar has a Day of Week fragment (calendar::dayOfWeek) and a Week fragment (calendar::week). The custom widget 'paid-taken' shows paid for against taken, per item.",
            "- A widget must answer the question as asked: if it names a day of the week, an item or a date, have the widget agent add a widget filter for exactly that (for a day of the week, on calendar::dayOfWeek), and put it in the widget's title.",
            "- Have the page agent place new widgets in empty space at the bottom of the page, never on top of another widget.",
            "Rules:",
            "- Never write amounts of money, counts or percentages in your own words: the widgets show the numbers, worked out by the stand's code. Name items, days and widgets instead. Any number you write is checked against the ledger and replaced if it is not there.",
            "- A gap is 'unaccounted for'. Never say stolen, theft, thief or dishonest: a gap can be a miscount, a payment on its way, or someone who will pay later. 'Uncertain' means the count or a payment was not sure.",
            "- You cannot move money, refund or contact anyone. If asked, say the refunds page does that.",
            "- British English, two sentences at most.",
          ].join("\n");
        },
        tools: () => [studio.viewSchema(), studio.viewPage(), studio.executeQuery(), weekdayTool, delegateTo([...HELPERS])],
      }),
      ...HELPERS.map((id) => directLlmRunner({ ...builtIn[id], adapter })),
    ],
    primary: "stand-keeper",
    promptStarters: PROMPT_STARTERS,
  }));
}
