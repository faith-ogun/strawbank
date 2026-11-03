"use client";

// F6 in the browser: the grower's ledger in AG Studio. The rows arrive from
// the server already worked out; Studio draws the pre-built report, the
// stand's own widget and theme, and lets the grower switch to edit mode to
// build their own views. Loaded with ssr: false (ledger-loader.tsx), because
// Studio measures the page as it draws.

import { type AgAiHarnessSetup, AgStudioAiModule, type AgPanelConfig, type AgStudioMode, type AgStudioTheme, type AgWidgetsConfig, enableStudioDevValidations, studioTheme } from "ag-studio";
import { AgStudio, AgStudioProvider, createWidgets } from "ag-studio-react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { LedgerRows } from "@/lib/ledger-rows";
import { ledgerHarness } from "./ledger-agent";
import { LEDGER_PAGES, ledgerData, ledgerReport } from "./ledger-data";
import { type LedgerRegistry, paidTakenWidget } from "./paid-taken-widget";

if (process.env.NODE_ENV !== "production") enableStudioDevValidations();

// The stand's colours (src/app/globals.css): navy ink, straw for Strawbank's own
// voice, mint for paid, red for unaccounted for, slate for uncertain.
const theme: AgStudioTheme = studioTheme.withParams({
  accentColor: "#0a1643",
  backgroundColor: "#ffffff",
  foregroundColor: "#0a1643",
  textColor: "#0a1643",
  subtleTextColor: "#5a6283",
  borderColor: "#ece3cf",
  fontFamily: "var(--font-figtree), system-ui, sans-serif",
  studioCanvasBackgroundColor: "#fbf4e4",
  studioWidgetBackgroundColor: "#ffffff",
  studioWidgetBorderRadius: 16,
  studioWidgetTitleFontFamily: "var(--font-outfit), system-ui, sans-serif",
  studioWidgetTitleTextColor: "#0a1643",
  gridHeaderBackgroundColor: "#fbf4e4",
  chartPaletteFills1Color: "#4aeb94",
  chartPaletteFills2Color: "#c4462b",
  chartPaletteFills3Color: "#5f6890",
  chartPaletteFills4Color: "#f0bb57",
  chartPaletteFills5Color: "#0a1643",
});

const MODULES = [AgStudioAiModule];
// Studio shows its AI panel in edit mode, where the assistant can change the page.
const PANELS: AgPanelConfig = { edit: { left: ["ai"], right: ["edit", "data", "filters"] } };

export default function LedgerStudio({ rows, licenseKey }: { rows: LedgerRows; licenseKey?: string }) {
  const studio = useRef<AgStudio<LedgerRegistry>>(null);
  const [mode, setMode] = useState<AgStudioMode>("view");
  const [page, setPage] = useState<string>(ledgerReport.selectedPageId ?? "stand");
  const data = useMemo(() => ledgerData(rows), [rows]);
  const ai = useMemo<AgAiHarnessSetup>(() => ({ api }) => ledgerHarness(api, rows), [rows]);
  // Ours first in the menu, then all of Studio's own.
  const widgets = useMemo(
    () => (defaults: AgWidgetsConfig) =>
      createWidgets<LedgerRegistry>({ additionalTypes: [paidTakenWidget], menu: [{ label: "Strawbank", widgetIds: ["paid-taken"] }, ...defaults.menu] }),
    [],
  );

  const show = useCallback((id: string) => {
    const api = studio.current?.api;
    if (!api) return;
    api.setState({ ...api.getState(), selectedPageId: id });
    setPage(id);
  }, []);

  return (
    <AgStudioProvider licenseKey={licenseKey} modules={MODULES}>
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas px-4 py-2">
          <nav className="flex flex-wrap gap-2 text-sm" aria-label="Ledger pages">
            {LEDGER_PAGES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => show(p.id)}
                aria-current={page === p.id ? "page" : undefined}
                className={`rounded-full px-3 py-1 ${page === p.id ? "bg-ink text-canvas" : "border border-line-2 text-ink"}`}
              >
                {p.label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => setMode((m) => (m === "view" ? "edit" : "view"))}
            className="ml-auto rounded-full border border-line-2 px-3 py-1 text-sm font-semibold text-ink"
          >
            {mode === "view" ? "Ask the assistant, or build your own view" : "Done"}
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <AgStudio<LedgerRegistry>
            ref={studio}
            style={{ height: "100%", width: "100%" }}
            data={data}
            initialState={ledgerReport}
            widgets={widgets}
            ai={ai}
            panels={PANELS}
            theme={theme}
            mode={mode}
            layout={{ minWidth: 360 }}
            onStateUpdated={(e) => e.state.selectedPageId && setPage(e.state.selectedPageId)}
          />
        </div>
      </div>
    </AgStudioProvider>
  );
}
