import React, { useState } from "react";
import { CreditCard, Plus, Trash2, Zap, Trophy, RefreshCw, CheckSquare, Square } from "lucide-react";
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
  bills,
  suggestions,
  isAnalyzing,
  onAddBill,
  onDeleteBill,
  onTriggerAnalysis,
  onApplySavings
}: RecurringBillsProps) {
  const [billName, setBillName] = useState("");
  const [currentCost, setCurrentCost] = useState("");
  const [category, setCategory] = useState("Utilities");
  const [dueDate, setDueDate] = useState("1"); // day of month
  const [activeTab, setActiveTab] = useState<"bills" | "ai">("bills");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billName || !currentCost) return;

    onAddBill({
      billName,
      currentCost: parseFloat(currentCost) || 0,
      category,
      dueDate,
    });

    setBillName("");
    setCurrentCost("");
    setDueDate("1");
  };

  const totalBillsAmount = bills.reduce((acc, curr) => acc + curr.currentCost, 0);
  const potentialSavingsAmount = suggestions
    .filter(s => !s.applied)
    .reduce((acc, curr) => acc + curr.expectedSavings, 0);

  return (
    <div id="recurring-bills-container" className="bg-white border border-slate-100 rounded-2xl shadow-sm h-full flex flex-col justify-between overflow-hidden hover:shadow-md transition-all duration-300">
      
      {/* Tab Navigation header */}
      <div>
        <div className="flex border-b border-slate-100 p-1.5 bg-slate-50/50">
          <button
            onClick={() => setActiveTab("bills")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl cursor-pointer transition-all ${
              activeTab === "bills"
                ? "bg-white text-indigo-650 shadow-2xs border border-slate-250/20"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/30"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Commitment Subs ({bills.length})
          </button>
          
          <button
            onClick={() => setActiveTab("ai")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl cursor-pointer transition-all ${
              activeTab === "ai"
                ? "bg-white text-indigo-655 shadow-2xs border border-slate-250/20"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/30"
            }`}
          >
            <Zap className={`w-4 h-4 ${suggestions.length > 0 && !isAnalyzing ? "text-indigo-500 animate-pulse" : ""}`} />
            AI Cost Optimizer
            {suggestions.length > 0 && (
              <span className="bg-indigo-100 text-indigo-700 rounded-full text-[9px] px-2 py-0.5 font-bold uppercase ml-1">
                Tips
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: List Bills content */}
        {activeTab === "bills" ? (
          <div className="p-5 space-y-4">
            <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Monthly Commitment</span>
              <span className="font-mono font-bold text-sm text-slate-800">${totalBillsAmount.toFixed(2)} / month</span>
            </div>

            {/* Quick Bill Append Form */}
            <form onSubmit={handleSubmit} className="border border-slate-100 p-3 bg-slate-50/25 rounded-2xl grid grid-cols-2 lg:grid-cols-4 gap-2 items-center">
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
              <div className="flex gap-1 bg-white border border-slate-200 rounded-xl overflow-hidden px-1">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-transparent text-xs py-1.5 px-0.5 border-none outline-none text-slate-600 dark:text-slate-100 font-medium truncate flex-1 cursor-pointer"
                >
                  <option value="Utilities">Utilities</option>
                  <option value="Subscription">Sub</option>
                  <option value="Housing">Housing</option>
                  <option value="Insurance">Insurance</option>
                </select>
                
                <select
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-transparent text-[10px] py-1.5 px-0.5 border-none outline-none text-slate-400 dark:text-slate-300 font-medium cursor-pointer"
                  title="Due Day of Month"
                >
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i+1} value={`${i+1}`}>{i+1}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] py-2 px-3 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Bill
              </button>
            </form>

            {/* List rendered table */}
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 pr-1 scrollbar-thin select-none">
              {bills.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No monthly bills registered. Import a statement or add some above.
                </div>
              ) : (
                bills.map((bill) => (
                  <div key={bill.id} className="py-3 flex justify-between items-center hover:bg-slate-50/50 transition-colors">
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-700">{bill.billName}</span>
                        <span className="text-[9px] bg-slate-50 text-slate-400 border border-slate-100 rounded px-1.5 py-0.3">{bill.category}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1">Deducted on day {bill.dueDate} each month</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-xs text-slate-800">${bill.currentCost.toFixed(2)}</span>
                      <button
                        onClick={() => onDeleteBill(bill.id)}
                        className="text-slate-400 hover:text-red-500 hover:bg-rose-50 p-1.5 rounded-xl transition-colors cursor-pointer"
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
        ) : (
          /* Tab 2: AI Cost Optimizer Suggestions panel */
          <div className="p-5 space-y-4">
            
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <span className="text-xs text-slate-500 font-semibold leading-tight flex-1">
                Evaluate subscription pricing against current market rates:
              </span>
              <button
                onClick={onTriggerAnalysis}
                disabled={isAnalyzing}
                className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-xs py-2 px-3 rounded-xl flex items-center gap-1 cursor-pointer transition-all disabled:opacity-45"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin mr-1" /> Optimizing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1" /> Audit Bills
                  </>
                )}
              </button>
            </div>

            {/* List saving prompts */}
            {suggestions.length === 0 ? (
              <div className="border border-dashed border-slate-200 bg-slate-50/20 rounded-2xl p-8 text-center flex flex-col items-center gap-3 h-48 justify-center">
                <Zap className="w-7 h-7 text-indigo-400 animate-pulse" />
                <span className="text-xs font-semibold text-slate-700">Audit Not Triggered Yet</span>
                <span className="text-[10px] text-slate-400 max-w-xs mt-0.5 font-sans">
                  Click 'Audit Bills' to generate personalized AI renegotiation scripts.
                </span>
              </div>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1 scrollbar-thin select-none">
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex justify-between items-center text-xs">
                  <span className="text-emerald-800 font-bold uppercase tracking-wider text-[10px]">Untapped Monthly Margin</span>
                  <span className="font-mono font-bold text-emerald-800">${potentialSavingsAmount.toFixed(2)} / mo</span>
                </div>

                {suggestions.map((sug, sIndex) => (
                  <div
                    key={sIndex}
                    className={`border p-3.5 rounded-2xl flex gap-3 transition-colors ${
                      sug.applied 
                        ? "bg-slate-50 border-slate-200 opacity-60" 
                        : "bg-white border-slate-100 hover:border-slate-200"
                    }`}
                  >
                    <button
                      onClick={() => onApplySavings(sIndex)}
                      className="shrink-0 mt-0.5 cursor-pointer text-slate-300 hover:text-indigo-600 transition-colors"
                      title={sug.applied ? "Undo Apply" : "Mark as Applied"}
                    >
                      {sug.applied ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600 font-bold" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300 hover:text-indigo-500" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-start gap-2 flex-wrap">
                        <span className={`text-xs font-bold ${sug.applied ? "line-through text-slate-400" : "text-slate-700"}`}>
                          {sug.billName}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            sug.difficulty === "Easy" ? "bg-emerald-100 text-emerald-700" :
                            sug.difficulty === "Medium" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                          }`}>
                            {sug.difficulty}
                          </span>
                          <span className="font-bold text-emerald-600 text-xs">
                            +${sug.expectedSavings}/mo
                          </span>
                        </div>
                      </div>
                      <p className={`text-[11px] text-slate-500 mt-1.5 font-sans leading-relaxed ${sug.applied ? "line-through" : ""}`}>
                        {sug.suggestedAction}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {suggestions.length > 0 && activeTab === "ai" && (
        <div className="bg-emerald-50 border-t border-emerald-100 p-3.5 text-xs font-semibold flex items-center justify-between text-emerald-800">
          <span className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-emerald-600" /> Real Savings Achieved Today
          </span>
          <span className="font-mono text-xs font-bold">
            ${suggestions.filter(s => s.applied).reduce((acc, curr) => acc + curr.expectedSavings, 0).toFixed(2)} / mo
          </span>
        </div>
      )}
    </div>
  );
}
