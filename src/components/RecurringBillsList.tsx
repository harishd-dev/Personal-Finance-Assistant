import React, { useState } from "react";
import {
  CreditCard, Plus, Trash2, Zap, Trophy, RefreshCw, CheckSquare, Square,
} from "lucide-react";
import { RecurringBill, BillSavingSuggestion } from "../types";

interface RecurringBillsProps {
  bills: RecurringBill[];
  suggestions: BillSavingSuggestion[];
  isAnalyzing: boolean;
  onAddBill: (newBill: Omit<RecurringBill, "id">) => void;
  onDeleteBill: (id: string) => void;
  onTriggerAnalysis: () => void;
  onApplySavings: (suggestionIndex: number) => void;
}

export default function RecurringBillsList({
  bills, suggestions, isAnalyzing, onAddBill, onDeleteBill, onTriggerAnalysis, onApplySavings,
}: RecurringBillsProps) {
  const [billName, setBillName] = useState("");
  const [currentCost, setCurrentCost] = useState("");
  const [category, setCategory] = useState("Utilities");
  const [dueDate, setDueDate] = useState("1");
  const [activeTab, setActiveTab] = useState<"bills" | "ai">("bills");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billName || !currentCost) return;
    onAddBill({ billName, currentCost: parseFloat(currentCost) || 0, category, dueDate });
    setBillName("");
    setCurrentCost("");
    setDueDate("1");
  };

  const totalBillsAmount = bills.reduce((acc, curr) => acc + curr.currentCost, 0);
  const potentialSavings = suggestions.filter((s) => !s.applied).reduce((acc, s) => acc + s.expectedSavings, 0);

  return (
    <div
      id="recurring-bills-container"
      className="rounded-2xl h-full flex flex-col overflow-hidden brutal-card"
    >
      {/* ── Tab bar ── */}
      <div
        className="flex border-b p-1.5"
        style={{
          backgroundColor: "var(--color-bg-subtle)",
          borderColor: "var(--color-border-medium)",
        }}
      >
        {(["bills", "ai"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl cursor-pointer transition-all"
            style={
              activeTab === tab
                ? {
                    backgroundColor: "var(--color-bg-surface)",
                    color: "var(--color-brand-600)",
                    boxShadow: "var(--shadow-xs)",
                    border: "1px solid var(--color-border-medium)",
                  }
                : {
                    color: "var(--color-text-muted)",
                  }
            }
          >
            {tab === "bills" ? (
              <>
                <CreditCard className="w-4 h-4" />
                Commitment Subs ({bills.length})
              </>
            ) : (
              <>
                <Zap
                  className="w-4 h-4"
                  style={{
                    color: suggestions.length > 0 && !isAnalyzing ? "var(--color-brand-500)" : undefined,
                  }}
                />
                AI Cost Optimizer
                {suggestions.length > 0 && (
                  <span
                    className="rounded-full text-[9px] px-2 py-0.5 font-bold uppercase ml-1"
                    style={{
                      backgroundColor: "var(--color-brand-50)",
                      color: "var(--color-brand-600)",
                    }}
                  >
                    Tips
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </div>

      {/* ── Bills tab ── */}
      {activeTab === "bills" && (
        <div className="p-5 space-y-4 flex-1 flex flex-col">

          {/* Total banner */}
          <div
            className="flex justify-between items-center p-3.5 rounded-xl border"
            style={{
              backgroundColor: "var(--color-bg-subtle)",
              borderColor: "var(--color-border-subtle)",
            }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              Monthly Commitment
            </span>
            <span className="font-mono font-bold text-sm" style={{ color: "var(--color-text-primary)" }}>
              ${totalBillsAmount.toFixed(2)} / month
            </span>
          </div>

          {/* Add bill form */}
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl grid grid-cols-2 lg:grid-cols-4 gap-2 items-center p-3 border"
            style={{
              backgroundColor: "var(--color-bg-subtle)",
              borderColor: "var(--color-border-subtle)",
            }}
          >
            <div className="col-span-2 lg:col-span-1">
              <input
                type="text"
                placeholder="Subscription Name"
                value={billName}
                onChange={(e) => setBillName(e.target.value)}
                className="brutal-input text-xs"
                required
              />
            </div>
            <div>
              <input
                type="number"
                step="0.01"
                placeholder="Cost / Month ($)"
                value={currentCost}
                onChange={(e) => setCurrentCost(e.target.value)}
                className="brutal-input text-xs font-mono"
                required
              />
            </div>
            <div
              className="flex gap-1 rounded-xl overflow-hidden px-1 border"
              style={{
                backgroundColor: "var(--color-bg-surface)",
                borderColor: "var(--color-border-medium)",
              }}
            >
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-transparent text-xs py-1.5 px-0.5 border-none outline-none font-medium truncate flex-1 cursor-pointer"
                style={{ color: "var(--color-text-primary)" }}
              >
                {["Utilities","Subscription","Housing","Insurance"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-transparent text-[10px] py-1.5 px-0.5 border-none outline-none font-medium cursor-pointer"
                style={{ color: "var(--color-text-muted)" }}
                title="Due Day of Month"
              >
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={`${i + 1}`}>{i + 1}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full text-white font-semibold text-[11px] py-2 px-3 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
              style={{ backgroundColor: "var(--color-brand-600)" }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Bill
            </button>
          </form>

          {/* Bills list */}
          <div className="flex-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin select-none">
            {bills.length === 0 ? (
              <div className="text-center py-10 text-xs" style={{ color: "var(--color-text-disabled)" }}>
                No bills registered. Add one above or import a statement.
              </div>
            ) : (
              bills.map((bill) => (
                <div
                  key={bill.id}
                  className="py-3 flex justify-between items-center border-b transition-colors"
                  style={{ borderColor: "var(--color-border-subtle)" }}
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs" style={{ color: "var(--color-text-primary)" }}>
                        {bill.billName}
                      </span>
                      <span
                        className="text-[9px] border rounded px-1.5 py-0.3"
                        style={{
                          backgroundColor: "var(--color-bg-subtle)",
                          color: "var(--color-text-muted)",
                          borderColor: "var(--color-border-subtle)",
                        }}
                      >
                        {bill.category}
                      </span>
                    </div>
                    <span className="text-[10px] block mt-1" style={{ color: "var(--color-text-disabled)" }}>
                      Deducted on day {bill.dueDate} each month
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-xs" style={{ color: "var(--color-text-primary)" }}>
                      ${bill.currentCost.toFixed(2)}
                    </span>
                    <button
                      onClick={() => onDeleteBill(bill.id)}
                      className="p-1.5 rounded-xl transition-colors cursor-pointer"
                      style={{ color: "var(--color-text-disabled)" }}
                      title="Delete bill"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── AI Optimizer tab ── */}
      {activeTab === "ai" && (
        <div className="p-5 space-y-4 flex-1 flex flex-col">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className="text-xs font-semibold leading-tight flex-1" style={{ color: "var(--color-text-secondary)" }}>
              Evaluate subscriptions against current market rates:
            </span>
            <button
              onClick={onTriggerAnalysis}
              disabled={isAnalyzing}
              className="text-white font-semibold text-xs py-2 px-3 rounded-xl flex items-center gap-1 cursor-pointer transition-all disabled:opacity-45"
              style={{ backgroundColor: "var(--color-brand-600)" }}
            >
              {isAnalyzing ? (
                <><RefreshCw className="w-3 h-3 animate-spin mr-1" /> Analyzing...</>
              ) : (
                <><RefreshCw className="w-3 h-3 mr-1" /> Audit Bills</>
              )}
            </button>
          </div>

          {suggestions.length === 0 ? (
            <div
              className="flex-1 border border-dashed rounded-2xl p-8 text-center flex flex-col items-center gap-3 min-h-48 justify-center"
              style={{ borderColor: "var(--color-border-medium)" }}
            >
              <Zap className="w-7 h-7 animate-pulse" style={{ color: "var(--color-brand-400)" }} />
              <span className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Audit Not Yet Triggered
              </span>
              <span className="text-[10px] max-w-xs mt-0.5 font-sans" style={{ color: "var(--color-text-muted)" }}>
                Click "Audit Bills" to generate personalized AI renegotiation scripts.
              </span>
            </div>
          ) : (
            <div className="flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin select-none">
              {/* Potential savings banner */}
              <div
                className="border p-3 rounded-xl flex justify-between items-center text-xs"
                style={{
                  backgroundColor: "var(--color-success-bg)",
                  borderColor: "var(--color-success-border)",
                }}
              >
                <span className="font-bold uppercase tracking-wider text-[10px]"
                      style={{ color: "var(--color-success-text)" }}>
                  Untapped Monthly Margin
                </span>
                <span className="font-mono font-bold" style={{ color: "var(--color-success-text)" }}>
                  ${potentialSavings.toFixed(2)} / mo
                </span>
              </div>

              {suggestions.map((sug, sIndex) => (
                <div
                  key={sIndex}
                  className="border p-3.5 rounded-2xl flex gap-3 transition-colors"
                  style={{
                    backgroundColor: sug.applied ? "var(--color-bg-subtle)" : "var(--color-bg-surface)",
                    borderColor: sug.applied ? "var(--color-border-subtle)" : "var(--color-border-medium)",
                    opacity: sug.applied ? 0.65 : 1,
                  }}
                >
                  <button
                    onClick={() => onApplySavings(sIndex)}
                    className="shrink-0 mt-0.5 cursor-pointer transition-colors"
                    style={{ color: sug.applied ? "var(--color-success-icon)" : "var(--color-text-disabled)" }}
                    title={sug.applied ? "Undo Apply" : "Mark as Applied"}
                  >
                    {sug.applied
                      ? <CheckSquare className="w-5 h-5" />
                      : <Square className="w-5 h-5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-start gap-2 flex-wrap">
                      <span
                        className="text-xs font-bold"
                        style={{
                          color: "var(--color-text-primary)",
                          textDecoration: sug.applied ? "line-through" : "none",
                        }}
                      >
                        {sug.billName}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                        <span
                          className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase"
                          style={
                            sug.difficulty === "Easy"
                              ? { backgroundColor: "var(--color-success-bg)", color: "var(--color-success-text)" }
                              : sug.difficulty === "Medium"
                              ? { backgroundColor: "var(--color-warning-bg)", color: "var(--color-warning-text)" }
                              : { backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger-text)" }
                          }
                        >
                          {sug.difficulty}
                        </span>
                        <span className="font-bold text-xs" style={{ color: "var(--color-success-icon)" }}>
                          +${sug.expectedSavings}/mo
                        </span>
                      </div>
                    </div>
                    <p
                      className="text-[11px] mt-1.5 font-sans leading-relaxed"
                      style={{
                        color: "var(--color-text-tertiary)",
                        textDecoration: sug.applied ? "line-through" : "none",
                      }}
                    >
                      {sug.suggestedAction}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Savings achieved footer ── */}
      {suggestions.length > 0 && activeTab === "ai" && (
        <div
          className="border-t p-3.5 text-xs font-semibold flex items-center justify-between"
          style={{
            backgroundColor: "var(--color-success-bg)",
            borderColor: "var(--color-success-border)",
            color: "var(--color-success-text)",
          }}
        >
          <span className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4" style={{ color: "var(--color-success-icon)" }} />
            Savings Applied This Month
          </span>
          <span className="font-mono font-bold text-xs">
            ${suggestions.filter((s) => s.applied).reduce((acc, s) => acc + s.expectedSavings, 0).toFixed(2)} / mo
          </span>
        </div>
      )}
    </div>
  );
}