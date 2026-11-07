"use client";

import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type CellKeyDownEvent,
  type ColDef,
  type ICellRendererParams,
  type RowClickedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Flag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { StateStamp } from "@/components/state-stamp";
import { formatMoney } from "@/lib/deals/money";
import { compareCaseAge } from "@/lib/mediation/age";
import type { MediationQueueRow } from "@/lib/mediation/types";

ModuleRegistry.registerModules([AllCommunityModule]);

const queueTheme = themeQuartz.withParams({
  accentColor: "var(--postal-ink)",
  backgroundColor: "var(--paper)",
  chromeBackgroundColor: "var(--sheet)",
  foregroundColor: "var(--ink)",
  borderColor: "var(--rule-line)",
  headerBackgroundColor: "var(--kraft)",
  headerTextColor: "var(--ink-muted)",
  headerFontSize: "0.8125rem",
  headerFontWeight: 500,
  fontFamily: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
  dataFontSize: "0.875rem",
  cellHorizontalPadding: 14,
  rowHeight: 64,
  headerHeight: 44,
  borderRadius: 10,
  wrapperBorderRadius: 14,
  wrapperBorder: false,
  rowHoverColor: "var(--postal-ink-wash)",
  selectedRowBackgroundColor: "var(--postal-ink-wash)",
});

function CaseCell({ data }: ICellRendererParams<MediationQueueRow>) {
  if (!data) return null;

  return (
    <div className="flex h-full flex-col justify-center">
      <p title={data.title} className="truncate text-[0.9375rem] font-medium leading-[1.35] text-ink">
        {data.title}
      </p>
      <p className="mt-0.5 truncate text-[0.8125rem] leading-[1.35] text-ink-muted">
        Buyer: {data.buyerName}
      </p>
    </div>
  );
}

function ReasonCell({ data }: ICellRendererParams<MediationQueueRow>) {
  if (!data) return null;

  return (
    <div className="flex h-full items-center">
      <span className="inline-flex items-center gap-1.5 whitespace-normal rounded-sm border border-flagged bg-flagged-wash px-2 py-1 text-[0.8125rem] font-medium leading-[1.25] text-flagged">
        <Flag aria-hidden="true" size={16} strokeWidth={1.75} className="shrink-0" />
        {data.reasonLabel}
      </span>
    </div>
  );
}

function StateCell({ data }: ICellRendererParams<MediationQueueRow>) {
  if (!data) return null;

  return <StateStamp state={data.state} />;
}

export function MediationGrid({ rows }: { rows: MediationQueueRow[] }) {
  const router = useRouter();

  const openCase = useCallback(
    (id: string) => {
      router.push(`/mediator/${id}`);
    },
    [router],
  );

  const columnDefs = useMemo<ColDef<MediationQueueRow>[]>(
    () => [
      {
        headerName: "Case",
        field: "title",
        flex: 2,
        minWidth: 240,
        cellRenderer: CaseCell,
      },
      {
        headerName: "Amount",
        field: "amountCents",
        width: 118,
        valueFormatter: ({ value }) =>
          typeof value === "number" ? formatMoney(value) : "",
        cellClass: "font-mono tabular-nums text-ink",
      },
      {
        headerName: "Escalation reason",
        field: "reasonLabel",
        width: 196,
        cellRenderer: ReasonCell,
      },
      {
        headerName: "Age",
        field: "openedAt",
        width: 108,
        valueFormatter: ({ data }) => data?.age ?? "",
        comparator: compareCaseAge,
        cellClass: "font-mono tabular-nums text-ink-muted",
      },
      {
        headerName: "State",
        field: "state",
        width: 164,
        cellRenderer: StateCell,
      },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<MediationQueueRow>>(
    () => ({
      sortable: true,
      resizable: true,
      suppressHeaderMenuButton: true,
    }),
    [],
  );

  const onRowClicked = useCallback(
    (event: RowClickedEvent<MediationQueueRow>) => {
      if (event.data) openCase(event.data.id);
    },
    [openCase],
  );

  const onCellKeyDown = useCallback(
    (event: CellKeyDownEvent<MediationQueueRow>) => {
      const isEnter =
        event.event instanceof KeyboardEvent && event.event.key === "Enter";

      if (isEnter && event.data) openCase(event.data.id);
    },
    [openCase],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-rule-line bg-sheet">
      <AgGridReact<MediationQueueRow>
        theme={queueTheme}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={({ data }) => data.id}
        domLayout="autoHeight"
        onRowClicked={onRowClicked}
        onCellKeyDown={onCellKeyDown}
        rowClass="cursor-pointer"
        suppressCellFocus={false}
      />
    </div>
  );
}

