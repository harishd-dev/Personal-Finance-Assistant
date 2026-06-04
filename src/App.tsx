import React, { useState, useEffect, useRef } from "react";
import {
  Wallet,
  TrendingUp,
  Receipt,
  FileText,
  DollarSign,
  Plus,
  Compass,
  CreditCard,
  Cloud,
  Sparkles,
  AlertTriangle,
  Bell,
  X,
  Printer,
  TrendingDown,
  Trash2,
  Lock,
  RefreshCw,
} from "lucide-react";
import {
  Transaction,
  RecurringBill,
  BillSavingSuggestion,
  HabitSavingSuggestion,
  VisualBudgetAlert,
} from "./types";
import ReceiptScanner from "./components/ReceiptScanner";
import StatementImporter from "./components/StatementImporter";
import SpendingCharts from "./components/SpendingCharts";
import RecurringBillsList from "./components/RecurringBillsList";
import CloudSync from "./components/CloudSync";
import PersonalAdvisor from "./components/PersonalAdvisor";
import { useAuth } from "./context/AuthContext";
import AuthPage from "./auth/AuthPage";
import ThemeToggle from "./components/theme/ThemeToggle";
import ProfileDropdown from "./components/profile/ProfileDropdown";
import { supabase } from "./services/supabase";
import { socialLinks } from "./config/socialLinks";
import { Globe, Mail, Linkedin, Github, Instagram } from "lucide-react";

export default function App() {
  const { user, profile, isLoading, demoModeActive, signOut } = useAuth();

  // UUID v4 generator compatible with Postgres / Supabase
  const generateUUID = () =>
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

  // ----------------------------------------------------------------
  // STATE
  // ----------------------------------------------------------------
  const [income, setIncome] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // BUG #2 FIX: Track whether we've already fetched data for the current user
  // to prevent duplicate fetches on re-renders.
  const fetchedForUserRef = useRef<string | null>(null);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(1);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState<boolean>(false);

  const [alerts, setAlerts] = useState<VisualBudgetAlert[]>([
    {
      id: "alert-1",
      timestamp: new Date(),
      type: "info",
      title: "Assistant Activated",
      message: "AI Finance Optimizer is online. Scan receipts or drop statements to check saving leaks.",
      isRead: false,
    },
  ]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [savingsSuggestions, setSavingsSuggestions] = useState<BillSavingSuggestion[]>([]);
  const [habitSuggestions, setHabitSuggestions] = useState<HabitSavingSuggestion[]>([]);
  const [alertMenuOpen, setAlertMenuOpen] = useState(false);

  // Manual transaction form
  const [manualMerchant, setManualMerchant] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualCategory, setManualCategory] = useState<Transaction["category"]>("Food");
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualIsRecurring, setManualIsRecurring] = useState(false);

  // ----------------------------------------------------------------
  // ALERT HELPER
  // ----------------------------------------------------------------
  const triggerAlert = (
    title: string,
    message: string,
    type: "warning" | "info" | "success" = "info"
  ) => {
    const newAlert: VisualBudgetAlert = {
      id: `alert-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      type,
      title,
      message,
      isRead: false,
    };
    setAlerts((prev) => [newAlert, ...prev]);
  };

  // ----------------------------------------------------------------
  // BUG #2 FIX: fetchUserDataFromCloud is now a stable, non-recursive
  // function that can safely be called from useEffect and handlers.
  // It uses fetchedForUserRef to prevent double-fetching on re-renders.
  // ----------------------------------------------------------------
  const fetchUserDataFromCloud = async (userId: string, showAlert = false) => {
    if (!userId || !supabase) return;

    setIsDbLoading(true);
    setUnsavedChanges(false);

    try {
      const [txRes, billRes, sugRes] = await Promise.all([
        (supabase as any)
          .from("transactions")
          .select("*")
          .eq("user_id", userId)
          .order("date", { ascending: false }),
        (supabase as any).from("recurring_bills").select("*").eq("user_id", userId),
        (supabase as any).from("savings_suggestions").select("*").eq("user_id", userId),
      ]);

      if (txRes.error) throw new Error(`Transactions load failed: ${txRes.error.message}`);
      if (billRes.error) throw new Error(`Bills load failed: ${billRes.error.message}`);
      if (sugRes.error) throw new Error(`Suggestions load failed: ${sugRes.error.message}`);

      const mappedTxs: Transaction[] = (txRes.data || []).map((t: any) => ({
        id: t.id,
        date: t.date,
        merchant: t.merchant,
        description: t.description || "",
        amount: Number(t.amount),
        category: t.category,
        isRecurring: t.is_recurring,
        source: t.source || "manual",
      }));

      const mappedBills: RecurringBill[] = (billRes.data || []).map((b: any) => ({
        id: b.id,
        billName: b.bill_name,
        currentCost: Number(b.current_cost),
        category: b.category,
        dueDate: b.due_date,
        isPaid: b.is_paid,
      }));

      const mappedSugs: BillSavingSuggestion[] = (sugRes.data || []).map((s: any) => ({
        billName: s.bill_name,
        currentCost: Number(s.current_cost),
        suggestedAction: s.suggested_action,
        expectedSavings: Number(s.expected_savings),
        difficulty: s.difficulty,
        applied: s.applied,
      }));

      setTransactions(mappedTxs);
      setBills(mappedBills);
      setSavingsSuggestions(mappedSugs);
      setUnsavedChanges(false);

      // Cache locally for fast offline load
      localStorage.setItem("PFA_TRANSACTIONS", JSON.stringify(mappedTxs));
      localStorage.setItem("PFA_BILLS", JSON.stringify(mappedBills));
      localStorage.setItem("PFA_SUGGESTIONS", JSON.stringify(mappedSugs));

      // Show onboarding tutorial for new users
      const localCompletedKey = `PFA_COMPLETED_ONBOARDING_${userId}`;
      const hasCompletedOnboarding = localStorage.getItem(localCompletedKey) === "true";
      if (mappedTxs.length === 0 && mappedBills.length === 0 && !hasCompletedOnboarding) {
        setShowTutorial(true);
        if (showAlert) {
          triggerAlert("Welcome!", "Set up your financial profile to calibrate your dashboard.", "success");
        }
      } else {
        setShowTutorial(false);
        if (showAlert) {
          triggerAlert(
            "Sync Successful",
            `Retrieved ${mappedTxs.length} transactions and ${mappedBills.length} bills.`,
            "success"
          );
        }
      }
    } catch (err: any) {
      console.error("Supabase data fetch error:", err);
      const msg = err.message || String(err);
      const hint = msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("relation")
        ? " — Run supabase_schema.sql in your Supabase SQL Editor to create required tables."
        : "";
      if (showAlert) {
        triggerAlert("Data Retrieval Failed", `${msg}${hint}`, "warning");
      }
    } finally {
      setIsDbLoading(false);
    }
  };

  // ----------------------------------------------------------------
  // BUG #2 ROOT FIX: Single, correct useEffect for data hydration.
  //
  // PROBLEM in original code:
  //   1. The effect watched [user, demoModeActive] but the auth listener
  //      in AuthContext was setting user=null briefly before re-setting
  //      the authenticated user, causing the effect to run twice —
  //      first clearing data, then (sometimes) re-fetching it.
  //   2. After logout + re-login, the user object was a new reference
  //      but demoModeActive hadn't changed, so the effect might not
  //      re-run, leaving the UI empty.
  //
  // FIX:
  //   - Watch user?.id specifically (stable identity, not object reference)
  //   - Use fetchedForUserRef to ensure we only fetch ONCE per user session
  //   - On user=null (logout): clear state and reset the ref
  //   - On demo mode: load from localStorage cache
  // ----------------------------------------------------------------
  useEffect(() => {
    const userId = user?.id ?? null;

    if (!userId) {
      // User logged out or was never logged in — clear all data
      if (fetchedForUserRef.current !== null) {
        // Only clear if we previously had data (prevents clearing on initial load)
        setTransactions([]);
        setBills([]);
        setSavingsSuggestions([]);
        setHabitSuggestions([]);
        setIncome(0);
        fetchedForUserRef.current = null;
      }

      // Load cached data for demo mode
      if (demoModeActive) {
        try {
          const cachedTxs = localStorage.getItem("PFA_TRANSACTIONS");
          const cachedBills = localStorage.getItem("PFA_BILLS");
          const cachedSuggestions = localStorage.getItem("PFA_SUGGESTIONS");
          const cachedAlerts = localStorage.getItem("PFA_ALERTS");
          const cachedIncome = localStorage.getItem("PFA_INCOME");

          if (cachedTxs) setTransactions(JSON.parse(cachedTxs));
          if (cachedBills) setBills(JSON.parse(cachedBills));
          if (cachedSuggestions) setSavingsSuggestions(JSON.parse(cachedSuggestions));
          if (cachedAlerts) {
            setAlerts(
              JSON.parse(cachedAlerts).map((a: any) => ({
                ...a,
                timestamp: new Date(a.timestamp),
              }))
            );
          }
          if (cachedIncome) setIncome(Number(cachedIncome));
        } catch (e) {
          console.warn("Failed to load cached demo data:", e);
        }
      }
      return;
    }

    // Authenticated user — fetch their data from Supabase
    if (demoModeActive || !supabase) {
      // Authenticated but no Supabase (shouldn't happen, but handle gracefully)
      return;
    }

    // BUG #2 FIX: Only fetch if we haven't already fetched for this user
    // This prevents double-fetches caused by component re-renders or
    // React StrictMode double-invoking effects in development.
    if (fetchedForUserRef.current === userId) {
      return;
    }

    fetchedForUserRef.current = userId;
    fetchUserDataFromCloud(userId, false); // silent fetch on login

  }, [user?.id, demoModeActive]); // watch user?.id, not the whole user object

  // ----------------------------------------------------------------
  // INCOME SYNC: Load income from profile or localStorage
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!profile) {
      const localInc = localStorage.getItem("PFA_INCOME");
      if (localInc) setIncome(Number(localInc));
      return;
    }

    // Try to extract income from the profile's theme_preference JSON blob
    const pref = profile.theme_preference;
    if (pref && pref !== "light" && pref !== "dark") {
      try {
        const parsed = JSON.parse(pref as string);
        if (parsed && typeof parsed.monthly_income === "number") {
          setIncome(parsed.monthly_income);
          return;
        }
      } catch (e) {}
    }

    // Fall back to localStorage
    const localInc = localStorage.getItem("PFA_INCOME");
    if (localInc) setIncome(Number(localInc));
  }, [profile?.id]); // only re-run when profile identity changes, not on every render

  // ----------------------------------------------------------------
  // PERSIST CACHE: Keep localStorage in sync with state
  // ----------------------------------------------------------------
  useEffect(() => {
    localStorage.setItem("PFA_TRANSACTIONS", JSON.stringify(transactions));
    localStorage.setItem("PFA_BILLS", JSON.stringify(bills));
    localStorage.setItem("PFA_SUGGESTIONS", JSON.stringify(savingsSuggestions));
    localStorage.setItem("PFA_ALERTS", JSON.stringify(alerts));
  }, [transactions, bills, savingsSuggestions, alerts]);

  // ----------------------------------------------------------------
  // AUTO-SYNC: Background sync every 10s when there are unsaved changes
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!unsavedChanges || demoModeActive || !user?.id || !supabase) return;

    const interval = setInterval(() => {
      if (unsavedChanges) {
        syncAllToSupabase(true);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [unsavedChanges, demoModeActive, user?.id]);

  // ----------------------------------------------------------------
  // TUTORIAL: Show for new users once data loads
  // ----------------------------------------------------------------
  useEffect(() => {
    if (user && !isLoading) {
      const completedKey = `PFA_COMPLETED_ONBOARDING_${user.id}`;
      const completed = localStorage.getItem(completedKey);
      if (!completed && transactions.length === 0 && bills.length === 0) {
        setShowTutorial(true);
      }
    }
  }, [transactions.length, bills.length, isLoading, user?.id]);

  // ----------------------------------------------------------------
  // SETTINGS SAVE
  // ----------------------------------------------------------------
  const saveOverallSettings = async (newIncome: number, newTheme?: "light" | "dark") => {
    setIncome(newIncome);
    localStorage.setItem("PFA_INCOME", String(newIncome));
    setUnsavedChanges(true);

    const themeValue: "light" | "dark" =
      newTheme || ((localStorage.getItem("theme_pref") as "light" | "dark") ?? "light");
    const completedKey = user ? `PFA_COMPLETED_ONBOARDING_${user.id}` : "PFA_COMPLETED_ONBOARDING";
    const isCompleted = localStorage.getItem(completedKey) === "true";

    const payload = JSON.stringify({
      theme: themeValue,
      theme_preference: themeValue,
      monthly_income: newIncome,
      onboarding_completed: isCompleted,
    });

    localStorage.setItem("theme_pref", themeValue);
    if (profile) (profile as any).theme_preference = payload;

    triggerAlert(
      "Settings Saved",
      `Monthly income set to $${newIncome.toFixed(2)}. Click Sync Cloud to persist.`,
      "info"
    );
  };

  // ----------------------------------------------------------------
  // SUPABASE SYNC
  // ----------------------------------------------------------------
  const syncAllToSupabase = async (isAutoSync = false) => {
    if (demoModeActive || !user?.id || !supabase) {
      if (!isAutoSync) {
        triggerAlert("Sync Unavailable", "Database storage requires an active authenticated session.", "warning");
      }
      return false;
    }

    setIsDbLoading(true);
    if (!isAutoSync) {
      triggerAlert("Syncing...", "Uploading your data to Supabase...", "info");
    }

    try {
      // Get existing IDs to compute deltas
      const [txDb, billDb, sugDb] = await Promise.all([
        (supabase as any).from("transactions").select("id").eq("user_id", user.id),
        (supabase as any).from("recurring_bills").select("id").eq("user_id", user.id),
        (supabase as any).from("savings_suggestions").select("id").eq("user_id", user.id),
      ]);

      if (txDb.error) throw txDb.error;
      if (billDb.error) throw billDb.error;
      if (sugDb.error) throw sugDb.error;

      const dbTxIds = new Set((txDb.data || []).map((t: any) => t.id));
      const dbBillIds = new Set((billDb.data || []).map((b: any) => b.id));

      // Save profile metadata (income + theme)
      const currentTheme = localStorage.getItem("theme_pref") === "dark" ? "dark" : "light";
      const completedKey = `PFA_COMPLETED_ONBOARDING_${user.id}`;
      const isCompleted = localStorage.getItem(completedKey) === "true";
      const profilePayload = JSON.stringify({
        theme: currentTheme,
        theme_preference: currentTheme,
        monthly_income: income,
        onboarding_completed: isCompleted,
      });

      const profileUpdate = await (supabase as any)
        .from("profiles")
        .update({ theme_preference: profilePayload } as any)
        .eq("id", user.id);
      if (profileUpdate.error) throw profileUpdate.error;

      // Delete removed transactions
      const localTxIds = new Set(transactions.map((t) => t.id));
      const txsToDelete = [...dbTxIds].filter((id) => !localTxIds.has(id as string));
      if (txsToDelete.length > 0) {
        const r = await (supabase as any)
          .from("transactions")
          .delete()
          .in("id", txsToDelete)
          .eq("user_id", user.id);
        if (r.error) throw r.error;
      }

      // Upsert current transactions
      if (transactions.length > 0) {
        const txsToUpsert = transactions.map((t) => ({
          id: t.id,
          user_id: user.id,
          date: t.date,
          merchant: t.merchant,
          description: t.description || "",
          amount: t.amount,
          category: t.category,
          is_recurring: t.isRecurring,
          source: t.source || "manual",
        }));
        const r = await (supabase as any).from("transactions").upsert(txsToUpsert);
        if (r.error) throw r.error;
      }

      // Delete removed bills
      const localBillIds = new Set(bills.map((b) => b.id));
      const billsToDelete = [...dbBillIds].filter((id) => !localBillIds.has(id as string));
      if (billsToDelete.length > 0) {
        const r = await (supabase as any)
          .from("recurring_bills")
          .delete()
          .in("id", billsToDelete)
          .eq("user_id", user.id);
        if (r.error) throw r.error;
      }

      // Upsert current bills
      if (bills.length > 0) {
        const billsToUpsert = bills.map((b) => ({
          id: b.id,
          user_id: user.id,
          bill_name: b.billName,
          current_cost: b.currentCost,
          category: b.category,
          due_date: b.dueDate,
          is_paid: b.isPaid || false,
        }));
        const r = await (supabase as any).from("recurring_bills").upsert(billsToUpsert);
        if (r.error) throw r.error;
      }

      // Replace savings suggestions entirely (simpler than delta sync)
      await (supabase as any).from("savings_suggestions").delete().eq("user_id", user.id);
      if (savingsSuggestions.length > 0) {
        const suggestionsToInsert = savingsSuggestions.map((s) => ({
          user_id: user.id,
          bill_name: s.billName,
          current_cost: s.currentCost,
          suggested_action: s.suggestedAction,
          expected_savings: s.expectedSavings,
          difficulty: s.difficulty,
          applied: s.applied || false,
        }));
        const r = await (supabase as any).from("savings_suggestions").insert(suggestionsToInsert);
        if (r.error) throw r.error;
      }

      setUnsavedChanges(false);
      if (!isAutoSync) {
        triggerAlert("Sync Complete", "All data saved to Supabase successfully.", "success");
      }
      return true;
    } catch (err: any) {
      console.error("Supabase sync error:", err);
      if (!isAutoSync) {
        triggerAlert("Sync Failed", `Error: ${err.message || err}`, "warning");
      }
      return false;
    } finally {
      setIsDbLoading(false);
    }
  };

  // ----------------------------------------------------------------
  // LOCAL BACKUP DOWNLOAD
  // ----------------------------------------------------------------
  const handleDownloadBackup = () => {
    try {
      const payload = { income, transactions, bills, savingsSuggestions, timestamp: new Date().toISOString() };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
      const a = document.createElement("a");
      a.setAttribute("href", dataStr);
      a.setAttribute("download", `pfa_finance_ledger_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.warn("Backup download blocked in iframe:", err);
    }
  };

  // ----------------------------------------------------------------
  // TRANSACTION HANDLERS
  // ----------------------------------------------------------------
  const handleAddManualTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualMerchant || !manualAmount) return;

    const parsedAmt = parseFloat(manualAmount) || 0;
    const finalAmt = manualCategory === "Income" ? Math.abs(parsedAmt) : -Math.abs(parsedAmt);

    const newTx: Transaction = {
      id: generateUUID(),
      date: manualDate,
      merchant: manualMerchant,
      description: `Manual Log - ${manualMerchant}`,
      amount: finalAmt,
      category: manualCategory,
      isRecurring: manualIsRecurring,
      source: "manual",
    };

    setTransactions((prev) => [newTx, ...prev]);
    setUnsavedChanges(true);
    triggerAlert(
      "Transaction Added",
      `Logged $${Math.abs(finalAmt).toFixed(2)} at ${manualMerchant}. Sync Cloud to save permanently.`,
      manualCategory === "Income" ? "success" : "info"
    );

    setManualMerchant("");
    setManualAmount("");
    setManualIsRecurring(false);

    if (finalAmt < -250) {
      triggerAlert("High Outflow", `Large charge of $${Math.abs(finalAmt).toFixed(0)} recorded for ${manualMerchant}.`, "warning");
    }
  };

  const handleDeleteTransaction = (id: string, merchant: string, amount: number) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setUnsavedChanges(true);
    triggerAlert("Transaction Deleted", `Removed $${Math.abs(amount).toFixed(2)} at ${merchant}.`, "info");
  };

  const handleImportStatement = (imported: Transaction[]) => {
    const cleaned = imported.map((t) => ({ ...t, id: generateUUID() }));
    setTransactions((prev) => [...cleaned, ...prev]);
    setUnsavedChanges(true);
    triggerAlert("Statement Imported", `Added ${cleaned.length} transactions. Sync Cloud to save.`, "success");
  };

  const handleAddScannerTransaction = (txData: Omit<Transaction, "id">) => {
    const fresh: Transaction = { ...txData, id: generateUUID() };
    setTransactions((prev) => [fresh, ...prev]);
    setUnsavedChanges(true);
    triggerAlert("Receipt Scanned", `Logged $${Math.abs(fresh.amount).toFixed(2)} at ${fresh.merchant}.`, "success");
  };

  const handleAddBill = (data: Omit<RecurringBill, "id">) => {
    const newBill: RecurringBill = { id: generateUUID(), ...data };
    setBills((prev) => [...prev, newBill]);
    setUnsavedChanges(true);
    triggerAlert("Bill Added", `Added ${data.billName} at $${data.currentCost}/mo.`, "success");
  };

  const handleDeleteBill = (id: string) => {
    const targeted = bills.find((b) => b.id === id);
    setBills((prev) => prev.filter((b) => b.id !== id));
    setUnsavedChanges(true);
    if (targeted) {
      triggerAlert("Bill Deleted", `Removed ${targeted.billName}.`, "info");
    }
  };

  const handleTriggerAISavingsAudit = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/analyze-finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions, monthlyBills: bills, income }),
      });
      if (!response.ok) throw new Error("Analysis API failed");
      const data = await response.json();
      if (data.recurringBillSavings) {
        setSavingsSuggestions(data.recurringBillSavings.map((s: any) => ({ ...s, applied: false })));
        setUnsavedChanges(true);
      }
      if (data.generalHabitSavings) setHabitSuggestions(data.generalHabitSavings);
      triggerAlert(
        "AI Audit Complete",
        `Found potential savings of $${data.budgetForecast?.savingsPotential || 0}/mo!`,
        "success"
      );
    } catch (err: any) {
      triggerAlert("Audit Failed", "Could not run analysis. Ensure GEMINI_API_KEY is set.", "warning");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplySavingsCheck = (index: number) => {
    const copy = [...savingsSuggestions];
    copy[index].applied = !copy[index].applied;
    setSavingsSuggestions(copy);
    setUnsavedChanges(true);
    const isApplied = copy[index].applied;
    triggerAlert(
      isApplied ? "Savings Applied" : "Savings Reverted",
      isApplied
        ? `Marked ${copy[index].billName} optimization applied. +$${copy[index].expectedSavings}/mo!`
        : `Reverted ${copy[index].billName} optimization.`,
      isApplied ? "success" : "info"
    );
  };

  const handleTriggerLocalDownload = (format: "csv" | "json") => {
    if (format === "csv") {
      const headers = ["Date", "Merchant/Description", "Category", "Amount ($)", "Source"];
      const rows = transactions.map((t) => [
        t.date,
        `"${t.merchant.replace(/"/g, '""')}"`,
        t.category,
        t.amount.toFixed(2),
        t.source || "manual",
      ]);
      const csvStr = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `FINANCE_REPORT_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const payload = JSON.stringify({ income, transactions, bills, savingsSuggestions, timestamp: new Date().toISOString() }, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `PF_BACKUP_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleTriggerPDFPrintReview = () => window.print();

  // ----------------------------------------------------------------
  // DERIVED VALUES
  // ----------------------------------------------------------------
  const totalVariablePaid = Math.abs(
    transactions.filter((t) => t.amount < 0).reduce((acc, curr) => acc + curr.amount, 0)
  );
  const activeUnreadAlerts = alerts.filter((a) => !a.isRead).length;

  // ----------------------------------------------------------------
  // RENDER GUARDS
  // ----------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4"
           style={{ backgroundColor: "var(--color-bg-base)" }}>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-11 w-11 bg-indigo-600 text-white flex items-center justify-center rounded-2xl shadow-lg animate-bounce">
            <Wallet className="w-5 h-5 text-indigo-100" />
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider font-mono"
               style={{ color: "var(--color-text-muted)" }}>
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
            Synchronizing Secure Session...
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  // ----------------------------------------------------------------
  // MAIN RENDER
  // ----------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col antialiased font-sans"
         style={{ backgroundColor: "var(--color-bg-base)", color: "var(--color-text-primary)" }}>

      {/* ── HEADER ── */}
      <header className="border-b sticky top-0 z-50 print:hidden backdrop-blur-md"
              style={{
                backgroundColor: "rgba(var(--color-bg-surface-raw, 255,255,255), 0.90)",
                borderBottomColor: "var(--color-border-medium)",
                boxShadow: "var(--shadow-xs)",
              }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-indigo-600 text-white flex items-center justify-center rounded-xl shadow-sm">
              <Wallet className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight font-display"
                  style={{ color: "var(--color-text-primary)" }}>
                AI Finance Assistant
              </h1>
              <p className="text-[9px] font-semibold tracking-wider uppercase"
                 style={{ color: "var(--color-text-muted)" }}>
                REAL-TIME CASHFLOW DISCOVERY
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            {/* Cloud Sync / Refresh button */}
            <button
              onClick={() => {
                if (unsavedChanges) {
                  syncAllToSupabase(false);
                } else if (user?.id && !demoModeActive) {
                  fetchUserDataFromCloud(user.id, true);
                }
              }}
              className="p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer relative"
              style={{
                backgroundColor: unsavedChanges ? "var(--color-warning-bg)" : "var(--color-bg-surface)",
                borderColor: unsavedChanges ? "var(--color-warning-border)" : "var(--color-border-medium)",
                color: unsavedChanges ? "var(--color-warning-text)" : "var(--color-text-secondary)",
              }}
              title={unsavedChanges ? "Unsaved changes! Click to sync." : "Refresh data from cloud."}
            >
              <Cloud className="w-4 h-4" style={{ color: unsavedChanges ? "var(--color-warning-icon)" : "var(--color-brand-500)" }} />
              <span className="hidden md:inline">{unsavedChanges ? "Sync Cloud" : "Refresh"}</span>
              {unsavedChanges && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              )}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => {
                  setAlertMenuOpen(!alertMenuOpen);
                  setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
                }}
                className="relative p-2 rounded-xl border transition-colors cursor-pointer"
                style={{
                  backgroundColor: "var(--color-bg-surface)",
                  borderColor: "var(--color-border-medium)",
                  color: "var(--color-text-secondary)",
                }}
                title={`${activeUnreadAlerts} notifications`}
              >
                <Bell className="w-4 h-4" />
                {activeUnreadAlerts > 0 && (
                  <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-rose-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center">
                    {activeUnreadAlerts}
                  </span>
                )}
              </button>

              {alertMenuOpen && (
                <div className="absolute right-0 mt-3 w-80 rounded-2xl z-50 overflow-hidden"
                     style={{
                       backgroundColor: "var(--color-bg-elevated)",
                       border: "1px solid var(--color-border-medium)",
                       boxShadow: "var(--shadow-lg)",
                     }}>
                  <div className="flex items-center justify-between p-4 border-b"
                       style={{ borderColor: "var(--color-border-subtle)" }}>
                    <span className="text-xs font-bold uppercase tracking-wider"
                          style={{ color: "var(--color-text-primary)" }}>
                      Notifications
                    </span>
                    <button onClick={() => setAlertMenuOpen(false)}
                            className="p-1 rounded-lg transition-colors cursor-pointer"
                            style={{ color: "var(--color-text-muted)" }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2 p-3 max-h-64 overflow-y-auto">
                    {alerts.length === 0 ? (
                      <p className="text-[10px] text-center py-6" style={{ color: "var(--color-text-disabled)" }}>
                        No notifications yet.
                      </p>
                    ) : (
                      alerts.map((a) => (
                        <div key={a.id} className="text-xs flex gap-2.5 items-start p-2.5 rounded-xl"
                             style={{
                               backgroundColor: "var(--color-bg-subtle)",
                               border: "1px solid var(--color-border-subtle)",
                             }}>
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{
                            color: a.type === "warning" ? "var(--color-warning-icon)"
                              : a.type === "success" ? "var(--color-success-icon)"
                              : "var(--color-brand-500)"
                          }} />
                          <div>
                            <h5 className="font-semibold text-[11px]" style={{ color: "var(--color-text-primary)" }}>
                              {a.title}
                            </h5>
                            <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                              {a.message}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t p-3 text-center" style={{ borderColor: "var(--color-border-subtle)" }}>
                    <button onClick={() => setAlerts([])}
                            className="text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                            style={{ color: "var(--color-danger-icon)" }}>
                      Clear All
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Income input */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all"
                 style={{
                   backgroundColor: "var(--color-bg-surface)",
                   borderColor: "var(--color-border-medium)",
                 }}>
              <DollarSign className="w-4 h-4" style={{ color: "var(--color-success-icon)" }} />
              <div className="flex flex-col">
                <span className="text-[8px] font-bold uppercase tracking-wider leading-none"
                      style={{ color: "var(--color-text-muted)" }}>Monthly wage</span>
                <input
                  type="number"
                  value={income}
                  onChange={(e) => setIncome(Math.max(0, parseFloat(e.target.value) || 0))}
                  onBlur={() => saveOverallSettings(income)}
                  className="bg-transparent text-xs font-mono font-bold w-20 p-0 border-none outline-none mt-0.5"
                  style={{ color: "var(--color-text-primary)" }}
                  placeholder="Salary"
                />
              </div>
            </div>

            <ProfileDropdown onSignOutTrigger={() => setShowLogoutConfirm(true)} />
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col gap-6 print:p-0 print:m-0">

        {/* TAB NAVIGATION */}
        <div className="flex flex-wrap border-b pb-3.5 gap-4 items-center justify-between print:hidden"
             style={{ borderColor: "var(--color-border-medium)" }}>
          <nav className="flex flex-wrap gap-1.5 min-w-0 flex-1">
            {[
              { id: "dashboard", label: "Dashboard", icon: Compass },
              { id: "scan", label: "Receipt Scanner", icon: Receipt },
              { id: "import", label: "Statement Converter", icon: FileText },
              { id: "optimize", label: "AI Optimizer", icon: CreditCard },
              { id: "cloud", label: "Cloud Sync", icon: Cloud },
              { id: "report", label: "Monthly Review", icon: Printer },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-all"
                style={
                  activeTab === id
                    ? { backgroundColor: "var(--color-brand-600)", color: "#ffffff" }
                    : {
                        backgroundColor: "var(--color-bg-surface)",
                        border: "1px solid var(--color-border-medium)",
                        color: "var(--color-text-muted)",
                      }
                }
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex gap-2 print:hidden shrink-0">
            <button
              onClick={() => { setShowTutorial(true); setTutorialStep(1); }}
              className="font-semibold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              style={{
                backgroundColor: "var(--color-brand-50)",
                color: "var(--color-brand-600)",
                border: "1px solid var(--color-brand-100)",
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tutorial</span>
            </button>
            <button
              onClick={handleTriggerPDFPrintReview}
              className="font-semibold text-xs py-2 px-3.5 rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
              style={{
                backgroundColor: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-medium)",
                color: "var(--color-text-secondary)",
              }}
            >
              <Printer className="w-3.5 h-3.5" style={{ color: "var(--color-text-muted)" }} />
              Print
            </button>
          </div>
        </div>

        {/* ── TAB CONTENT ── */}
        <div className="flex-1 flex flex-col gap-6">

          {/* TAB: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start print:hidden animate-in fade-in duration-200">
              <div className="xl:col-span-8 flex flex-col gap-6">

                {/* Summary cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { label: "Net Monthly Wage", value: `$${income.toFixed(2)}`, color: "var(--color-success-icon)", hint: "Primary salary source" },
                    { label: "Variable Spent", value: `$${totalVariablePaid.toFixed(2)}`, color: "var(--color-warning-icon)", hint: "Variable ledger total" },
                    { label: "Commitment Bills", value: `$${bills.reduce((a,b) => a + b.currentCost, 0).toFixed(2)}`, color: "var(--color-brand-600)", hint: "Recurring monthly" },
                  ].map(({ label, value, color, hint }) => (
                    <div key={label} className="p-5 rounded-2xl transition-all duration-300 brutal-card">
                      <span className="text-[10px] font-bold uppercase tracking-wider block"
                            style={{ color: "var(--color-text-muted)" }}>{label}</span>
                      <span className="font-mono font-bold text-2xl block mt-1.5" style={{ color }}>{value}</span>
                      <span className="text-[10px] mt-1 block" style={{ color: "var(--color-text-disabled)" }}>{hint}</span>
                    </div>
                  ))}
                </div>

                <SpendingCharts
                  transactions={transactions}
                  income={income}
                  savingsPotential={savingsSuggestions.reduce((acc, s) => acc + s.expectedSavings, 0)}
                />

                {/* Ledger Table */}
                <div className="rounded-2xl p-6 transition-all duration-300 brutal-card">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2 pb-2.5 border-b"
                       style={{ borderColor: "var(--color-border-subtle)" }}>
                    <div>
                      <h3 className="text-base font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
                        Ledger Transactions
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                        Categorized outlays and inflow logs
                      </p>
                    </div>
                    <button
                      onClick={() => handleTriggerLocalDownload("csv")}
                      className="font-semibold text-xs py-1.5 px-3 rounded-lg transition-colors cursor-pointer"
                      style={{
                        backgroundColor: "var(--color-bg-subtle)",
                        color: "var(--color-text-secondary)",
                        border: "1px solid var(--color-border-medium)",
                      }}
                    >
                      Extract CSV
                    </button>
                  </div>

                  {/* Manual entry form */}
                  <form onSubmit={handleAddManualTransaction}
                        className="grid grid-cols-2 lg:grid-cols-12 gap-2.5 pb-4 mb-4 border-b items-end"
                        style={{ borderColor: "var(--color-border-subtle)" }}>
                    <div className="col-span-2 lg:col-span-3">
                      <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1"
                             style={{ color: "var(--color-text-muted)" }}>Merchant</label>
                      <input type="text" placeholder="Target, Uber, Rent..." value={manualMerchant}
                             onChange={(e) => setManualMerchant(e.target.value)} className="brutal-input text-xs" required />
                    </div>
                    <div className="col-span-1 lg:col-span-2">
                      <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1"
                             style={{ color: "var(--color-text-muted)" }}>Amount ($)</label>
                      <input type="number" step="0.01" placeholder="0.00" value={manualAmount}
                             onChange={(e) => setManualAmount(e.target.value)} className="brutal-input text-xs font-mono" required />
                    </div>
                    <div className="col-span-1 lg:col-span-2">
                      <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1"
                             style={{ color: "var(--color-text-muted)" }}>Category</label>
                      <select value={manualCategory} onChange={(e) => setManualCategory(e.target.value as any)}
                              className="brutal-input text-xs cursor-pointer">
                        {["Food","Utilities","Entertainment","Transportation","Shopping","Health","Education","Income","Other"].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1 lg:col-span-2">
                      <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1"
                             style={{ color: "var(--color-text-muted)" }}>Date</label>
                      <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)}
                             className="brutal-input text-xs cursor-pointer" required />
                    </div>
                    <button type="submit"
                            className="col-span-1 lg:col-span-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Log Entry
                    </button>
                  </form>

                  {/* Transaction list */}
                  <div className="max-h-80 overflow-y-auto divide-y pr-1 select-none"
                       style={{ borderColor: "var(--color-border-subtle)" }}>
                    {transactions.length === 0 ? (
                      <div className="text-center py-10 text-xs" style={{ color: "var(--color-text-disabled)" }}>
                        No transactions yet. Scan a receipt or import a statement above.
                      </div>
                    ) : (
                      transactions.map((tx) => (
                        <div key={tx.id} className="py-3 flex items-center justify-between px-1 transition-colors"
                             style={{ borderColor: "var(--color-border-subtle)" }}>
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-mono px-2 py-0.5 rounded border"
                                    style={{
                                      backgroundColor: "var(--color-bg-subtle)",
                                      color: "var(--color-text-disabled)",
                                      borderColor: "var(--color-border-subtle)",
                                    }}>
                                {tx.date}
                              </span>
                              <span className="text-xs font-semibold truncate" title={tx.merchant}
                                    style={{ color: "var(--color-text-primary)" }}>
                                {tx.merchant}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                              <span className="brutal-badge-indigo">{tx.category}</span>
                              <span className="text-[9px] capitalize" style={{ color: "var(--color-text-disabled)" }}>
                                {tx.source || "manual"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs font-bold"
                                  style={{ color: tx.amount < 0 ? "#f43f5e" : "#10b981" }}>
                              {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
                            </span>
                            <button onClick={() => handleDeleteTransaction(tx.id, tx.merchant, tx.amount)}
                                    className="p-1.5 rounded-lg transition-colors cursor-pointer"
                                    style={{ color: "var(--color-text-disabled)" }}
                                    title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="xl:col-span-4 space-y-6">
                <PersonalAdvisor transactions={transactions} bills={bills} income={income} onAddAlert={triggerAlert} />
                <div className="bg-indigo-950 text-white rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
                  <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
                    <Lock className="w-40 h-40" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="h-5 w-5 bg-indigo-800 rounded-full flex items-center justify-center text-[10px]">🔒</span>
                    <span className="text-[8px] uppercase font-bold tracking-widest text-indigo-300 font-mono">Server-Side Secure</span>
                  </div>
                  <h4 className="text-xs font-bold text-white">Full-Stack Integration</h4>
                  <p className="text-[10.5px] text-indigo-200/80 leading-relaxed font-sans">
                    All Gemini API pipelines execute securely server-side. Update secrets under project settings.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "scan" && (
            <div className="max-w-2xl mx-auto w-full print:hidden">
              <ReceiptScanner onAddTransaction={handleAddScannerTransaction} onAddAlert={triggerAlert} />
            </div>
          )}

          {activeTab === "import" && (
            <div className="max-w-2xl mx-auto w-full print:hidden">
              <StatementImporter onImportTransactions={handleImportStatement} onAddAlert={triggerAlert} />
            </div>
          )}

          {activeTab === "optimize" && (
            <div className="max-w-3xl mx-auto w-full print:hidden">
              <RecurringBillsList
                bills={bills}
                suggestions={savingsSuggestions}
                isAnalyzing={isAnalyzing}
                onAddBill={handleAddBill}
                onDeleteBill={handleDeleteBill}
                onTriggerAnalysis={handleTriggerAISavingsAudit}
                onApplySavings={handleApplySavingsCheck}
              />
            </div>
          )}

          {activeTab === "cloud" && (
            <div className="max-w-xl mx-auto w-full print:hidden">
              <CloudSync
                transactionsCount={transactions.length}
                income={income}
                expenses={totalVariablePaid}
                onTriggerBackupDownload={handleTriggerLocalDownload}
                onAddAlert={triggerAlert}
              />
            </div>
          )}

          {activeTab === "report" && (
            <div className="max-w-4xl mx-auto w-full">
              <div className="rounded-2xl p-8 brutal-card print:border-none print:shadow-none print:p-0">
                <div className="flex justify-between items-center pb-5 border-b mb-6 print:hidden"
                     style={{ borderColor: "var(--color-border-subtle)" }}>
                  <div>
                    <h3 className="font-bold text-sm" style={{ color: "var(--color-text-primary)" }}>
                      Monthly Review Document
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                      Save to PDF or print
                    </p>
                  </div>
                  <button onClick={handleTriggerPDFPrintReview}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-4 rounded-xl cursor-pointer transition-colors">
                    Print / Save PDF
                  </button>
                </div>

                <div className="space-y-6 font-sans">
                  <div className="flex justify-between items-start flex-wrap gap-4">
                    <div>
                      <h2 className="text-xl font-bold font-display" style={{ color: "var(--color-text-primary)" }}>
                        Monthly Financial Audit Card
                      </h2>
                      <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                        {new Date().toLocaleDateString("en-US", { year:"numeric", month:"long" })}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase rounded-full px-3 py-1"
                          style={{
                            backgroundColor: "var(--color-success-bg)",
                            color: "var(--color-success-text)",
                            border: "1px solid var(--color-success-border)",
                          }}>
                      Audit Ready
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-0 rounded-xl overflow-hidden"
                       style={{ border: "1px solid var(--color-border-medium)" }}>
                    {[
                      { label: "Monthly Income", value: `$${income.toFixed(2)}`, color: "var(--color-success-icon)" },
                      { label: "Variable Spent", value: `$${totalVariablePaid.toFixed(2)}`, color: "var(--color-warning-icon)" },
                      { label: "Net Savings", value: `$${(income - totalVariablePaid).toFixed(2)}`, color: "var(--color-brand-600)" },
                    ].map(({ label, value, color }, i) => (
                      <div key={label} className="p-4" style={{
                        backgroundColor: "var(--color-bg-subtle)",
                        borderRight: i < 2 ? "1px solid var(--color-border-medium)" : "none",
                      }}>
                        <span className="text-[9px] font-semibold block uppercase"
                              style={{ color: "var(--color-text-muted)" }}>{label}</span>
                        <span className="font-bold text-base mt-0.5 block" style={{ color }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Bills table */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest border-b pb-1.5"
                        style={{ color: "var(--color-text-secondary)", borderColor: "var(--color-border-subtle)" }}>
                      Monthly Commitment Bills
                    </h3>
                    <table className="w-full text-xs font-sans">
                      <thead>
                        <tr className="text-[10px] font-semibold uppercase text-left"
                            style={{ color: "var(--color-text-muted)" }}>
                          <th className="pb-2">Subscription</th>
                          <th className="pb-2">Category</th>
                          <th className="pb-2">Due Day</th>
                          <th className="pb-2 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bills.map((b) => (
                          <tr key={b.id} className="border-t" style={{ borderColor: "var(--color-border-subtle)" }}>
                            <td className="py-2.5 font-semibold" style={{ color: "var(--color-text-primary)" }}>{b.billName}</td>
                            <td className="py-2.5" style={{ color: "var(--color-text-muted)" }}>{b.category}</td>
                            <td className="py-2.5" style={{ color: "var(--color-text-muted)" }}>Day {b.dueDate}</td>
                            <td className="py-2.5 text-right font-mono font-bold"
                                style={{ color: "var(--color-text-primary)" }}>
                              ${b.currentCost.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Applied savings */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest border-b pb-1.5"
                        style={{ color: "var(--color-text-secondary)", borderColor: "var(--color-border-subtle)" }}>
                      Applied AI Optimizations
                    </h3>
                    {savingsSuggestions.filter((s) => s.applied).length === 0 ? (
                      <p className="text-xs italic py-1" style={{ color: "var(--color-text-muted)" }}>
                        No optimizations marked for this cycle.
                      </p>
                    ) : (
                      savingsSuggestions.filter((s) => s.applied).map((s, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs p-3.5 rounded-xl"
                             style={{
                               backgroundColor: "var(--color-bg-subtle)",
                               border: "1px solid var(--color-border-medium)",
                             }}>
                          <div>
                            <span className="font-semibold block text-[11px]" style={{ color: "var(--color-text-primary)" }}>
                              {s.billName}
                            </span>
                            <span className="text-[10px] mt-0.5 block" style={{ color: "var(--color-text-muted)" }}>
                              {s.suggestedAction}
                            </span>
                          </div>
                          <span className="font-mono font-bold ml-4" style={{ color: "var(--color-success-icon)" }}>
                            +${s.expectedSavings.toFixed(2)}/mo
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Transaction log */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest border-b pb-1.5"
                        style={{ color: "var(--color-text-secondary)", borderColor: "var(--color-border-subtle)" }}>
                      Transaction Records
                    </h3>
                    <table className="w-full text-xs font-sans">
                      <thead>
                        <tr className="text-[10px] font-semibold uppercase text-left"
                            style={{ color: "var(--color-text-muted)" }}>
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Merchant</th>
                          <th className="pb-2">Category</th>
                          <th className="pb-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx) => (
                          <tr key={tx.id} className="border-t" style={{ borderColor: "var(--color-border-subtle)" }}>
                            <td className="py-2 font-mono text-[10px]" style={{ color: "var(--color-text-muted)" }}>{tx.date}</td>
                            <td className="py-2 font-semibold" style={{ color: "var(--color-text-primary)" }}>{tx.merchant}</td>
                            <td className="py-2 text-[10px]" style={{ color: "var(--color-text-muted)" }}>{tx.category}</td>
                            <td className="py-2 text-right font-mono font-semibold"
                                style={{ color: tx.amount < 0 ? "#f43f5e" : "#10b981" }}>
                              {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 text-slate-400 py-10 mt-12 print:hidden shrink-0 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-800 pb-8 mb-6">
            <div className="text-center md:text-left space-y-1">
              <h4 className="text-xs font-bold text-slate-200 tracking-wider uppercase font-display">
                AI Personal Finance Assistant
              </h4>
              <p className="text-[10px] text-slate-500 font-sans max-w-sm">
                Next-generation sovereign asset analytics, powered by Google Gemini.
              </p>
            </div>
            <div className="flex flex-col items-center md:items-end gap-2.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest font-mono">DEVELOPER</span>
              <div className="flex items-center gap-3.5">
                {[
                  { href: socialLinks.portfolioUrl, icon: Globe, title: "Portfolio" },
                  { href: socialLinks.githubUrl, icon: Github, title: "GitHub" },
                  { href: socialLinks.linkedinUrl, icon: Linkedin, title: "LinkedIn" },
                  { href: socialLinks.instagramUrl, icon: Instagram, title: "Instagram" },
                  { href: `mailto:${socialLinks.contactEmail}`, icon: Mail, title: "Email" },
                ].filter(({ href }) => href).map(({ href, icon: Icon, title }) => (
                  <a key={title} href={href} target={href?.startsWith("mailto") ? undefined : "_blank"}
                     rel="noopener noreferrer"
                     className="p-2 rounded-xl transition-all text-slate-400 hover:text-indigo-400"
                     style={{ backgroundColor: "#1e293b" }} title={title}>
                    <Icon className="w-3.5 h-3.5" />
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div className="text-center text-[10px] tracking-wider uppercase text-slate-500 font-mono">
            &copy; {new Date().getFullYear()} AI Personal Finance Assistant. Powered by Google Gemini.
          </div>
        </div>
      </footer>

      {/* ── ONBOARDING TUTORIAL MODAL ── */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ backgroundColor: "rgba(0,0,0,0.60)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-3xl max-w-sm w-full p-6 relative flex flex-col"
               style={{
                 backgroundColor: "var(--color-bg-elevated)",
                 border: "1px solid var(--color-border-medium)",
                 boxShadow: "var(--shadow-xl)",
               }}>
            <div className="flex justify-between items-center mb-5 pb-3 border-b"
                 style={{ borderColor: "var(--color-border-subtle)" }}>
              <span className="text-[10px] font-bold uppercase py-1 px-2.5 rounded-full tracking-wider"
                    style={{
                      backgroundColor: "var(--color-brand-50)",
                      color: "var(--color-brand-600)",
                    }}>
                Step {tutorialStep} of 4
              </span>
              <button onClick={() => setShowTutorial(false)}
                      className="p-1 rounded-lg cursor-pointer"
                      style={{ color: "var(--color-text-muted)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {tutorialStep === 1 && (
              <div className="space-y-3.5">
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-2"
                     style={{ backgroundColor: "var(--color-brand-50)" }}>
                  <Sparkles className="w-6 h-6 animate-pulse" style={{ color: "var(--color-brand-600)" }} />
                </div>
                <h3 className="text-sm font-bold font-display" style={{ color: "var(--color-text-primary)" }}>
                  Welcome to Your Finance Assistant!
                </h3>
                <p className="text-[11px] leading-relaxed font-sans" style={{ color: "var(--color-text-tertiary)" }}>
                  Track variable ledgers, analyze recurring bills, and isolate savings leaks. Let's set up your profile in 3 quick steps!
                </p>
              </div>
            )}

            {tutorialStep === 2 && (
              <div className="space-y-3.5">
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-2"
                     style={{ backgroundColor: "var(--color-success-bg)" }}>
                  <DollarSign className="w-6 h-6" style={{ color: "var(--color-success-icon)" }} />
                </div>
                <h3 className="text-sm font-bold font-display" style={{ color: "var(--color-text-primary)" }}>
                  Record Your Monthly Income
                </h3>
                <p className="text-[11px] leading-relaxed font-sans" style={{ color: "var(--color-text-tertiary)" }}>
                  Set your take-home salary or freelancing income:
                </p>
                <div className="pt-2">
                  <label className="text-[9px] font-bold uppercase tracking-wider block mb-1"
                         style={{ color: "var(--color-text-muted)" }}>Monthly income ($)</label>
                  <input type="number" value={income || ""} onChange={(e) => setIncome(Math.max(0, parseFloat(e.target.value) || 0))}
                         placeholder="e.g. 4500" className="brutal-input text-xs" autoFocus />
                </div>
              </div>
            )}

            {tutorialStep === 3 && (
              <div className="space-y-3.5">
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-2"
                     style={{ backgroundColor: "var(--color-brand-50)" }}>
                  <CreditCard className="w-6 h-6" style={{ color: "var(--color-brand-600)" }} />
                </div>
                <h3 className="text-sm font-bold font-display" style={{ color: "var(--color-text-primary)" }}>
                  Track Subscriptions & Bills
                </h3>
                <p className="text-[11px] leading-relaxed font-sans" style={{ color: "var(--color-text-tertiary)" }}>
                  Add rent, utilities, streaming services in the <strong>AI Optimizer</strong> tab. Gemini will suggest ways to reduce them.
                </p>
              </div>
            )}

            {tutorialStep === 4 && (
              <div className="space-y-3.5">
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-2"
                     style={{ backgroundColor: "var(--color-warning-bg)" }}>
                  <Receipt className="w-6 h-6" style={{ color: "var(--color-warning-icon)" }} />
                </div>
                <h3 className="text-sm font-bold font-display" style={{ color: "var(--color-text-primary)" }}>
                  Upload Receipts or Statements
                </h3>
                <ul className="text-[11px] space-y-2 pl-1 font-sans" style={{ color: "var(--color-text-tertiary)" }}>
                  <li>• <strong>Receipt Scanner</strong>: Gemini OCR parses receipt line items automatically.</li>
                  <li>• <strong>Statement Converter</strong>: Import PDF/CSV bank statements to catalog transactions.</li>
                </ul>
              </div>
            )}

            <div className="mt-8 flex gap-3 pt-4 border-t" style={{ borderColor: "var(--color-border-subtle)" }}>
              {tutorialStep > 1 && (
                <button onClick={() => setTutorialStep((p) => p - 1)}
                        className="flex-1 font-bold text-[11px] py-2.5 rounded-2xl cursor-pointer transition-colors"
                        style={{
                          backgroundColor: "var(--color-bg-subtle)",
                          color: "var(--color-text-secondary)",
                          border: "1px solid var(--color-border-medium)",
                        }}>
                  Back
                </button>
              )}
              {tutorialStep < 4 ? (
                <button onClick={() => setTutorialStep((p) => p + 1)}
                        className="flex-1 text-white font-bold text-[11px] py-2.5 rounded-2xl cursor-pointer transition-colors"
                        style={{ backgroundColor: "var(--color-brand-600)" }}>
                  Next
                </button>
              ) : (
                <button onClick={async () => {
                  setShowTutorial(false);
                  const completedKey = `PFA_COMPLETED_ONBOARDING_${user.id}`;
                  localStorage.setItem(completedKey, "true");
                  await saveOverallSettings(income);
                }}
                        className="flex-1 text-white font-bold text-[11px] py-2.5 rounded-2xl cursor-pointer transition-colors"
                        style={{ backgroundColor: "#16a34a" }}>
                  Let's Go!
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── LOGOUT CONFIRM MODAL ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ backgroundColor: "rgba(0,0,0,0.60)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-3xl max-w-sm w-full p-6 relative flex flex-col"
               style={{
                 backgroundColor: "var(--color-bg-elevated)",
                 border: "1px solid var(--color-border-medium)",
                 boxShadow: "var(--shadow-xl)",
               }}>
            <div className="space-y-4 mb-6">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center"
                   style={{ backgroundColor: "var(--color-brand-50)" }}>
                <Cloud className="w-5 h-5 animate-pulse" style={{ color: "var(--color-brand-500)" }} />
              </div>
              <h3 className="text-sm font-bold font-display" style={{ color: "var(--color-text-primary)" }}>
                Sign Out
              </h3>
              <p className="text-[11px] leading-relaxed font-sans" style={{ color: "var(--color-text-tertiary)" }}>
                Would you like to sync your data to the cloud before logging out?
              </p>
              <div className="space-y-2 font-mono text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                <div className="p-3 rounded-2xl flex items-center gap-2"
                     style={{
                       backgroundColor: "var(--color-bg-subtle)",
                       border: "1px solid var(--color-border-subtle)",
                     }}>
                  <div className={`h-2 w-2 rounded-full ${unsavedChanges ? "bg-amber-500 animate-pulse" : "bg-green-500"}`}></div>
                  <span>Income: ${income.toFixed(2)}</span>
                </div>
                <div className="p-3 rounded-2xl flex items-center gap-2"
                     style={{
                       backgroundColor: "var(--color-bg-subtle)",
                       border: "1px solid var(--color-border-subtle)",
                     }}>
                  <FileText className="w-3.5 h-3.5" style={{ color: "var(--color-brand-500)" }} />
                  <span>Transactions: {transactions.length} | Bills: {bills.length}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-4 border-t" style={{ borderColor: "var(--color-border-subtle)" }}>
              <button onClick={async () => {
                try {
                  await Promise.race([syncAllToSupabase(), new Promise((r) => setTimeout(() => r(false), 800))]);
                } catch (e) { /* ignore */ } finally { setIsDbLoading(false); }
                setShowLogoutConfirm(false);
                signOut();
              }}
                      className="w-full text-white font-bold text-xs py-3 rounded-2xl cursor-pointer transition-colors flex items-center justify-center gap-2"
                      style={{ backgroundColor: "var(--color-brand-600)" }}>
                <Cloud className="w-4 h-4" />
                Sync & Sign Out
              </button>
              <button onClick={() => { setShowLogoutConfirm(false); signOut(); }}
                      className="w-full font-bold text-xs py-2.5 rounded-2xl cursor-pointer transition-colors"
                      style={{
                        backgroundColor: "var(--color-bg-subtle)",
                        color: "var(--color-text-secondary)",
                        border: "1px solid var(--color-border-medium)",
                      }}>
                Sign Out Without Saving
              </button>
              <button onClick={() => setShowLogoutConfirm(false)}
                      className="w-full font-semibold text-xs py-2 rounded-2xl cursor-pointer transition-colors"
                      style={{ color: "var(--color-text-muted)" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}