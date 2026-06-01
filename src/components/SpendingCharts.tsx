import { useState } from "react";
import { Transaction } from "../types";
import { TrendingDown, PieChart, Percent } from "lucide-react";

interface SpendingChartsProps {
  transactions: Transaction[];
  income: number;
  savingsPotential?: number;
}

export default function SpendingCharts({ transactions, income, savingsPotential = 640 }: SpendingChartsProps) {
  const [activeDonutIndex, setActiveDonutIndex] = useState<number | null>(null);
  const [trendHoverIndex, setTrendHoverIndex] = useState<number | null>(null);

  // CATEGORY DATA CALCULATION //
  const categoriesMap: Record<string, number> = {
    Food: 0,
    Utilities: 0,
    Entertainment: 0,
    Transportation: 0,
    Shopping: 0,
    Health: 0,
    Education: 0,
    Other: 0,
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

  // Calculate percentages and budget guidelines (budget targets)
  const categoryLimits: Record<string, number> = {
    Food: 550,
    Utilities: 350,
    Entertainment: 250,
    Transportation: 300,
    Shopping: 400,
    Health: 200,
    Education: 150,
    Other: 100,
  };

  const categoryColors: Record<string, string> = {
    Food: "#F59E0B", // Amber
    Utilities: "#3B82F6", // Blue
    Entertainment: "#EC4899", // Pink
    Transportation: "#EF4444", // Red
    Shopping: "#8B5CF6", // Purple
    Health: "#10B981", // Emerald
    Education: "#06B6D4", // Cyan
    Other: "#6B7280", // Gray
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
        color: categoryColors[cat] || "#6D28D9",
      };
    })
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  // WEEKLY TREND ANALYSIS SVG DATA GENERATION //
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
      const dateVal = new Date(tx.date);
      const day = dateVal.getDate();

      if (day <= 6) periods[0].amount += positiveAmt;
      else if (day <= 12) periods[1].amount += positiveAmt;
      else if (day <= 18) periods[2].amount += positiveAmt;
      else if (day <= 24) periods[3].amount += positiveAmt;
      else periods[4].amount += positiveAmt;
    }
  });

  // Calculate line dimensions dynamically for SVG Line/Area
  const trendMax = Math.max(...periods.map((p) => p.amount), 300) * 1.15;
  const svgWidth = 500;
  const svgHeight = 200;
  const paddingX = 40;
  const paddingY = 20;

  const points = periods.map((p, index) => {
    const x = paddingX + (index * (svgWidth - paddingX * 2)) / (periods.length - 1);
    const y = svgHeight - paddingY - (p.amount / trendMax) * (svgHeight - paddingY * 2);
    return { x, y, val: p.amount, name: p.name };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
    : "";

  // Summary Metrics
  const netSavings = income - totalSpent;

  return (
    <div id="financial-charts-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* 1. VISUAL SPENDING TRENDS (LINE AREA SVG CHART) */}
      <div className="lg:col-span-8 bg-white border border-slate-100 p-6 rounded-2xl shadow-xs flex flex-col justify-between hover:shadow-md transition-all duration-300">
        <div>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-display">
                <TrendingDown className="w-4 h-4 text-emerald-500" />
                Real-Time Spending Trend
              </h3>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Accumulated expenditures tracked across current billing cycles
              </p>
            </div>
            <div className="bg-indigo-50 text-indigo-600 rounded-full px-3 py-1 text-[10px] font-bold font-mono">
              Month-on-Month Outlook
            </div>
          </div>

          {/* SVG Canvas Area */}
          <div className="relative mt-2 select-none">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible">
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = paddingY + ratio * (svgHeight - paddingY * 2);
                const valueLine = trendMax * (1 - ratio);
                return (
                  <g key={ratio} className="opacity-40">
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={svgWidth - paddingX}
                      y2={y}
                      stroke="#cbd5e1"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={paddingX - 10}
                      y={y + 3}
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      ${valueLine.toFixed(0)}
                    </text>
                  </g>
                );
              })}

              {/* Area Under Curve */}
              {areaPath && (
                <path
                  d={areaPath}
                  fill="url(#trendGradient)"
                />
              )}

              {/* Main Line Plot */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data Points */}
              {points.map((p, idx) => (
                <g key={idx} onMouseEnter={() => setTrendHoverIndex(idx)} onMouseLeave={() => setTrendHoverIndex(null)}>
                  {/* Outer active ring halo on hover */}
                  {trendHoverIndex === idx && (
                    <circle cx={p.x} cy={p.y} r="10" fill="#6366f1" fillOpacity="0.15" className="transition-all" />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={trendHoverIndex === idx ? "6" : "4"}
                    fill={trendHoverIndex === idx ? "#4f46e5" : "#ffffff"}
                    stroke="#6366f1"
                    strokeWidth="2.5"
                    className="cursor-pointer transition-all"
                  />
                  {/* Axis Label */}
                  <text
                    x={p.x}
                    y={svgHeight - 4}
                    fill="#64748b"
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

            {/* Float Pointer Interactive Tooltip */}
            {trendHoverIndex !== null && points[trendHoverIndex] && (
              <div
                className="absolute bg-slate-900 text-white rounded-xl p-2.5 shadow-xl text-xs pointer-events-none transition-all flex flex-col font-sans border border-slate-800"
                style={{
                  left: `${(points[trendHoverIndex].x / svgWidth) * 100}%`,
                  top: `${(points[trendHoverIndex].y / svgHeight) * 100 - 35}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <span className="font-semibold text-[10px] text-slate-400 uppercase tracking-widest">{points[trendHoverIndex].name}</span>
                <span className="font-mono font-bold text-indigo-400 mt-0.5">${points[trendHoverIndex].val.toFixed(2)} spent</span>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic visual health card summaries */}
        <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-5 mt-6 text-center">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block font-sans">Logged Influx</span>
            <span className="font-mono font-bold text-sm md:text-base text-emerald-600 mt-1 block">${income.toFixed(2)}</span>
          </div>
          <div className="border-x border-slate-100">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block font-sans">Logged Spent</span>
            <span className="font-mono font-bold text-sm md:text-base text-red-500 mt-1 block">${totalSpent.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block font-sans">Current Savings</span>
            <span className={`font-mono font-bold text-sm md:text-base mt-1 block ${netSavings < 0 ? "text-red-500" : "text-indigo-600"}`}>
              ${netSavings.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. CATEGORY BREAKDOWN BENTO LIST (BAR CHART & METERS) */}
      <div className="lg:col-span-4 bg-white border border-slate-100 p-6 rounded-2xl shadow-xs flex flex-col justify-between hover:shadow-md transition-all duration-300">
        <div>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-display">
                <PieChart className="w-4 h-4 text-indigo-500" />
                Category Budget
              </h3>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Expenses compared to budget limits
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {categoriesList.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-sans">
                No active transaction expenses registered yet. Ingest statements to populate.
              </div>
            ) : (
              categoriesList.slice(0, 5).map((cat, idx) => (
                <div
                  key={cat.name}
                  className="space-y-1.5 select-none cursor-pointer group"
                  onMouseEnter={() => setActiveDonutIndex(idx)}
                  onMouseLeave={() => setActiveDonutIndex(null)}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="font-semibold text-slate-700">{cat.name}</span>
                      <span className="text-[9px] font-medium font-mono text-slate-400">({cat.percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <span className="font-semibold text-slate-800">${cat.spent.toFixed(0)}</span>
                      <span className="text-slate-300">/</span>
                      <span className="font-medium text-slate-450">${cat.limit}</span>
                    </div>
                  </div>

                  {/* Meter Bar */}
                  <div className="w-full bg-slate-50 h-2.5 rounded-full overflow-hidden relative">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        backgroundColor: cat.color,
                        width: `${Math.min(cat.pctOfLimit, 100)}%`,
                      }}
                    />
                    {/* Visual Threshold Alert Line */}
                    {cat.pctOfLimit > 100 && (
                      <div className="absolute inset-y-0 right-0 h-full bg-red-400/20 w-4 animate-pulse" title="Budget Exceeded!" />
                    )}
                  </div>
                  
                  {/* Alert warning if exceeding limit */}
                  {cat.pctOfLimit > 100 && (
                    <div className="text-[10px] text-red-500 font-medium tracking-tight flex items-center gap-1">
                      <span>Threshold breach! (+${Math.abs(cat.spent - cat.limit).toFixed(0)})</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Saving Potential forecasted gauge */}
        {categoriesList.length > 0 && (
          <div className="border-t border-slate-100 pt-4 mt-6">
            <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-xl p-3 flex gap-3 items-center">
              <div className="h-9 w-9 shrink-0 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shadow-xs">
                <Percent className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block font-sans">Projected Saving</span>
                <span className="text-[11px] text-slate-600 mt-0.5 block leading-tight font-sans">
                  Optimize billing options to cut monthly outgoings by up to <strong className="bg-[#4f46e5]/10 rounded px-1 text-indigo-600 font-mono font-bold">${savingsPotential}</strong>!
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
