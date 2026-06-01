import React, { useState, useEffect } from "react";
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
  RefreshCw
} from "lucide-react";
import { Transaction, RecurringBill, BillSavingSuggestion, HabitSavingSuggestion, VisualBudgetAlert } from "./types";
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
  
  // Clean UUID v4 compliant string generator to ensure complete physical compatibility with Postgres / Supabase
  const generateUUID = () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // 1. STATE INITIALIZATION (Grounding datasets)
  const [income, setIncome] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(1);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState<boolean>(false);

  // Real-time toast / notification state
  const [alerts, setAlerts] = useState<VisualBudgetAlert[]>([
    {
      id: "alert-1",
      timestamp: new Date(),
      type: "info",
      title: "Assistant Activated",
      message: "AI Finance Optimizer is online. Scan receipts or drop statements to check saving leaks.",
      isRead: false
    }
  ]);
  
  // Base core ledger transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Base monthly billing commitments
  const [bills, setBills] = useState<RecurringBill[]>([]);

  // AI-compiled savings optimization proposals
  const [savingsSuggestions, setSavingsSuggestions] = useState<BillSavingSuggestion[]>([]);

  // Habit insights list of suggestions
  const [habitSuggestions, setHabitSuggestions] = useState<HabitSavingSuggestion[]>([]);

  const [alertMenuOpen, setAlertMenuOpen] = useState(false);

  // Manual transaction form state
  const [manualMerchant, setManualMerchant] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualCategory, setManualCategory] = useState<Transaction["category"]>("Food");
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualIsRecurring, setManualIsRecurring] = useState(false);

  // Active Supabase database pull loader
  const fetchUserDataFromCloud = async (showAlert = false) => {
    if (demoModeActive || !user || !supabase) {
      return;
    }

    setIsDbLoading(true);
    // Reset unsaved changes flag immediately to prevent overwrite race conditions
    setUnsavedChanges(false);

    try {
      const [txRes, billRes, sugRes] = await Promise.all([
        (supabase as any).from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }),
        (supabase as any).from("recurring_bills").select("*").eq("user_id", user.id),
        (supabase as any).from("savings_suggestions").select("*").eq("user_id", user.id)
      ]);

      if (txRes.error) {
        throw new Error(`Transactions database load failure: ${txRes.error.message}. Please verify the matching SQL tables exist.`);
      }
      if (billRes.error) {
        throw new Error(`Recurring Bills database load failure: ${billRes.error.message}. Please verify the matching SQL tables exist.`);
      }
      if (sugRes.error) {
        throw new Error(`Savings Suggestions database load failure: ${sugRes.error.message}. Please verify the matching SQL tables exist.`);
      }

      const mappedTxs = txRes.data ? txRes.data.map((t: any) => ({
        id: t.id,
        date: t.date,
        merchant: t.merchant,
        description: t.description || "",
        amount: Number(t.amount),
        category: t.category,
        isRecurring: t.is_recurring,
        source: t.source || "manual"
      })) : [];

      const mappedBills = billRes.data ? billRes.data.map((b: any) => ({
        id: b.id,
        billName: b.bill_name,
        currentCost: Number(b.current_cost),
        category: b.category,
        dueDate: b.due_date,
        isPaid: b.is_paid
      })) : [];

      const mappedSugs = sugRes.data ? sugRes.data.map((s: any) => ({
        billName: s.bill_name,
        currentCost: Number(s.current_cost),
        suggestedAction: s.suggested_action,
        expectedSavings: Number(s.expected_savings),
        difficulty: s.difficulty,
        applied: s.applied
      })) : [];

      // Set active data sets directly from the logged user table instances
      setTransactions(mappedTxs);
      setBills(mappedBills);
      setSavingsSuggestions(mappedSugs);
      setUnsavedChanges(false);

      // Save to local storage cache so it's populated for fast offline loading too!
      localStorage.setItem("PFA_TRANSACTIONS", JSON.stringify(mappedTxs));
      localStorage.setItem("PFA_BILLS", JSON.stringify(mappedBills));
      localStorage.setItem("PFA_SUGGESTIONS", JSON.stringify(mappedSugs));

      // --- NEW USER OR EXISTING USER ONBOARDING ---
      const localCompletedKey = `PFA_COMPLETED_ONBOARDING_${user.id}`;
      const hasCompletedOnboarding = localStorage.getItem(localCompletedKey) === "true";
      if (mappedTxs.length === 0 && mappedBills.length === 0 && !hasCompletedOnboarding) {
        setShowTutorial(true);
        if (showAlert) {
          triggerAlert("Welcome!", "Initialize your monthly financial profile and settings to calibrate your dashboard.", "success");
        }
      } else {
        setShowTutorial(false);
        if (showAlert) {
          triggerAlert("Sync Successful", `Retrieved ${mappedTxs.length} ledger entries and ${mappedBills.length} recurring limits safely.`, "success");
        }
      }
    } catch (err: any) {
      console.error("Supabase live load fault:", err);
      const codeMsg = err.message || "";
      const instruction = codeMsg.toLowerCase().includes("does not exist") || codeMsg.toLowerCase().includes("relation")
        ? " (Tables missing in Supabase! Copy & run the contents of 'supabase_schema.sql' inside your Supabase SQL Editor to provision the database)."
        : "";
      if (showAlert) {
        triggerAlert("Secure Retrieval Interrupted", `Failed to download parameters: ${err.message || err}${instruction}`, "warning");
      }
    } finally {
      setIsDbLoading(false);
    }
  };

  // Dual-mode sync loader (Supabase vs Local storage)
  useEffect(() => {
    if (demoModeActive || !user || !supabase) {
      // Load standard sandbox storage
      const cachedTxs = localStorage.getItem("PFA_TRANSACTIONS");
      const cachedBills = localStorage.getItem("PFA_BILLS");
      const cachedSuggestions = localStorage.getItem("PFA_SUGGESTIONS");
      const cachedAlerts = localStorage.getItem("PFA_ALERTS");
      
      if (cachedTxs) setTransactions(JSON.parse(cachedTxs));
      if (cachedBills) setBills(JSON.parse(cachedBills));
      if (cachedSuggestions) setSavingsSuggestions(JSON.parse(cachedSuggestions));
      if (cachedAlerts) {
        setAlerts(JSON.parse(cachedAlerts).map((a: any) => ({
          ...a,
          timestamp: new Date(a.timestamp)
        })));
      }
      return;
    }

    // Active Supabase synchronization loader
    fetchUserDataFromCloud(true);
  }, [user, demoModeActive]);

  // Read income preference and onboarding status from profile theme_preference payload or default to localStorage
  useEffect(() => {
    if (profile) {
      if (profile.theme_preference) {
        try {
          if (profile.theme_preference === "light" || profile.theme_preference === "dark") {
            const localInc = localStorage.getItem("PFA_INCOME");
            setIncome(localInc ? Number(localInc) : 0);
          } else {
            const parsed = JSON.parse(profile.theme_preference);
            if (parsed && typeof parsed === "object") {
              if (parsed.monthly_income !== undefined) {
                setIncome(Number(parsed.monthly_income));
              } else {
                const localInc = localStorage.getItem("PFA_INCOME");
                setIncome(localInc ? Number(localInc) : 0);
              }
              
              // Restore onboarding check from profile database payload
              if (parsed.onboarding_completed === true && user?.id) {
                const completedKey = `PFA_COMPLETED_ONBOARDING_${user.id}`;
                localStorage.setItem(completedKey, "true");
              }
            } else {
              const localInc = localStorage.getItem("PFA_INCOME");
              setIncome(localInc ? Number(localInc) : 0);
            }
          }
        } catch (e) {
          const localInc = localStorage.getItem("PFA_INCOME");
          setIncome(localInc ? Number(localInc) : 0);
        }
      } else {
        const localInc = localStorage.getItem("PFA_INCOME");
        setIncome(localInc ? Number(localInc) : 0);
      }
    } else {
      const localInc = localStorage.getItem("PFA_INCOME");
      setIncome(localInc ? Number(localInc) : 0);
    }
  }, [profile, user?.id]);

  // Overall database settings save handler
  const saveOverallSettings = async (newIncome: number, newTheme?: "light" | "dark") => {
    setIncome(newIncome);
    localStorage.setItem("PFA_INCOME", String(newIncome));
    setUnsavedChanges(true);
    
    let themeValue: "light" | "dark" = "light";
    if (newTheme) {
      themeValue = newTheme;
    } else {
      const cachedTheme = localStorage.getItem("theme_pref");
      themeValue = cachedTheme === "dark" ? "dark" : "light";
    }

    const completedKey = user ? `PFA_COMPLETED_ONBOARDING_${user.id}` : "PFA_COMPLETED_ONBOARDING";
    const isCompleted = localStorage.getItem(completedKey) === "true";

    const payload = JSON.stringify({
      theme: themeValue,
      theme_preference: themeValue,
      monthly_income: newIncome,
      onboarding_completed: isCompleted
    });

    localStorage.setItem("theme_pref", themeValue);
    if (profile) {
      profile.theme_preference = payload as any; // update context profile actively
    }

    triggerAlert("Settings Adjusted", `Assigned salary settings to $${newIncome.toFixed(2)} (Local). Click Sync Cloud to save permanently.`, "info");
  };

  // Automated onboarding launcher for new users
  useEffect(() => {
    if (user) {
      const completedKey = `PFA_COMPLETED_ONBOARDING_${user.id}`;
      const completed = localStorage.getItem(completedKey);
      if (!completed && transactions.length === 0 && bills.length === 0 && !isLoading) {
        setShowTutorial(true);
      }
    }
  }, [transactions.length, bills.length, isLoading, user]);

  // Cloud Synchronization engine (Checks precise queries and database sync status)
  const syncAllToSupabase = async (isAutoSync = false) => {
    if (demoModeActive || !user || !supabase) {
      if (!isAutoSync) {
        triggerAlert("Sync Interrupted", "Database storage requires an active secure session.", "warning");
      }
      return false;
    }

    setIsDbLoading(true);
    if (!isAutoSync) {
      triggerAlert("Sync Action Request", "Initiating transaction matching and log alignment with Supabase...", "info");
    }

    try {
      // 1. Double check existing IDs to prevent duplication (no redundancy)
      const [txDb, billDb, sugDb] = await Promise.all([
        (supabase as any).from("transactions").select("id").eq("user_id", user.id),
        (supabase as any).from("recurring_bills").select("id").eq("user_id", user.id),
        (supabase as any).from("savings_suggestions").select("id").eq("user_id", user.id)
      ]);

      if (txDb.error) throw txDb.error;
      if (billDb.error) throw billDb.error;
      if (sugDb.error) throw sugDb.error;

      const dbTxIds = new Set((txDb.data || []).map((t: any) => t.id));
      const dbBillIds = new Set((billDb.data || []).map((b: any) => b.id));
      const dbSugNames = new Set((sugDb.data || []).map((s: any) => s.bill_name));

      // 2. Sync profile metadata theme preference payload
      const currentTheme = localStorage.getItem("theme_pref") === "dark" ? "dark" : "light";
      const completedKey = `PFA_COMPLETED_ONBOARDING_${user.id}`;
      const isCompleted = localStorage.getItem(completedKey) === "true";
      const profilePayload = JSON.stringify({
        theme: currentTheme,
        theme_preference: currentTheme,
        monthly_income: income,
        onboarding_completed: isCompleted
      });

      const profileUpdate = await (supabase as any)
        .from("profiles")
        .update({ theme_preference: profilePayload } as any)
        .eq("id", user.id);
      
      if (profileUpdate.error) throw profileUpdate.error;

      // 3. Transactions delta management
      const localTxIds = new Set(transactions.map(t => t.id));
      const txsToDelete = [...dbTxIds].filter(id => !localTxIds.has(id));
      
      if (txsToDelete.length > 0) {
        const delRes = await (supabase as any).from("transactions").delete().in("id", txsToDelete as any[]).eq("user_id", user.id);
        if (delRes.error) throw delRes.error;
      }

      // Prepare list for upserting
      const txsToUpsert = transactions.map(t => ({
        id: t.id,
        user_id: user.id,
        date: t.date,
        merchant: t.merchant,
        description: t.description || "",
        amount: t.amount,
        category: t.category,
        is_recurring: t.isRecurring,
        source: t.source || "manual"
      }));

      if (txsToUpsert.length > 0) {
        const upsertRes = await (supabase as any).from("transactions").upsert(txsToUpsert as any);
        if (upsertRes.error) throw upsertRes.error;
      }

      // 4. Subscriptions / Bills delta management
      const localBillIds = new Set(bills.map(b => b.id));
      const billsToDelete = [...dbBillIds].filter(id => !localBillIds.has(id));

      if (billsToDelete.length > 0) {
        const delRes = await (supabase as any).from("recurring_bills").delete().in("id", billsToDelete as any[]).eq("user_id", user.id);
        if (delRes.error) throw delRes.error;
      }

      const billsToUpsert = bills.map(b => ({
        id: b.id,
        user_id: user.id,
        bill_name: b.billName,
        current_cost: b.currentCost,
        category: b.category,
        due_date: b.dueDate,
        is_paid: b.isPaid || false
      }));

      if (billsToUpsert.length > 0) {
        const upsertRes = await (supabase as any).from("recurring_bills").upsert(billsToUpsert as any);
        if (upsertRes.error) throw upsertRes.error;
      }

      // 5. Savings Suggestions
      const localSugNames = new Set(savingsSuggestions.map(s => s.billName));
      const sugsToDelete = [...dbSugNames].filter(name => !localSugNames.has(name));

      if (sugsToDelete.length > 0) {
        const delRes = await (supabase as any).from("savings_suggestions").delete().in("bill_name", sugsToDelete as any[]).eq("user_id", user.id);
        if (delRes.error) throw delRes.error;
      }

      const suggestionsToUpsert = savingsSuggestions.map(s => ({
        user_id: user.id,
        bill_name: s.billName,
        current_cost: s.currentCost,
        suggested_action: s.suggestedAction,
        expected_savings: s.expectedSavings,
        difficulty: s.difficulty,
        applied: s.applied || false
      }));

      await (supabase as any).from("savings_suggestions").delete().eq("user_id", user.id);
      if (suggestionsToUpsert.length > 0) {
        const insertRes = await (supabase as any).from("savings_suggestions").insert(suggestionsToUpsert as any);
        if (insertRes.error) throw insertRes.error;
      }

      setUnsavedChanges(false);
      if (isAutoSync) {
        triggerAlert("Cloud Auto-Synced", "Background database synchronization completed successfully.", "success");
      } else {
        triggerAlert("Sync Complete", "Cloud database synchronization matches local state completely.", "success");
      }
      return true;
    } catch (err: any) {
      console.error("Supabase Database Sync Failed:", err);
      if (!isAutoSync) {
        triggerAlert("Storage Synchronization Failed", `Supabase query fault: ${err.message || err}`, "warning");
      }
      return false;
    } finally {
      setIsDbLoading(false);
    }
  };

  // Download backup utility
  const handleDownloadBackup = () => {
    try {
      const payload = {
        income,
        transactions,
        bills,
        savingsSuggestions,
        timestamp: new Date().toISOString()
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `pfa_finance_ledger_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.warn("Local ledger backup download failed or was blocked by sandbox iframe restrictions:", err);
    }
  };

  // Unified automated cache synchronizer to localStorage for instantaneous load protection
  useEffect(() => {
    localStorage.setItem("PFA_TRANSACTIONS", JSON.stringify(transactions));
    localStorage.setItem("PFA_BILLS", JSON.stringify(bills));
    localStorage.setItem("PFA_SUGGESTIONS", JSON.stringify(savingsSuggestions));
    localStorage.setItem("PFA_ALERTS", JSON.stringify(alerts));
  }, [transactions, bills, savingsSuggestions, alerts]);

  // Automated background synchronization check every 10 seconds if unsavedChanges is true
  useEffect(() => {
    if (!unsavedChanges || demoModeActive || !user || !supabase) {
      return;
    }

    const interval = setInterval(async () => {
      console.log("Auto-sync: Initiating 10-second background check...");
      if (unsavedChanges) {
        await syncAllToSupabase(true);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [unsavedChanges, demoModeActive, user, transactions, bills, savingsSuggestions, income]);

  // Session loader spinner
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-11 w-11 bg-indigo-650 text-white flex items-center justify-center rounded-2xl shadow-lg animate-bounce">
            <Wallet className="w-5 h-5 text-indigo-100" />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
            Synchronizing Secure Session...
          </div>
        </div>
      </div>
    );
  }

  // Blocking Protected Route Access Code
  if (!user) {
    return <AuthPage />;
  }

  // Reactive Trigger: alert notification creator
  const triggerAlert = (title: string, message: string, type: "warning" | "info" | "success" = "info") => {
    const newAlert: VisualBudgetAlert = {
      id: `alert-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      type,
      title,
      message,
      isRead: false
    };
    setAlerts(prev => [newAlert, ...prev]);
  };

  // Add a standard manual transaction mapping
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
      source: "manual"
    };

    setTransactions(prev => [newTx, ...prev]);
    setUnsavedChanges(true);

    triggerAlert(
      "Row Added to Transactions",
      `Inserted transaction of $${Math.abs(finalAmt).toFixed(2)} at ${manualMerchant} successfully. Sync Cloud to save permanently.`,
      manualCategory === "Income" ? "success" : "info"
    );

    setManualMerchant("");
    setManualAmount("");
    setManualIsRecurring(false);

    if (finalAmt < -250) {
      triggerAlert(
        "High Outflow Warning",
        `Heavy singular charge of $${Math.abs(finalAmt).toFixed(0)} recorded for ${manualMerchant}!`,
        "warning"
      );
    }
  };

  const handleDeleteTransaction = (id: string, merchant: string, amount: number) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    setUnsavedChanges(true);
    triggerAlert("Row Deleted from Transactions", `Removed transaction record of $${Math.abs(amount).toFixed(2)} at ${merchant}. Sync Cloud to synchronize.`, "info");
  };

  const handleImportStatement = (imported: Transaction[]) => {
    const cleaned = imported.map((t) => ({
      ...t,
      id: generateUUID() // overwrite with secure UUID v4
    }));
    setTransactions(prev => [...cleaned, ...prev]);
    setUnsavedChanges(true);
    triggerAlert(
      "Rows Added to Transactions",
      `Indexed ${cleaned.length} bank transactions locally. Click Sync Cloud to sync to Supabase.`,
      "success"
    );
  };

  const handleAddScannerTransaction = (txData: Omit<Transaction, "id">) => {
    const fresh: Transaction = {
      ...txData,
      id: generateUUID()
    };
    setTransactions(prev => [fresh, ...prev]);
    setUnsavedChanges(true);
    triggerAlert(
      "Row Added to Transactions",
      `Mined scanning receipt data for $${Math.abs(fresh.amount).toFixed(2)} at ${fresh.merchant} locally.`,
      "success"
    );
  };

  const handleAddBill = (data: Omit<RecurringBill, "id">) => {
    const newBillItem: RecurringBill = {
      id: generateUUID(),
      ...data
    };
    setBills(prev => [...prev, newBillItem]);
    setUnsavedChanges(true);
    triggerAlert("Row Added to Recurring Bills", `Appended subscription for ${data.billName} of $${data.currentCost}/mo locally.`, "success");
  };

  const handleDeleteBill = (id: string) => {
    const targeted = bills.find(b => b.id === id);
    setBills(prev => prev.filter(b => b.id !== id));
    setUnsavedChanges(true);
    if (targeted) {
      triggerAlert("Row Deleted from Recurring Bills", `Deleted subscription ${targeted.billName} from commitments. Sync Cloud to sync.`, "info");
    }
  };

  const handleTriggerAISavingsAudit = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/analyze-finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions,
          monthlyBills: bills,
          income
        })
      });

      if (!response.ok) throw new Error("API analysis pipeline failure");

      const parsedAnalysis = await response.json();
      
      if (parsedAnalysis.recurringBillSavings) {
        const nextSavings = parsedAnalysis.recurringBillSavings.map((s: any) => ({ ...s, applied: false }));
        setSavingsSuggestions(nextSavings);
        setUnsavedChanges(true);
      }
      if (parsedAnalysis.generalHabitSavings) {
        setHabitSuggestions(parsedAnalysis.generalHabitSavings);
      }
      
      triggerAlert(
        "AI Budget Review Complete",
        `Identified potential bill optimizations up to $${parsedAnalysis.budgetForecast?.savingsPotential || 80}/mo! Click Sync Cloud to upload suggestions.`,
        "success"
      );
    } catch (err: any) {
      console.error(err);
      triggerAlert("AI Audit Unavailable", "Could not compile optimizations. Ensure API key is set.", "warning");
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
      isApplied ? "Optimized Goal Applied" : "Optimized Goal Reverted",
      isApplied 
        ? `Marked ${copy[index].billName} renegotiated. Estimated budget margin increased by $${copy[index].expectedSavings}/mo!`
        : `Reverted $${copy[index].expectedSavings}/mo optimized status on ${copy[index].billName}.`,
      isApplied ? "success" : "info"
    );
  };

  const handleTriggerLocalDownload = (format: "csv" | "json") => {
    if (format === "csv") {
      const headers = ["Date", "Merchant/Description", "Category", "Amount ($)", "Platform Source"];
      const rows = transactions.map((t) => [
        t.date,
        `"${t.merchant.replace(/"/g, '""')}"`,
        t.category,
        t.amount.toFixed(2),
        t.source || "manual"
      ]);
      const csvStr = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `FINANCE_REPORT_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const backupPayload = JSON.stringify({
        income,
        transactions,
        bills,
        savingsSuggestions,
        replicatedTimestamp: new Date().toISOString()
      }, null, 2);
      const blob = new Blob([backupPayload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `PF_ASSISTANT_BACKUP_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleTriggerPDFPrintReview = () => {
    window.print();
  };

  const totalVariablePaid = Math.abs(transactions.filter(t => t.amount < 0).reduce((acc, curr) => acc + curr.amount, 0));
  const activeUnreadAlerts = alerts.filter(a => !a.isRead).length;

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 flex flex-col antialiased selection:bg-indigo-550 selection:text-white font-sans print:bg-white print:p-0">
      
      {/* Visual Header / Banner */}
      <header className="border-b border-slate-100 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md sticky top-0 z-50 print:hidden shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9.5 w-9.5 bg-indigo-650 text-white flex items-center justify-center rounded-xl shadow-xs">
              <Wallet className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight font-display">AI Finance Assistant</h1>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold tracking-wider uppercase">REAL-TIME CASHFLOW DISCOVERY</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            
            {/* Theme System Switch Trigger */}
            <ThemeToggle />

            {/* Manual Sync Cloud Button Option with Background Autocheck status info */}
            <button
              onClick={() => {
                if (unsavedChanges) {
                  syncAllToSupabase(false);
                } else {
                  fetchUserDataFromCloud(true);
                }
              }}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer shadow-3xs flex items-center gap-1.5 text-xs font-semibold relative ${
                unsavedChanges 
                  ? "border-amber-400 bg-amber-50/10 text-amber-800 dark:border-slate-800 dark:bg-amber-955/10 dark:text-amber-300 animate-pulse"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-905 dark:text-slate-350 dark:hover:bg-slate-800 dark:hover:text-slate-50"
              }`}
              title={unsavedChanges ? "Unsaved changes! Click to Sync immediately, or wait 10s for automatic background sync." : "Database matches live states. Click to refresh/fetch fresh data from cloud."}
              id="header-cloud-sync-btn"
            >
              <Cloud className={`w-4 h-4 ${unsavedChanges ? "text-amber-500 animate-bounce" : "text-indigo-500"}`} />
              <span className="hidden md:inline">{unsavedChanges ? "Sync Cloud" : "Refresh Cloud"}</span>
              {unsavedChanges && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              )}
            </button>

            {/* Live Alerts Notification Pulldown menu toggler */}
            <div className="relative">
              <button
                onClick={() => {
                  setAlertMenuOpen(!alertMenuOpen);
                  const marked = alerts.map(a => ({ ...a, isRead: true }));
                  setAlerts(marked);
                }}
                className="relative p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer shadow-3xs"
                title={`${activeUnreadAlerts} Active Notifications`}
                id="active-notifications-btn"
              >
                <Bell className="w-4 h-4" />
                {activeUnreadAlerts > 0 && (
                  <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-rose-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center">
                    {activeUnreadAlerts}
                  </span>
                )}
              </button>

              {/* Alert menu panel dropdown */}
              {alertMenuOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl p-4 rounded-2xl z-50 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Real-Time Alerts</span>
                    <button
                      onClick={() => setAlertMenuOpen(false)}
                      className="p-1 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {alerts.length === 0 ? (
                      <p className="text-[10px] text-center text-slate-400 py-6">No notifications triggered yet.</p>
                    ) : (
                      alerts.map((a) => (
                        <div key={a.id} className="text-xs flex gap-2.5 items-start bg-slate-50/50 p-2.5 border border-slate-100 rounded-xl">
                          <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                            a.type === "warning" ? "text-amber-500" :
                            a.type === "success" ? "text-emerald-500" : "text-indigo-500"
                          }`} />
                          <div className="min-w-0">
                            <h5 className="font-semibold text-slate-700 leading-tight text-[11px]">{a.title}</h5>
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed font-sans">{a.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-slate-100 pt-2 text-center">
                    <button
                      onClick={() => setAlerts([])}
                      className="text-[10px] text-rose-600 font-bold hover:underline uppercase tracking-wider cursor-pointer"
                    >
                      Clear Log Registry
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Income field control */}
            <div className="flex items-center gap-2 border border-slate-200 bg-white px-3.5 py-1.5 rounded-xl shadow-3xs hover:border-slate-300 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 dark:border-slate-850 dark:bg-slate-900/90 dark:focus-within:border-indigo-500 transition-all">
              <DollarSign className="w-4 h-4 text-emerald-500 font-bold" />
              <div className="flex flex-col">
                <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-none">Monthly wage</span>
                <input
                  type="number"
                  value={income}
                  onChange={(e) => setIncome(Math.max(0, parseFloat(e.target.value) || 0))}
                  onBlur={() => saveOverallSettings(income)}
                  className="bg-transparent text-xs font-mono font-bold text-slate-700 dark:text-slate-100 focus:outline-hidden w-20 p-0 border-none outline-none mt-0.5"
                  placeholder="Salary"
                />
              </div>
            </div>

            {/* Avatar / Profile Dropdown management portal */}
            <ProfileDropdown onSignOutTrigger={() => setShowLogoutConfirm(true)} />

          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col gap-6 print:p-0 print:m-0">
        
        {/* Navigation Selector Tabs */}
        <div className="flex flex-wrap border-b border-slate-100 pb-3.5 gap-4 items-center justify-between print:hidden">
          <nav className="flex flex-wrap gap-1.5 min-w-0 flex-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === "dashboard"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-500 hover:text-slate-800"
              }`}
            >
              <Compass className="w-3.5 h-3.5" /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab("scan")}
              className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === "scan"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-500 hover:text-slate-800"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" /> Receipt Scanner
            </button>
            <button
              onClick={() => setActiveTab("import")}
              className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === "import"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-500 hover:text-slate-800"
              }`}
              id="statement-import-tab"
            >
              <FileText className="w-3.5 h-3.5" /> Statement Converter
            </button>
            <button
              onClick={() => setActiveTab("optimize")}
              className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === "optimize"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-500 hover:text-slate-800"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" /> AI Optimizer
            </button>
            <button
              onClick={() => setActiveTab("cloud")}
              className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === "cloud"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-500 hover:text-slate-800"
              }`}
            >
              <Cloud className="w-3.5 h-3.5" /> Cloud Sync
            </button>
            <button
              onClick={() => setActiveTab("report")}
              className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === "report"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-500 hover:text-slate-800"
              }`}
            >
              <Printer className="w-3.5 h-3.5" /> Monthly Review
            </button>
          </nav>

          <div className="flex gap-2 print:hidden shrink-0">
            <button
              onClick={() => { setShowTutorial(true); setTutorialStep(1); }}
              className="bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 font-semibold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-indigo-100/35 dark:border-indigo-900/25"
              title="View Guided Onboarding Tutorial"
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>Onboarding Tutorial</span>
            </button>

            <button
              onClick={handleTriggerPDFPrintReview}
              className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-205 dark:hover:bg-slate-800 text-slate-650 font-semibold border border-slate-200 text-xs py-2 px-3.5 rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-3xs"
              title="Print standard reports directly to PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" /> Printer Friendly
            </button>
          </div>
        </div>

        {/* ================= VIEWPORT ROUTING STAGE ================= */}
        <div className="print:block flex-1 flex flex-col gap-6">
          
          {/* TAB 1: MAIN DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start print:hidden animate-in fade-in duration-200">
              
              {/* Primary dashboard visual grids */}
              <div className="xl:col-span-8 flex flex-col gap-6 animate-in fade-in duration-300">
                
                {/* 3 bento summary statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Net Monthly Wage</span>
                    <span className="font-mono font-bold text-2xl text-emerald-600 block mt-1.5">${income.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400 mt-1 block">Primary salary source registered</span>
                  </div>
                  <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Variable Spent</span>
                    <span className="font-mono font-bold text-2xl text-amber-500 block mt-1.5">${totalVariablePaid.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400 mt-1 block">Calculated across variable ledger</span>
                  </div>
                  <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Commitment Bills</span>
                    <span className="font-mono font-bold text-2xl text-indigo-650 block mt-1.5">
                      ${bills.reduce((acc, curr) => acc + curr.currentCost, 0).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1 block">Total recurring contracts logged</span>
                  </div>
                </div>

                {/* Main analytical interactive charts */}
                <SpendingCharts
                  transactions={transactions}
                  income={income}
                  savingsPotential={savingsSuggestions.reduce((acc, curr) => acc + curr.expectedSavings, 0)}
                />

                {/* Detailed Interactive Ledger */}
                <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2 pb-2.5 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-bold text-slate-800 tracking-tight">Ledger Transactions</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Categorized outlays and inflow logs</p>
                    </div>
                    <button
                      onClick={() => handleTriggerLocalDownload("csv")}
                      className="bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold border border-slate-200 text-xs py-1.5 px-3 rounded-lg transition-colors cursor-pointer"
                    >
                      Extract CSV File
                    </button>
                  </div>

                  {/* Manual entry adding form inside dashboard */}
                  <form onSubmit={handleAddManualTransaction} className="grid grid-cols-2 lg:grid-cols-12 gap-2.5 pb-4.5 mb-4 border-b border-slate-100 items-end">
                    <div className="col-span-2 lg:col-span-3">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Merchant</label>
                      <input
                        type="text"
                        placeholder="Target, Uber, Rent..."
                        value={manualMerchant}
                        onChange={(e) => setManualMerchant(e.target.value)}
                        className="brutal-input text-xs"
                        required
                      />
                    </div>
                    <div className="col-span-1 lg:col-span-2">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Amount ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                        className="brutal-input text-xs font-mono"
                        required
                      />
                    </div>
                    <div className="col-span-1 lg:col-span-2">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Category</label>
                      <select
                        value={manualCategory}
                        onChange={(e) => setManualCategory(e.target.value as any)}
                        className="brutal-input text-xs cursor-pointer font-sans bg-transparent"
                      >
                        <option value="Food">Food</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Entertainment">Entertainment</option>
                        <option value="Transportation">Transportation</option>
                        <option value="Shopping">Shopping</option>
                        <option value="Health">Health</option>
                        <option value="Education">Education</option>
                        <option value="Income">Income</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="col-span-1 lg:col-span-2">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Date</label>
                      <input
                        type="date"
                        value={manualDate}
                        onChange={(e) => setManualDate(e.target.value)}
                        className="brutal-input text-xs cursor-pointer"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="col-span-1 lg:col-span-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Log Entry
                    </button>
                  </form>

                  {/* Transactions display scroll table */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 pr-1 select-none">
                    {transactions.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-xs">
                        No transactions registered yet. Scan a receipt or import a statement above.
                      </div>
                    ) : (
                      transactions.map((tx) => (
                        <div key={tx.id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors px-1">
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{tx.date}</span>
                              <span className="text-xs font-semibold text-slate-700 truncate" title={tx.merchant}>{tx.merchant}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                              <span className="brutal-badge-indigo">{tx.category}</span>
                              <span className="text-slate-450 text-[9px] capitalize">
                                {tx.source || "manual"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-mono text-xs font-bold ${tx.amount < 0 ? "text-rose-500" : "text-emerald-600"}`}>
                              {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
                            </span>
                            <button
                              onClick={() => handleDeleteTransaction(tx.id, tx.merchant, tx.amount)}
                              className="text-slate-350 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Sidebar layout representing Assistant Advisor AI */}
              <div className="xl:col-span-4 space-y-6 animate-in fade-in duration-300">
                <PersonalAdvisor
                  transactions={transactions}
                  bills={bills}
                  income={income}
                  onAddAlert={triggerAlert}
                />

                {/* Secure storage badge */}
                <div className="bg-indigo-950 text-white rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
                  <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
                    <Lock className="w-40 h-40" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="h-5 w-5 bg-indigo-800 rounded-full flex items-center justify-center text-[10px]">
                      🔒
                    </span>
                    <span className="text-[8px] uppercase font-bold tracking-widest text-indigo-300 font-mono">Server-Side Cloud Safe</span>
                  </div>
                  <h4 className="text-xs font-bold text-white">Full-Stack Key integration</h4>
                  <p className="text-[10.5px] text-indigo-200/80 leading-relaxed font-sans">
                    All Gemini model API transcribing pipelines execute securely in sandbox containers. Read or update secret system integrations anytime under the project platform UI.
                  </p>
                </div>
              </div>
              
            </div>
          )}

          {/* TAB 2: RECEIPT SCANNER VIEW */}
          {activeTab === "scan" && (
            <div className="max-w-2xl mx-auto w-full animate-in fade-in duration-200 print:hidden">
              <ReceiptScanner
                onAddTransaction={handleAddScannerTransaction}
                onAddAlert={triggerAlert}
              />
            </div>
          )}

          {/* TAB 3: BANK STATEMENTS INGESTION */}
          {activeTab === "import" && (
            <div className="max-w-2xl mx-auto w-full animate-in fade-in duration-200 print:hidden">
              <StatementImporter
                onImportTransactions={handleImportStatement}
                onAddAlert={triggerAlert}
              />
            </div>
          )}

          {/* TAB 4: COMMITMENTS OPTIMIZER */}
          {activeTab === "optimize" && (
            <div className="max-w-3xl mx-auto w-full animate-in fade-in duration-200 print:hidden">
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

          {/* TAB 5: CLOUD EXPORT PANEL */}
          {activeTab === "cloud" && (
            <div className="max-w-xl mx-auto w-full animate-in fade-in duration-200 print:hidden">
              <CloudSync
                transactionsCount={transactions.length}
                income={income}
                expenses={totalVariablePaid}
                onTriggerBackupDownload={handleTriggerLocalDownload}
                onAddAlert={triggerAlert}
              />
            </div>
          )}

          {/* TAB 6: PDF REPORT CARD PREVIEW */}
          {activeTab === "report" && (
            <div className="max-w-4xl mx-auto w-full animate-in fade-in duration-200">
              <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm relative print:border-none print:shadow-none print:p-0">
                
                {/* Print button at preview phase */}
                <div className="flex justify-between items-center pb-5 border-b border-slate-100 mb-6 print:hidden">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Review Summary Document</h3>
                    <p className="text-xs text-slate-400 font-sans mt-0.5">Save directly to PDF or hardware device printer hubs</p>
                  </div>
                  <button
                    onClick={handleTriggerPDFPrintReview}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Direct PDF / Print
                  </button>
                </div>

                {/* Main Printable Document frame */}
                <div className="space-y-6 font-sans">
                  
                  <div className="flex justify-between items-start flex-wrap gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-800 font-display">Monthly Financial Audit Card</h2>
                      <p className="text-xs text-slate-400 font-sans mt-1">May 1, 2026 – May 30, 2026</p>
                    </div>
                    <div className="text-right">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold uppercase rounded-full px-3 py-1">Audit Passed</span>
                      <p className="text-[9px] text-slate-400 mt-1.5 font-sans">Optimized by Gemini OCR AI</p>
                    </div>
                  </div>

                  {/* Summary Bento panels */}
                  <div className="grid grid-cols-3 gap-0 border border-slate-100 rounded-xl bg-slate-50/50 divide-x divide-slate-100 overflow-hidden">
                    <div className="p-4">
                      <span className="text-[9px] font-semibold text-slate-400 block uppercase">Monthly Income</span>
                      <span className="font-bold text-[15px] md:text-base text-emerald-600 mt-0.5 block">${income.toFixed(2)}</span>
                    </div>
                    <div className="p-4">
                      <span className="text-[9px] font-semibold text-slate-400 block uppercase">Variable Spent</span>
                      <span className="font-bold text-[15px] md:text-base text-amber-500 mt-0.5 block">${totalVariablePaid.toFixed(2)}</span>
                    </div>
                    <div className="p-4">
                      <span className="text-[9px] font-semibold text-slate-400 block uppercase">Net Savings</span>
                      <span className="font-bold text-[15px] md:text-base text-indigo-750 mt-0.5 block">${(income - totalVariablePaid).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Specific budget guidelines section */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest border-b border-slate-100 pb-1.5">Monthly Commitment Bills</h3>
                    <table className="w-full text-xs font-sans text-slate-600 divide-y divide-slate-100">
                      <thead>
                        <tr className="text-[10px] font-semibold text-slate-400 uppercase text-left">
                          <th className="pb-2">Subscription</th>
                          <th className="pb-2">Category</th>
                          <th className="pb-2">Due Day</th>
                          <th className="pb-2 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bills.map((b) => (
                           <tr key={b.id}>
                             <td className="py-2.5 font-semibold text-slate-800">{b.billName}</td>
                             <td className="py-2.5 text-slate-400">{b.category}</td>
                             <td className="py-2.5 text-slate-400">Day {b.dueDate}</td>
                             <td className="py-2.5 text-right font-mono font-bold text-slate-700">${b.currentCost.toFixed(2)}</td>
                           </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Recommendations panel */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest border-b border-slate-100 pb-1.5">Executed AI Optimizations</h3>
                    <div className="space-y-2">
                      {savingsSuggestions.filter(s => s.applied).length === 0 ? (
                        <p className="text-xs text-slate-400 font-sans italic py-1">No optimizations marked off for this cycle.</p>
                      ) : (
                        savingsSuggestions.filter(s => s.applied).map((s, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs p-3.5 border border-slate-100 bg-slate-50/50 rounded-xl">
                            <div>
                              <span className="font-semibold text-slate-700 block text-[11px]">{s.billName} Optimization</span>
                              <span className="text-[10px] text-slate-400 mt-0.5 block">{s.suggestedAction}</span>
                            </div>
                            <span className="font-mono font-bold text-emerald-600 text-right shrink-0 ml-4">
                              +${s.expectedSavings.toFixed(2)}/mo
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Transaction historical log list for auditing */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest border-b border-slate-100 pb-1.5 font-display">Variable Transaction Records</h3>
                    <table className="w-full text-xs font-sans text-slate-600 divide-y divide-slate-100">
                      <thead>
                        <tr className="text-[10px] font-semibold text-slate-400 uppercase text-left">
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Merchant</th>
                          <th className="pb-2">Category</th>
                          <th className="pb-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600">
                        {transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td className="py-2 font-mono text-[10px] text-slate-400">{tx.date}</td>
                            <td className="py-2 text-slate-800 font-semibold">{tx.merchant}</td>
                            <td className="py-2 text-[10px]">{tx.category}</td>
                            <td className={`py-2 text-right font-mono font-semibold ${tx.amount < 0 ? "text-rose-500" : "text-emerald-650"}`}>
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

      {/* Elegant minimalist bottom footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 mt-12 print:hidden shrink-0 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-800 pb-8 mb-6">
            
            {/* Left Side: About Assistant Credits */}
            <div className="text-center md:text-left space-y-1">
              <h4 className="text-xs font-bold text-slate-200 tracking-wider uppercase font-display">AI Personal Finance Assistant</h4>
              <p className="text-[10px] text-slate-500 font-sans max-w-sm">
                Next-generation sovereign asset analytics, securely processed with Google Gemini models. Empowering families to reach financial clarity.
              </p>
            </div>

            {/* Right Side: About Developer Social Links */}
            <div className="flex flex-col items-center md:items-end gap-2.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest font-mono">ABOUT DEVELOPER</span>
              <div className="flex items-center gap-3.5">
                {socialLinks.portfolioUrl && (
                  <a
                    href={socialLinks.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-indigo-450 rounded-xl transition-all shadow-3xs"
                    title="Developer Portfolio"
                  >
                    <Globe className="w-3.5 h-3.5" />
                  </a>
                )}
                {socialLinks.githubUrl && (
                  <a
                    href={socialLinks.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-indigo-455 rounded-xl transition-all shadow-3xs"
                    title="Developer GitHub Source"
                  >
                    <Github className="w-3.5 h-3.5" />
                  </a>
                )}
                {socialLinks.linkedinUrl && (
                  <a
                    href={socialLinks.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-indigo-455 rounded-xl transition-all shadow-3xs"
                    title="Developer LinkedIn Profile"
                  >
                    <Linkedin className="w-3.5 h-3.5" />
                  </a>
                )}
                {socialLinks.instagramUrl && (
                  <a
                    href={socialLinks.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-indigo-455 rounded-xl transition-all shadow-3xs"
                    title="Developer Instagram"
                  >
                    <Instagram className="w-3.5 h-3.5" />
                  </a>
                )}
                {socialLinks.contactEmail && (
                  <a
                    href={`mailto:${socialLinks.contactEmail}`}
                    className="p-2 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-indigo-455 rounded-xl transition-all shadow-3xs"
                    title="Contact Developer via Email"
                  >
                    <Mail className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

          </div>

          <div className="text-center text-[10px] tracking-wider uppercase leading-loose text-slate-550 font-mono">
            &copy; 2026 AI Personal Finance Assistant Corporation. Securely processed server-side with Google Gemini models.
          </div>
        </div>
      </footer>

      {/* Interactive Onboarding Tutorial Modal / Backdrop overlay */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full shadow-2xl p-6 relative flex flex-col justify-between font-sans overflow-hidden">
            
            {/* Decorative colored visual corner */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/10 to-transparent pointer-events-none rounded-bl-full"></div>
            
            <div>
              {/* Step Indicator Header */}
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[10px] bg-indigo-150 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-bold uppercase py-1 px-2.5 rounded-full tracking-wider">
                  Step {tutorialStep} of 4: Onboarding
                </span>
                <button
                  onClick={() => {
                    setShowTutorial(false);
                    localStorage.setItem("PFA_COMPLETED_ONBOARDING", "true");
                  }}
                  className="text-slate-400 hover:text-slate-655 dark:hover:text-slate-350 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step 1 Content: Welcome */}
              {tutorialStep === 1 && (
                <div className="space-y-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-650 mb-2 shadow-3xs">
                    <Sparkles className="w-6 h-6 text-indigo-505 animate-pulse" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight font-display">
                    Welcome to Your Personal Financial Assistant!
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                    This terminal assists in tracking variable ledgers, analyzing recurring bill commitments, and isolating savings leaks using local client engines or live cloud sync.
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                    Since you are starting with a clean account, let's calibrate your cash-flow parameters in 3 quick steps!
                  </p>
                </div>
              )}

              {/* Step 2 Content: Income Setup */}
              {tutorialStep === 2 && (
                <div className="space-y-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-2 shadow-3xs">
                    <DollarSign className="w-6 h-6 text-emerald-500 font-bold" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight font-display">
                    Record Your Monthly Income (Wage)
                  </h3>
                  <p className="text-[11px] text-slate-505 dark:text-slate-400 leading-relaxed font-sans">
                    Your financial parameters and budget thresholds are calculated relative to your base wage. Set your net take-home salary or freelancing income here:
                  </p>
                  
                  <div className="pt-2">
                    <label className="text-[9px] font-bold text-slate-440 uppercase tracking-wider block mb-1">Monthly wage amount ($)</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-xs text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        value={income || ""}
                        onChange={(e) => setIncome(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="e.g. 4500"
                        className="w-full bg-slate-50 dark:bg-slate-850 dark:text-slate-100 border border-slate-200 dark:border-slate-800 outline-none rounded-xl text-xs pl-7 pr-3 py-3 font-semibold font-mono shadow-3xs focus:border-indigo-500"
                        autoFocus
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3 Content: Subscription Add */}
              {tutorialStep === 3 && (
                <div className="space-y-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 mb-2 shadow-3xs">
                    <CreditCard className="w-6 h-6 text-indigo-500" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight font-display">
                    Track Subscriptions & Commitments
                  </h3>
                  <p className="text-[11px] text-slate-505 dark:text-slate-400 leading-relaxed font-sans">
                    Rent, electricity plans, subscription streamers, mobile bills? Add commitments inside your portfolio using the <strong className="text-indigo-600 dark:text-indigo-400 font-semibold font-display">AI Optimizer / Commitment Subs</strong> list tab.
                  </p>
                  <p className="text-[11px] text-slate-505 dark:text-slate-400 leading-relaxed font-sans">
                    Gemini reads these billing schedules to suggest rate-negotiation scripts or cheaper local options.
                  </p>
                </div>
              )}

              {/* Step 4 Content: Receipt Scanner OCR Guide */}
              {tutorialStep === 4 && (
                <div className="space-y-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-2 shadow-3xs">
                    <Receipt className="w-6 h-6 text-amber-500" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight font-display">
                    Upload Physical Receipts or Statements
                  </h3>
                  <p className="text-[11px] text-slate-505 dark:text-slate-400 leading-relaxed font-sans">
                    No manual writing required! Our fully autonomous visual processing tools include:
                  </p>
                  <ul className="text-[11px] text-slate-550 dark:text-slate-400 space-y-2 pl-1 font-sans">
                    <li className="flex gap-2 items-start">
                      <span className="text-amber-505 font-bold">1.</span>
                      <span><strong>Receipt Scanner</strong>: Upload shopping receipts; Gemini OCR parses line-items names and categories automatically.</span>
                    </li>
                    <li className="flex gap-2 items-start">
                      <span className="text-indigo-505 font-bold">2.</span>
                      <span><strong>Statement Converter</strong>: Import text statements to catalog transaction records.</span>
                    </li>
                  </ul>
                </div>
              )}

            </div>

            {/* Footer Navigation Buttons */}
            <div className="mt-8 flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              {tutorialStep > 1 && (
                <button
                  onClick={() => setTutorialStep(prev => prev - 1)}
                  className="flex-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] py-2.5 rounded-2xl cursor-pointer transition-colors border border-slate-200 dark:border-slate-705"
                >
                  Back
                </button>
              )}
              
              {tutorialStep < 4 ? (
                <button
                  onClick={() => setTutorialStep(prev => prev + 1)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-655 text-white font-bold text-[11px] py-2.5 rounded-2xl cursor-pointer transition-colors shadow-sm"
                >
                  Next Setup
                </button>
              ) : (
                <button
                  onClick={async () => {
                    setShowTutorial(false);
                    const completedKey = `PFA_COMPLETED_ONBOARDING_${user.id}`;
                    localStorage.setItem(completedKey, "true");
                    await saveOverallSettings(income);
                  }}
                  className="flex-1 bg-emerald-650 hover:bg-emerald-600 text-white font-bold text-[11px] py-2.5 rounded-2xl cursor-pointer transition-colors shadow-sm"
                >
                  Begin Calibration!
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Sync Confirm & Safe Logout Intervention Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full shadow-2xl p-6 relative flex flex-col justify-between font-sans overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-rose-500/5 to-transparent pointer-events-none rounded-bl-full"></div>
            
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-650 shadow-3xs">
                <Cloud className="w-5 h-5 text-indigo-500 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight font-display">
                  Confirm Sign Out
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans mt-1.5">
                  Would you like to synchronize and save your financial profiles, recurring commitments, and transaction changes to the cloud database before logging out?
                </p>
                <div className="space-y-2 mt-4 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                  <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${unsavedChanges ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`}></div>
                    <span>Wage setting: ${income.toFixed(2)}</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                    <span>Transactions: {transactions.length} | Bills: {bills.length}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={async () => {
                  try {
                    // Fail-safe: Wait up to 800ms for database sync before forcing logout regardless of connection/table state
                    await Promise.race([
                      syncAllToSupabase(),
                      new Promise((resolve) => setTimeout(() => resolve(false), 800))
                    ]);
                  } catch (e) {
                    console.error("DB Sync execution failed during logout hook:", e);
                  } finally {
                    setIsDbLoading(false);
                  }
                  setShowLogoutConfirm(false);
                  signOut();
                }}
                className="w-full bg-indigo-605 hover:bg-indigo-600 text-white font-bold text-xs py-3 rounded-2xl cursor-pointer transition-colors shadow-xs flex items-center justify-center gap-2"
              >
                <Cloud className="w-4 h-4 text-indigo-200" />
                Synchronize and Log Out
              </button>

              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  signOut();
                }}
                className="w-full bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs py-2.5 rounded-2xl cursor-pointer transition-colors border border-slate-200 dark:border-slate-700 text-center"
              >
                Just Terminate Session (No Save)
              </button>

              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full bg-transparent hover:bg-slate-100/50 dark:hover:bg-slate-800/50 text-slate-400 dark:text-slate-500 font-semibold text-xs py-2 rounded-2xl cursor-pointer transition-colors text-center"
              >
                Cancel Sign Out
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
