export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  merchant: string;
  description: string;
  amount: number; // negative for expense, positive for income
  category: "Food" | "Utilities" | "Entertainment" | "Transportation" | "Shopping" | "Health" | "Education" | "Income" | "Other";
  isRecurring: boolean;
  notes?: string;
  source?: "manual" | "receipt" | "bank_statement";
}

export interface RecurringBill {
  id: string;
  billName: string;
  currentCost: number;
  category: string;
  dueDate: string; // Day date index (e.g. "12")
  isPaid?: boolean;
}

export interface BillSavingSuggestion {
  billName: string;
  currentCost: number;
  suggestedAction: string;
  expectedSavings: number;
  difficulty: "Easy" | "Medium" | "Hard";
  applied?: boolean;
}

export interface HabitSavingSuggestion {
  category: string;
  observation: string;
  tip: string;
  estimatedMonthlySavings: number;
  applied?: boolean;
}

export interface BudgetForecast {
  predictedSpendingNextMonth: number;
  savingsPotential: number;
  summaryRemarks: string;
}

export interface AnalysisData {
  recurringBillSavings: BillSavingSuggestion[];
  generalHabitSavings: HabitSavingSuggestion[];
  budgetForecast: BudgetForecast;
}

export interface CloudExportResponse {
  success: boolean;
  provider: "gdrive" | "s3" | "dropbox";
  fileName: string;
  bucketOrFolder: string;
  exportTimestamp: string;
  shareUrl: string;
  transactionsCount: number;
  metadata: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    exportChecksum: string;
  };
}

export interface VisualBudgetAlert {
  id: string;
  timestamp: Date;
  type: "warning" | "info" | "success";
  title: string;
  message: string;
  isRead: boolean;
}
