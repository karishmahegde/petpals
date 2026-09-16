// MonthlyStatsWidget.tsx
// The "Stats" line chart on the admin Overview page — Jan-Dec Intake vs.
// Adoptions for a selected year, from GET /analytics/monthly-stats.
// Self-contained: owns its own query, year selector, chart/table toggle, and
// loading/empty states.
//
// Colors: the two series (#2a78d6 blue "Intake", #e87ba4 magenta "Adoptions")
// are validated categorical slots (dataviz skill, palette.md slots 1 + 5) —
// PetPals' own teal-dark/rose-dark tokens fail the chroma-floor and
// contrast-vs-surface checks for a data-carrying mark, so this chart doesn't
// reuse them. Chrome (grid, axis, tooltip, legend text) stays on PetPals'
// own neutral tokens for visual consistency with the rest of the app. The
// light-magenta line is below the 3:1 contrast floor on white — mitigated by
// the required relief channel: >=8px dot markers, a legend, and the table
// view toggle (never color alone).
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import Card from "../../../../../components/ui/Card";
import DashboardWidgetHeader from "../../../../../components/ui/dashboard/DashboardWidgetHeader";
import {
  getMonthlyStats,
  type MonthlyStatsPoint,
} from "../../../../../logic/api/analyticsApi";

// Dropdown range — 2025 (the app's earliest meaningful data) through the
// current year, computed live so this never needs a manual bump.
const EARLIEST_YEAR = 2025;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: Math.max(CURRENT_YEAR - EARLIEST_YEAR + 1, 1) },
  (_, i) => CURRENT_YEAR - i, // newest first
).filter((year) => year >= EARLIEST_YEAR);

const INTAKE_COLOR = "#2a78d6";
const ADOPTIONS_COLOR = "#e87ba4";
const GRID_COLOR = "#F0F0F0"; // neutral-lightgray
const AXIS_COLOR = "#8A8A8A"; // neutral-gray
const LABEL_COLOR = "#454545"; // neutral-charcoal — labels never wear the series color

const ChartTooltip = ({
  active,
  payload,
  label,
}: TooltipContentProps<ValueType, NameType>) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-neutral-lightgray bg-white px-3 py-2 shadow-md">
      <p className="mb-1 font-body text-xs font-semibold text-neutral-charcoal">
        {label}
      </p>
      {payload.map((entry) => (
        <p
          key={entry.dataKey as string}
          className="flex items-center gap-2 font-body text-xs text-neutral-gray"
        >
          <span
            className="inline-block h-0.5 w-3 shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="font-semibold text-neutral-dark">
            {entry.value}
          </span>
          <span>{entry.name}</span>
        </p>
      ))}
    </div>
  );
};

// Value-at-the-end direct label (see marks-and-anatomy.md — label the
// endpoint, not every point). `dataLength`/`color` are bound per-series below.
const endLabel =
  (dataLength: number) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (props: any) => {
    if (props.index !== dataLength - 1) return null;
    return (
      <text
        x={props.x + 8}
        y={props.y}
        dy={4}
        textAnchor="start"
        className="font-body text-xs font-semibold"
        fill={LABEL_COLOR}
      >
        {props.value}
      </text>
    );
  };

const MonthlyStatsWidget = () => {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [year, setYear] = useState(CURRENT_YEAR);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "monthly-stats", year],
    queryFn: () => getMonthlyStats(year),
  });

  const isEmpty = useMemo(
    () => !!data && data.every((point) => point.intake === 0 && point.adoptions === 0),
    [data],
  );

  const xLabel = (point: MonthlyStatsPoint) => point.month;

  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <DashboardWidgetHeader icon="📈" title="Stats" className="mb-0" />
        <label className="flex items-center gap-2 font-body text-sm text-neutral-charcoal">
          Year
          <select
            aria-label="Year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-neutral-lightgray bg-white px-3 py-1.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      {data && data.length > 0 && !isEmpty && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
            className="font-body text-xs font-semibold text-teal-dark hover:underline"
          >
            {view === "chart" ? "View as table" : "View as chart"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-72 items-center justify-center">
          <p className="font-body text-sm text-neutral-gray">
            Loading stats…
          </p>
        </div>
      ) : !data || data.length === 0 || isEmpty ? (
        <div className="flex h-72 items-center justify-center">
          <p className="font-body text-sm text-neutral-gray">
            No intake or adoption activity in {year}.
          </p>
        </div>
      ) : view === "table" ? (
        <div className="overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-neutral-lightgray text-left text-neutral-gray">
                <th className="py-2 pr-4 font-semibold">Month</th>
                <th className="py-2 pr-4 font-semibold">Intake</th>
                <th className="py-2 font-semibold">Adoptions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr
                  key={`${point.year}-${point.month}`}
                  className="border-b border-neutral-lightgray last:border-0"
                >
                  <td className="py-2 pr-4 text-neutral-charcoal">
                    {point.month}
                  </td>
                  <td className="py-2 pr-4 text-neutral-charcoal">
                    {point.intake}
                  </td>
                  <td className="py-2 text-neutral-charcoal">
                    {point.adoptions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 24, right: 32, bottom: 24, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke={GRID_COLOR} />
              <XAxis
                dataKey={xLabel}
                tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                axisLine={{ stroke: GRID_COLOR }}
                tickLine={false}
                label={{
                  value: year,
                  position: "bottom",
                  fill: AXIS_COLOR,
                  fontSize: 12,
                }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                label={{
                  value: "Animals",
                  angle: -90,
                  position: "insideLeft",
                  fill: AXIS_COLOR,
                  fontSize: 12,
                }}
              />
              <Tooltip content={ChartTooltip} cursor={{ stroke: GRID_COLOR }} />
              <Legend
                iconType="line"
                verticalAlign="top"
                align="right"
                wrapperStyle={{ fontSize: 12, color: LABEL_COLOR, top: 0 }}
              />
              <Line
                type="linear"
                dataKey="intake"
                name="Intake"
                stroke={INTAKE_COLOR}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: INTAKE_COLOR }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                label={endLabel(data.length)}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="adoptions"
                name="Adoptions"
                stroke={ADOPTIONS_COLOR}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: ADOPTIONS_COLOR }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                label={endLabel(data.length)}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};

export default MonthlyStatsWidget;
