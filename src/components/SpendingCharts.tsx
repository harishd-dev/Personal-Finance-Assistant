import { useState } from "react";
import { Transaction } from "../types";
import { TrendingDown, PieChart, Percent } from "lucide-react";

interface SpendingChartsProps {
  transactions: Transaction[];
  income: number;
  savingsPotential?: number;
}

export default function SpendingCharts({
  transactions,
  income,
  savingsPotential = 640,
}: SpendingChartsProps) {
  const [activeDonutIndex, setActiveDonutIndex] = useState<number | null>(null);
  const [trendHoverIndex, setTrendHoverIndex] = useState<number | null>(null);

  // ── Category aggregation ──────────────────────────────────────────
  const categoriesMap: Record<string, number> = {
    Food: 0, Utilities: 0, Entertainment: 0, Transportation: 0,
    Shopping: 0, Health: 0, Education: 0, Other: 0,
  };

  let totalSpent = 0;
  transactions.forEach((tx) => {
    if (tx.amount < 0) {
      const positiveAmount = Math.abs(tx.amount);
      totalSpent += positiveAmount;
      if (categoriesMap[tx.category] !== undefined) {
        categoriesMap[tx.category] += positiveAmount;
      } else {
        categoriesMap["Other"] += positiveAmount;
      }
    }
  });

  const categoryLimits: Record<string, number> = {
    Food: 550, Utilities: 350, Entertainment: 250,
    Transportation: 300, Shopping: 400, Health: 200,
    Education: 150, Other: 100,
  };

  // BUG #1 FIX: Use colours that have high contrast on both light and dark surfaces.
  // These are vivid hues that remain distinct against both white (#fff) and dark navy (#131d2e).
  const categoryColors: Record<string, string> = {
    Food:           "#f59e0b",  // Amber
    Utilities:      "#3b82f6",  // Blue
    Entertainment:  "#ec4899",  // Pink
    Transportation: "#ef4444",  // Red
    Shopping:       "#8b5cf6",  // Purple
    Health:         "#10b981",  // Emerald
    Education:      "#06b6d4",  // Cyan
    Other:          "#64748b",  // Slate
  };

  const categoriesList = Object.keys(categoriesMap)
    .map((cat) => {
      const spent = categoriesMap[cat];
      const limit = categoryLimits[cat] || 200;
      const pctOfLimit = limit > 0 ? (spent / limit) * 100 : 0;
      return {
        name: cat,
        spent: parseFloat(spent.toFixed(2)),
        limit,
        pctOfLimit,
        percentage: totalSpent > 0 ? (spent / totalSpent) * 100 : 0,
        color: categoryColors[cat] || "#6d28d9",
      };
    })
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  // ── Weekly trend data ─────────────────────────────────────────────
  const periods = [
    { name: "Week 1", amount: 0 },
    { name: "Week 2", amount: 0 },
    { name: "Week 3", amount: 0 },
    { name: "Week 4", amount: 0 },
    { name: "Week 5", amount: 0 },
  ];

  transactions.forEach((tx) => {
    if (tx.amount < 0) {
      const positiveAmt = Math.abs(tx.amount);
      const day = new Date(tx.date).getDate();
      if (day <= 6) periods[0].amount += positiveAmt;
      else if (day <= 12) periods[1].amount += positiveAmt;
      else if (day <= 18) periods[2].amount += positiveAmt;
      else if (day <= 24) periods[3].amount += positiveAmt;
      else periods[4].amount += positiveAmt;
    }
  });

  const trendMax = Math.max(...periods.map((p) => p.amount), 300) * 1.15;
  const svgWidth = 500;
  const svgHeight = 200;
  const paddingX = 45;
  const paddingY = 24;

  const points = periods.map((p, index) => {
    const x = paddingX + (index * (svgWidth - paddingX * 2)) / (periods.length - 1);
    const y = svgHeight - paddingY - (p.amount / trendMax) * (svgHeight - paddingY * 2);
    return { x, y, val: p.amount, name: p.name };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
      : "";

  const netSavings = income - totalSpent;

  return (
    <div id="financial-charts-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6">

      {/* ── TREND CHART ─────────────────────────────────────────────── */}
      <div
        className="lg:col-span-8 p-6 rounded-2xl flex flex-col justify-between transition-all duration-300 brutal-card"
      >
        <div>
          {/* Header */}
          <div
            className="flex items-center justify-between mb-4 pb-3 border-b"
            style={{ borderColor: "var(--color-border-subtle)" }}
          >
            <div>
              <h3
                className="text-sm font-semibold uppercase tracking-wider flex items-center gap-1.5 font-display"
                style={{ color: "var(--color-text-primary)" }}
              >
                <TrendingDown className="w-4 h-4" style={{ color: "var(--color-success-icon)" }} />
                Real-Time Spending Trend
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Accumulated expenditures tracked across current billing cycle
              </p>
            </div>
            <div
              className="rounded-full px-3 py-1 text-[10px] font-bold font-mono"
              style={{
                backgroundColor: "var(--color-brand-50)",
                color: "var(--color-brand-600)",
                border: "1px solid var(--color-brand-100)",
              }}
            >
              Month-on-Month
            </div>
          </div>

          {/* SVG Chart */}
          <div className="relative mt-2 select-none">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto overflow-visible"
            >
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.00" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = paddingY + ratio * (svgHeight - paddingY * 2);
                const valueLine = trendMax * (1 - ratio);
                return (
                  <g key={ratio} opacity="0.5">
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={svgWidth - paddingX}
                      y2={y}
                      stroke="var(--color-border-medium)"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={paddingX - 8}
                      y={y + 3}
                      fill="var(--color-text-disabled)"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      ${valueLine.toFixed(0)}
                    </text>
                  </g>
                );
              })}

              {/* Area fill */}
              {areaPath && <path d={areaPath} fill="url(#trendGradient)" />}

              {/* Line */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points */}
              {points.map((p, idx) => (
                <g
                  key={idx}
                  onMouseEnter={() => setTrendHoverIndex(idx)}
                  onMouseLeave={() => setTrendHoverIndex(null)}
                >
                  {trendHoverIndex === idx && (
                    <circle cx={p.x} cy={p.y} r="10" fill="#6366f1" fillOpacity="0.15" />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={trendHoverIndex === idx ? "6" : "4"}
                    fill={trendHoverIndex === idx ? "#4f46e5" : "var(--color-bg-surface)"}
                    stroke="#6366f1"
                    strokeWidth="2.5"
                    className="cursor-pointer"
                  />
                  <text
                    x={p.x}
                    y={svgHeight - 6}
                    fill="var(--color-text-disabled)"
                    fontSize="9"
                    fontWeight="500"
                    fontFamily="sans-serif"
                    textAnchor="middle"
                  >
                    {p.name}
                  </text>
                </g>
              ))}
            </svg>

            {/* Hover tooltip */}
            {trendHoverIndex !== null && points[trendHoverIndex] && (
              <div
                className="absolute rounded-xl p-2.5 text-xs pointer-events-none flex flex-col border"
                style={{
                  backgroundColor: "#1e293b",
                  borderColor: "#334155",
                  color: "#f1f5f9",
                  left: `${(points[trendHoverIndex].x / svgWidth) * 100}%`,
                  top: `${(points[trendHoverIndex].y / svgHeight) * 100 - 35}%`,
                  transform: "translateX(-50%)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                }}
              >
                <span className="font-semibold text-[10px] uppercase tracking-widest" style={{ color: "#94a3b8" }}>
                  {points[trendHoverIndex].name}
                </span>
                <span className="font-mono font-bold mt-0.5" style={{ color: "#818cf8" }}>
                  ${points[trendHoverIndex].val.toFixed(2)} spent
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Summary row */}
        <div
          className="grid grid-cols-3 gap-4 border-t pt-5 mt-6 text-center"
          style={{ borderColor: "var(--color-border-subtle)" }}
        >
          {[
            { label: "Logged Influx",   value: `$${income.toFixed(2)}`,      color: "#10b981" },
            { label: "Logged Spent",    value: `$${totalSpent.toFixed(2)}`,  color: "#f43f5e" },
            { label: "Current Savings", value: `$${netSavings.toFixed(2)}`,  color: netSavings < 0 ? "#f43f5e" : "#6366f1" },
          ].map(({ label, value, color }, i) => (
            <div key={label} className={i === 1 ? "border-x" : ""}
                 style={{ borderColor: "var(--color-border-subtle)" }}>
              <span
                className="text-[10px] font-semibold uppercase tracking-widest block"
                style={{ color: "var(--color-text-muted)" }}
              >
                {label}
              </span>
              <span className="font-mono font-bold text-sm mt-1 block" style={{ color }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── CATEGORY BREAKDOWN ──────────────────────────────────────── */}
      <div
        className="lg:col-span-4 p-6 rounded-2xl flex flex-col justify-between transition-all duration-300 brutal-card"
      >
        <div>
          {/* Header */}
          <div
            className="flex items-center justify-between mb-4 pb-3 border-b"
            style={{ borderColor: "var(--color-border-subtle)" }}
          >
            <div>
              <h3
                className="text-sm font-semibold uppercase tracking-wider flex items-center gap-1.5 font-display"
                style={{ color: "var(--color-text-primary)" }}
              >
                <PieChart className="w-4 h-4" style={{ color: "var(--color-brand-600)" }} />
                Category Budget
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Expenses vs budget limits
              </p>
            </div>
          </div>

          {/* Category bars */}
          <div className="space-y-4">
            {categoriesList.length === 0 ? (
              <div
                className="text-center py-12 text-xs"
                style={{ color: "var(--color-text-disabled)" }}
              >
                No expenses yet. Import a statement to populate.
              </div>
            ) : (
              categoriesList.slice(0, 5).map((cat, idx) => (
                <div
                  key={cat.name}
                  className="space-y-1.5 cursor-pointer select-none"
                  onMouseEnter={() => setActiveDonutIndex(idx)}
                  onMouseLeave={() => setActiveDonutIndex(null)}
                >
                  {/* Label row */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        {cat.name}
                      </span>
                      <span className="text-[9px] font-medium font-mono"
                            style={{ color: "var(--color-text-disabled)" }}>
                        ({cat.percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        ${cat.spent.toFixed(0)}
                      </span>
                      <span style={{ color: "var(--color-border-strong)" }}>/</span>
                      <span style={{ color: "var(--color-text-muted)" }}>${cat.limit}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div
                    className="w-full h-2.5 rounded-full overflow-hidden relative"
                    style={{ backgroundColor: "var(--color-bg-muted)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        backgroundColor: cat.color,
                        width: `${Math.min(cat.pctOfLimit, 100)}%`,
                        opacity: activeDonutIndex === idx ? 1 : 0.85,
                      }}
                    />
                    {cat.pctOfLimit > 100 && (
                      <div
                        className="absolute inset-y-0 right-0 h-full w-4 animate-pulse"
                        style={{ backgroundColor: "rgba(239,68,68,0.25)" }}
                      />
                    )}
                  </div>

                  {/* Over-budget warning */}
                  {cat.pctOfLimit > 100 && (
                    <div
                      className="text-[10px] font-medium tracking-tight"
                      style={{ color: "#ef4444" }}
                    >
                      Over budget by ${Math.abs(cat.spent - cat.limit).toFixed(0)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Savings potential footer */}
        {categoriesList.length > 0 && (
          <div
            className="border-t pt-4 mt-6"
            style={{ borderColor: "var(--color-border-subtle)" }}
          >
            <div
              className="rounded-xl p-3 flex gap-3 items-center border"
              style={{
                backgroundColor: "var(--color-brand-50)",
                borderColor: "var(--color-brand-100)",
              }}
            >
              <div
                className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "var(--color-bg-surface)" }}
              >
                <Percent className="w-4 h-4" style={{ color: "var(--color-brand-600)" }} />
              </div>
              <div className="min-w-0">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider block"
                  style={{ color: "var(--color-brand-600)" }}
                >
                  Projected Savings
                </span>
                <span
                  className="text-[11px] mt-0.5 block leading-tight"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Optimize bills to cut up to{" "}
                  <strong
                    className="rounded px-1 font-mono font-bold"
                    style={{
                      backgroundColor: "rgba(79,70,229,0.12)",
                      color: "var(--color-brand-600)",
                    }}
                  >
                    ${savingsPotential}
                  </strong>{" "}
                  /mo!
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}