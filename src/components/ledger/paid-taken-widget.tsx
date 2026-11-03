"use client";

// A custom AG Studio widget for the ledger: one shelf row per item, showing
// how many were taken and how that splits into paid for (mint), unaccounted
// for (gap red), uncertain (slate) and paid for more than taken (straw), with
// the counts in words. Every number
// comes from Studio's query over rows code produced (src/lib/ledger-rows.ts);
// the widget only draws them. Tapping an item filters the whole page to it.

import type { AgBaseWidgetDefinition, AgDefaultRegistry, AgDefaultWidgetDefinition, AgWidgetDataFormat, AgWidgetFieldReference, AgWidgetFormParams, AgWidgetParams } from "ag-studio";
import { useEffect, useRef, useState } from "react";

export type PaidTakenDef = {
  type: "paid-taken";
  dataMapping: {
    item: AgWidgetFieldReference[];
    taken: AgWidgetFieldReference[];
    paid: AgWidgetFieldReference[];
    unaccounted: AgWidgetFieldReference[];
    uncertain: AgWidgetFieldReference[];
  };
  format?: AgWidgetDataFormat<Record<string, never>>;
};

// Studio's own widgets plus ours, as AG Studio's Registry Type page describes.
export type LedgerRegistry = Omit<AgDefaultRegistry, "widgets"> & {
  widgets: readonly (AgDefaultWidgetDefinition | AgBaseWidgetDefinition<"paid-taken", PaidTakenDef>)[];
};

type Row = { item: string; raw: unknown; taken: number; paid: number; unaccounted: number; uncertain: number };

/** The item values this widget is filtering the page by. */
const selectedValues = (api: AgWidgetParams<PaidTakenDef>["widgetApi"]): unknown[] =>
  (api.getCrossFilterSelections() ?? []).flatMap((s) => (s.type === "value" ? s.values : []));

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function PaidTaken({ dataMapping, widgetApi }: AgWidgetParams<PaidTakenDef>) {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<unknown[]>([]);
  const loaded = useRef(false);

  const item = dataMapping.item?.at(0);
  useEffect(() => {
    const fields = [dataMapping.item, dataMapping.taken, dataMapping.paid, dataMapping.unaccounted, dataMapping.uncertain].map((f) => f?.at(0));
    const [itemField, taken, paid, unaccounted, uncertain] = fields;
    if (!itemField || !taken || !paid) {
      widgetApi.setDisplayState("incompleteDataMapping");
      return;
    }
    let live = true;
    (async () => {
      widgetApi.setDisplayState("loading", { prominent: !loaded.current });
      const response = await widgetApi.getData({ fields: fields.filter((f) => f !== undefined) });
      if (!live) return;
      const next = response.results.rows.map((r) => ({
        item: widgetApi.formatFieldValue(itemField, r[itemField.key]),
        raw: r[itemField.key],
        taken: num(r[taken.key]),
        paid: num(r[paid.key]),
        unaccounted: unaccounted ? num(r[unaccounted.key]) : 0,
        uncertain: uncertain ? num(r[uncertain.key]) : 0,
      }));
      loaded.current = next.length > 0;
      setRows(next);
      setSelected(selectedValues(widgetApi));
      widgetApi.setDisplayState(next.length > 0 ? "displayed" : "noData");
    })();
    return () => {
      live = false;
    };
  }, [dataMapping, widgetApi]);

  const widest = Math.max(1, ...rows.map((r) => Math.max(r.taken, r.paid)));
  const pct = (n: number) => `${(100 * Math.max(0, n)) / widest}%`;
  return (
    <ul className="flex h-full flex-col justify-center gap-2 overflow-auto px-3 py-2" aria-label="Paid for versus taken, by item">
      {rows.map((r) => {
        // Summed over days, so an overpaid day can make paid exceed what the bar covers.
        const covered = Math.max(0, r.taken - r.unaccounted - r.uncertain);
        const extra = Math.max(0, r.paid - covered);
        const isSelected = selected.includes(r.raw);
        return (
          <li key={String(r.raw)}>
            <button
              type="button"
              aria-pressed={isSelected}
              className={`grid w-full grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-1 rounded-xl px-2 py-1.5 text-left hover:bg-paper ${isSelected ? "bg-straw-soft ring-2 ring-straw" : ""}`}
              onClick={() => {
                if (!item) return;
                widgetApi.toggleCrossFilter({ type: "value", group: 0, field: item, value: r.raw });
                setSelected(selectedValues(widgetApi));
              }}
            >
              <span className="font-semibold text-ink">{r.item}</span>
              <span className="flex h-4 overflow-hidden rounded-full bg-line" aria-hidden>
                <span className="bg-mint" style={{ width: pct(covered) }} />
                <span className="bg-gap" style={{ width: pct(r.unaccounted) }} />
                <span className="bg-unsure" style={{ width: pct(r.uncertain) }} />
                <span className="bg-straw" style={{ width: pct(extra) }} />
              </span>
              <span className="col-start-2 text-xs text-ink-3">
                {r.taken} taken · {r.paid} paid for
                {r.unaccounted > 0 && <b className="text-gap"> · {r.unaccounted} unaccounted for</b>}
                {r.uncertain > 0 && <b className="text-unsure"> · {r.uncertain} uncertain</b>}
                {extra > 0 && <b className="text-straw-ink"> · {extra} paid for more than taken</b>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const numericPerItem = (aiDescription: string, required: boolean) => ({
  type: "field" as const,
  supportedRoles: ["numeric" as const],
  requires: { per: "dataMapping.item" as const, cardinality: "one" as const },
  required,
  aiDescription,
});

export const paidTakenWidget: AgBaseWidgetDefinition<"paid-taken", PaidTakenDef> = {
  id: "paid-taken",
  label: "Paid versus taken",
  icon: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="3" width="9" height="3" rx="1" fill="#0f7a45"/><rect x="10" y="3" width="4" height="3" rx="1" fill="#c4462b"/><rect x="1" y="10" width="12" height="3" rx="1" fill="#0f7a45"/></svg>',
  dataMapping: {
    item: {
      type: "field",
      supportedRoles: ["category"],
      requires: { cardinality: "many" },
      required: true,
      aiDescription: "The item on the stand; one row is drawn per item.",
    },
    taken: numericPerItem("How many were taken off the shelf (sum of itemDays.taken).", true),
    paid: numericPerItem("How many were paid for (sum of itemDays.paid).", true),
    unaccounted: numericPerItem("Taken and not paid for, on sure counts (sum of itemDays.unaccounted). Never call this theft.", false),
    uncertain: numericPerItem("Taken and not paid for, where the count or payment was not sure (sum of itemDays.uncertain).", false),
  },
  form: (params: AgWidgetFormParams<PaidTakenDef>) =>
    params.createDefaults({
      dataMappingItems: [
        { key: "item", label: "Item" },
        { key: "taken", label: "Taken" },
        { key: "paid", label: "Paid for" },
        { key: "unaccounted", label: "Unaccounted for" },
        { key: "uncertain", label: "Uncertain" },
      ],
    }),
  comp: PaidTaken,
  defaultSize: { width: 520, height: 300 },
  minSize: { width: 300, height: 180 },
  ai: {
    label: "Paid versus taken",
    description: "One bar per item: paid for in green, unaccounted for in red, uncertain in slate, with the counts in words.",
    usage: "Use it to show which items go unpaid for. Pair it with a day-of-week or date filter.",
  },
};
