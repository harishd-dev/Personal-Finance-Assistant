import React, { useState } from "react";
import {
  Upload, FileText, CheckCircle2, ArrowDownToLine,
  RefreshCw, AlertCircle, FileSpreadsheet, XCircle,
} from "lucide-react";
import { Transaction } from "../types";

interface StatementImporterProps {
  onImportTransactions: (newTransactions: Transaction[]) => void;
  onAddAlert: (title: string, message: string, type: "warning" | "info" | "success") => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAZY CDN LOADERS
// SheetJS and PDF.js are loaded from CDN only when the user actually uploads
// a matching file type — no npm install required.
// ─────────────────────────────────────────────────────────────────────────────

function loadScript(src: string, globalKey: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any)[globalKey]) { resolve((window as any)[globalKey]); return; }
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any)[globalKey]));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve((window as any)[globalKey]);
    s.onerror = () => reject(new Error(`Failed to load ${globalKey} from CDN`));
    document.head.appendChild(s);
  });
}

const loadXLSX = () =>
  loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
    "XLSX"
  );

const loadPdfJs = async (): Promise<any> => {
  const lib = await loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    "pdfjsLib"
  );
  if (!lib.GlobalWorkerOptions.workerSrc) {
    lib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  return lib;
};

// ─────────────────────────────────────────────────────────────────────────────
// CSV PARSER  (handles quoted fields, CRLF, BOM, varying delimiters)
// ─────────────────────────────────────────────────────────────────────────────

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const counts = { ",": 0, ";": 0, "\t": 0, "|": 0 };
  for (const ch of firstLine) if (ch in counts) (counts as any)[ch]++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseCSVText(raw: string): string[][] {
  const text = raw.replace(/^\uFEFF/, ""); // strip BOM
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === delimiter) { row.push(field.trim()); field = ""; }
      else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        if (ch === "\r") i++;
        row.push(field.trim());
        if (row.some((f) => f)) rows.push(row);
        row = []; field = "";
      } else if (ch === "\r") {
        row.push(field.trim());
        if (row.some((f) => f)) rows.push(row);
        row = []; field = "";
      } else field += ch;
    }
  }
  if (field || row.length) { row.push(field.trim()); if (row.some((f) => f)) rows.push(row); }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN DETECTION  (handles all common bank statement header variants)
// ─────────────────────────────────────────────────────────────────────────────

function norm(s: string) { return s.toLowerCase().replace(/[^a-z0-9]/g, ""); }

function findCol(headers: string[], ...candidates: string[][]): number {
  const hn = headers.map(norm);
  for (const group of candidates) {
    for (const c of group) {
      const idx = hn.findIndex((h) => h === c || h.includes(c) || c.includes(h));
      if (idx !== -1) return idx;
    }
  }
  return -1;
}

interface ColMap {
  date: number; desc: number;
  amount: number; debit: number; credit: number;
  category: number; balance: number;
}

function detectColumns(headers: string[]): ColMap {
  return {
    date: findCol(headers,
      ["date","transdate","transactiondate"],
      ["posteddate","postingdate","settledate","valuedate","processingdate","bookdate"]),
    desc: findCol(headers,
      ["description","memo","narrative","particulars","details"],
      ["merchant","payee","name","reference","text","info","transactiondescription",
       "transactiondetails","merchantname","beneficiary","remarks"]),
    amount: findCol(headers,
      ["amount","transactionamount"],
      ["value","sum","netamount","total","paidamount"]),
    debit: findCol(headers,
      ["debit","withdrawal","debitamount","moneyout","out","charge","charges","paid"],
      ["withdrawals","debits","deductions"]),
    credit: findCol(headers,
      ["credit","deposit","creditamount","moneyin","in","received","receiving"],
      ["deposits","credits","receipts"]),
    category: findCol(headers,
      ["category","type","transactiontype","expensecategory"],
      ["class","group"]),
    balance: findCol(headers,
      ["balance","runningbalance","closingbalance","availablebalance"],
      ["endbalance","ledgerbalance"]),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NUMBER + DATE PARSERS
// ─────────────────────────────────────────────────────────────────────────────

function cleanNumber(val: string): number {
  if (!val?.trim()) return 0;
  const isNeg = val.includes("(") || /^[-−]/.test(val.trim());
  const n = parseFloat(val.replace(/[^0-9.]/g, "")) || 0;
  return isNeg ? -n : n;
}

const MONTH_MAP: Record<string, string> = {
  jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
  jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
};

function parseDate(val: string): string {
  if (!val?.trim()) return new Date().toISOString().split("T")[0];
  const t = val.trim();

  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);

  // MM/DD/YYYY or DD/MM/YYYY (treat day>12 first position as DD/MM)
  const slash = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slash) {
    let [, a, b, y] = slash;
    const year = y.length === 2 ? `20${y}` : y;
    // If first part > 12 it must be day
    const [mm, dd] = parseInt(a) > 12 ? [b, a] : [a, b];
    return `${year}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
  }

  // DD-Mon-YYYY or DD Mon YYYY
  const alpha = t.match(/^(\d{1,2})[\s\-\/]([a-zA-Z]{3,9})[\s\-\/](\d{2,4})$/);
  if (alpha) {
    const [, d, m, y] = alpha;
    const mm = MONTH_MAP[m.slice(0,3).toLowerCase()];
    const year = y.length === 2 ? `20${y}` : y;
    if (mm) return `${year}-${mm}-${d.padStart(2,"0")}`;
  }

  // Mon DD, YYYY
  const mdy = t.match(/^([a-zA-Z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    const mm = MONTH_MAP[m.slice(0,3).toLowerCase()];
    if (mm) return `${y}-${mm}-${d.padStart(2,"0")}`;
  }

  // YYYYMMDD
  const compact = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;

  const d = new Date(t);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return new Date().toISOString().split("T")[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY INFERENCE
// ─────────────────────────────────────────────────────────────────────────────

function inferCategory(desc: string): Transaction["category"] {
  const d = desc.toLowerCase();
  if (/salary|payroll|direct.?dep|income|wages|payslip/.test(d)) return "Income";
  if (/restaurant|cafe|coffee|starbucks|mcdonald|pizza|kfc|burger|sushi|food|grocery|supermarket|walmart|costco|kroger|safeway|whole.?food|trader.?joe|tesco|asda|lidl|aldi/.test(d)) return "Food";
  if (/netflix|spotify|prime|hulu|disney|youtube|apple.*sub|subscription|streaming|cinema|theatre|theater|movie|game/.test(d)) return "Entertainment";
  if (/uber|lyft|taxi|gasstation|petrol|shell|bp|chevron|exxon|mobil|parking|toll|transit|subway|metro|bus|train|flight|airline|airbnb/.test(d)) return "Transportation";
  if (/electric|electricity|water|gas.?bill|internet|broadband|phone|at.?t|verizon|t.?mobile|comcast|virgin|bt |vodafone|utility/.test(d)) return "Utilities";
  if (/amazon|ebay|target|walmart|shop|store|mall|online|order|purchase|zara|h&m|next|asos/.test(d)) return "Shopping";
  if (/doctor|pharmacy|cvs|walgreens|hospital|medical|dental|vision|health|optician|nhs/.test(d)) return "Health";
  if (/school|college|university|tuition|course|udemy|coursera|education|book|library/.test(d)) return "Education";
  return "Other";
}

function mapToCategory(raw: string): Transaction["category"] {
  const r = raw.toLowerCase();
  if (r.includes("food") || r.includes("dining") || r.includes("grocery")) return "Food";
  if (r.includes("entertainment") || r.includes("leisure")) return "Entertainment";
  if (r.includes("transport") || r.includes("travel") || r.includes("auto")) return "Transportation";
  if (r.includes("util") || r.includes("bill") || r.includes("phone")) return "Utilities";
  if (r.includes("shop") || r.includes("retail")) return "Shopping";
  if (r.includes("health") || r.includes("medical")) return "Health";
  if (r.includes("educat")) return "Education";
  if (r.includes("income") || r.includes("salary") || r.includes("credit")) return "Income";
  return "Other";
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW → TRANSACTION CONVERTER
// ─────────────────────────────────────────────────────────────────────────────

function rowsToTransactions(rows: string[][], fileName: string): Transaction[] {
  if (rows.length < 2) {
    throw new Error(
      "File has fewer than 2 rows — need at least a header row and one data row."
    );
  }

  const headers = rows[0];
  const cols = detectColumns(headers);

  if (cols.date === -1) {
    throw new Error(
      `No Date column found in "${fileName}". ` +
      `Detected headers: ${headers.join(", ")}. ` +
      `Expected a column named "Date", "Transaction Date", "Posted Date", or similar.`
    );
  }
  if (cols.desc === -1) {
    throw new Error(
      `No Description column found in "${fileName}". ` +
      `Detected headers: ${headers.join(", ")}. ` +
      `Expected "Description", "Merchant", "Memo", "Narrative", or similar.`
    );
  }
  if (cols.amount === -1 && cols.debit === -1 && cols.credit === -1) {
    throw new Error(
      `No Amount column found in "${fileName}". ` +
      `Detected headers: ${headers.join(", ")}. ` +
      `Expected "Amount", "Debit"/"Credit", or "Withdrawal"/"Deposit" columns.`
    );
  }

  const transactions: Transaction[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c?.trim())) continue;

    const dateStr = (row[cols.date] ?? "").trim();
    const desc    = (row[cols.desc] ?? "").trim() || "Unknown Transaction";

    // Skip rows that look like summary/total lines
    if (/^(total|sum|balance|subtotal|opening|closing)/i.test(desc)) continue;

    let amount = 0;
    if (cols.amount !== -1) {
      amount = cleanNumber(row[cols.amount] ?? "0");
    } else {
      const debit  = cols.debit  !== -1 ? Math.abs(cleanNumber(row[cols.debit]  ?? "0")) : 0;
      const credit = cols.credit !== -1 ? Math.abs(cleanNumber(row[cols.credit] ?? "0")) : 0;
      if (debit > 0)       amount = -debit;
      else if (credit > 0) amount = credit;
    }

    const rawCategory = cols.category !== -1 ? (row[cols.category] ?? "") : "";

    transactions.push({
      id: `import-${Date.now()}-${i}`,
      date: parseDate(dateStr),
      merchant: desc,
      description: desc,
      amount,
      category: rawCategory ? mapToCategory(rawCategory) : inferCategory(desc),
      isRecurring: false,
      source: "bank_statement",
    });
  }

  if (transactions.length === 0) {
    throw new Error(
      `No valid transactions found after parsing "${fileName}". ` +
      `Check that date and amount columns contain real values.`
    );
  }

  return transactions;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT-SPECIFIC PARSERS
// ─────────────────────────────────────────────────────────────────────────────

async function parseCSVFile(file: File): Promise<Transaction[]> {
  const text = await file.text();
  const rows = parseCSVText(text);
  return rowsToTransactions(rows, file.name);
}

async function parseXLSXFile(file: File): Promise<Transaction[]> {
  const XLSX = await loadXLSX();
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  // Use the first sheet
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Excel file contains no sheets.");

  const ws = wb.Sheets[sheetName];

  // Convert to array of arrays (AOA), include header row
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  // Convert every cell to string for uniform processing
  const rows: string[][] = aoa.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) return "";
      // SheetJS stores dates as Excel serial numbers — format them
      if (typeof cell === "number" && XLSX.SSF) {
        // Check if it looks like a date serial (25569 = 1970-01-01)
        if (cell > 25569 && cell < 50000) {
          try {
            const dateStr = XLSX.SSF.format("yyyy-mm-dd", cell);
            if (dateStr && /\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;
          } catch {}
        }
      }
      return String(cell).trim();
    })
  );

  return rowsToTransactions(rows, file.name);
}

async function parsePDFFile(file: File): Promise<Transaction[]> {
  // Step 1: Extract all text from the PDF client-side using PDF.js
  let extractedText = "";
  let pageCount = 0;

  try {
    const pdfjsLib = await loadPdfJs();
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    pageCount = pdf.numPages;

    const pageTexts: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // Items have x/y coordinates — reconstruct rows by grouping by Y position
      const items: { x: number; y: number; str: string }[] = content.items.map((item: any) => ({
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
        str: item.str,
      }));
      // Group by y (row), sort by x within each row
      const byY = new Map<number, { x: number; str: string }[]>();
      for (const it of items) {
        if (!byY.has(it.y)) byY.set(it.y, []);
        byY.get(it.y)!.push({ x: it.x, str: it.str });
      }
      const lines = [...byY.entries()]
        .sort((a, b) => b[0] - a[0]) // PDF y=0 is bottom
        .map(([, cells]) =>
          cells
            .sort((a, b) => a.x - b.x)
            .map((c) => c.str)
            .join("  ")
            .trim()
        )
        .filter(Boolean);

      pageTexts.push(lines.join("\n"));
    }
    extractedText = pageTexts.join("\n");
  } catch (pdfErr) {
    throw new Error(
      `Could not read PDF: ${(pdfErr as Error).message}. ` +
      `Try converting your bank statement to CSV or Excel format first.`
    );
  }

  if (!extractedText.trim()) {
    throw new Error(
      "The PDF appears to be a scanned image — no selectable text found. " +
      "Please export your bank statement as CSV or XLSX from your bank's website instead."
    );
  }

  // Step 2: Try to detect a table in the extracted text before calling the server
  const tableResult = tryParseTextTable(extractedText, file.name);
  if (tableResult.length > 0) return tableResult;

  // Step 3: Fall back to server AI parsing (sends plain text, not binary PDF)
  // This is much cheaper and more reliable than sending the raw PDF binary
  const response = await fetch("/api/parse-text-statement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: extractedText,
      fileName: file.name,
      pageCount,
    }),
  });

  if (!response.ok) {
    let errMsg = `Server returned ${response.status}`;
    try {
      const errData = await response.json();
      errMsg = errData.message || errData.error || errMsg;
    } catch {
      // If the server returns HTML (e.g. 404), give a clear error
      errMsg =
        "Server endpoint not available. " +
        "Please set your GEMINI_API_KEY in Settings › Secrets, or convert your PDF to CSV/Excel first.";
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  if (!data.transactions?.length) {
    throw new Error(
      "AI could not extract transactions from this PDF. " +
      "Try exporting your statement as CSV from your bank's website."
    );
  }

  return data.transactions.map((t: any, i: number) => ({
    id: `import-${Date.now()}-${i}`,
    date: t.date || new Date().toISOString().split("T")[0],
    merchant: t.description || "Unknown",
    description: t.description || "Bank Statement Entry",
    amount: parseFloat(t.amount) || 0,
    category: t.category || "Other",
    isRecurring: !!t.isRecurring,
    source: "bank_statement" as const,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT TABLE PARSER  (used for PDF text output)
// Looks for lines that contain a date pattern + number — common in bank PDFs
// ─────────────────────────────────────────────────────────────────────────────

function tryParseTextTable(text: string, fileName: string): Transaction[] {
  const transactions: Transaction[] = [];

  // Date pattern: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-Mon-YYYY
  const dateRE =
    /(\d{2}[\/\-]\d{2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2}|\d{2}[\s\-][A-Za-z]{3}[\s\-]\d{2,4}|[A-Za-z]{3}\s+\d{1,2},?\s+\d{4})/;
  // Amount pattern: optional minus/parens + digits + decimal
  const amtRE = /([(\-]?\s*[\d,]+\.\d{2}\s*[)]?)/g;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length < 10) continue;

    const dateMatch = trimmed.match(dateRE);
    if (!dateMatch) continue;

    const amounts = [...trimmed.matchAll(amtRE)].map((m) => cleanNumber(m[1]));
    if (!amounts.length) continue;

    // Heuristic: use the last valid amount on the line as the transaction amount.
    // (Bank PDFs often show: date | description | debit | credit | balance,
    //  so the second-to-last non-zero amount is typically what we want)
    const nonZero = amounts.filter((a) => a !== 0);
    if (!nonZero.length) continue;

    // The transaction amount is typically before the running balance
    const amount = nonZero.length >= 2 ? nonZero[nonZero.length - 2] : nonZero[0];

    // Extract description: text between date and first amount
    const afterDate = trimmed.slice(dateMatch.index! + dateMatch[0].length).trim();
    const firstAmtIdx = afterDate.search(amtRE);
    const desc = firstAmtIdx > 0 ? afterDate.slice(0, firstAmtIdx).trim() : afterDate.slice(0, 50).trim();

    if (!desc) continue;

    transactions.push({
      id: `import-${Date.now()}-${transactions.length}`,
      date: parseDate(dateMatch[1]),
      merchant: desc,
      description: desc,
      amount,
      category: inferCategory(desc),
      isRecurring: false,
      source: "bank_statement",
    });
  }

  return transactions;
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE DISPATCHER
// ─────────────────────────────────────────────────────────────────────────────

async function parseFile(file: File): Promise<Transaction[]> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.type.toLowerCase();

  if (ext === "csv" || mime === "text/csv" || mime === "application/csv") {
    return parseCSVFile(file);
  }
  if (
    ext === "xlsx" || ext === "xls" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel"
  ) {
    return parseXLSXFile(file);
  }
  if (ext === "pdf" || mime === "application/pdf") {
    return parsePDFFile(file);
  }
  throw new Error(
    `Unsupported file type: .${ext}. ` +
    `Please upload a CSV, Excel (.xlsx / .xls), or PDF bank statement.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

type ProcessingStep =
  | "idle"
  | "reading"
  | "loading_lib"
  | "parsing"
  | "extracting_pdf"
  | "ai_parsing"
  | "done"
  | "error";

const STEP_LABELS: Record<ProcessingStep, string> = {
  idle:          "",
  reading:       "Reading file...",
  loading_lib:   "Loading parser library...",
  parsing:       "Parsing rows & detecting columns...",
  extracting_pdf:"Extracting text from PDF...",
  ai_parsing:    "Sending to AI for interpretation...",
  done:          "Complete",
  error:         "Error",
};

export default function StatementImporter({
  onImportTransactions,
  onAddAlert,
}: StatementImporterProps) {
  const [step, setStep]             = useState<ProcessingStep>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parsedTxs, setParsedTxs]   = useState<Transaction[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  const resetState = () => {
    setStep("idle");
    setSelectedFile(null);
    setErrorMessage(null);
    setParsedTxs([]);
    setPreviewExpanded(false);
  };

  const processFile = async (file: File) => {
    resetState();
    setSelectedFile(file);
    setStep("reading");
    setErrorMessage(null);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

      if (ext === "xlsx" || ext === "xls") setStep("loading_lib");
      else if (ext === "pdf")               setStep("extracting_pdf");
      else                                  setStep("parsing");

      const txs = await parseFile(file);
      setParsedTxs(txs);
      setStep("done");
      onAddAlert(
        "Statement Parsed",
        `Found ${txs.length} transactions in "${file.name}" — ready to import.`,
        "success"
      );
    } catch (err: any) {
      setStep("error");
      setErrorMessage(err.message ?? "Unknown error while parsing file.");
      onAddAlert("Parse Failed", err.message ?? "Could not parse statement.", "warning");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = ""; // allow re-selecting same file
  };

  const triggerImport = () => {
    if (!parsedTxs.length) return;
    onImportTransactions(parsedTxs);
    onAddAlert(
      "Transactions Imported",
      `Added ${parsedTxs.length} transactions to your ledger.`,
      "success"
    );
    resetState();
  };

  const isProcessing = step !== "idle" && step !== "done" && step !== "error";
  const preview = previewExpanded ? parsedTxs : parsedTxs.slice(0, 6);

  return (
    <div
      id="statement-importer-container"
      className="p-6 rounded-2xl h-full flex flex-col gap-5 transition-all duration-300 brutal-card"
    >
      {/* ── Header ── */}
      <div>
        <h3
          className="text-lg font-bold tracking-tight flex items-center gap-2 font-display"
          style={{ color: "var(--color-text-primary)" }}
        >
          <FileText className="w-5 h-5" style={{ color: "var(--color-brand-600)" }} />
          Bank Statement Importer
        </h3>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          Import CSV, Excel (.xlsx / .xls), or PDF bank statements — CSV & Excel parse entirely offline.
        </p>

        {/* Format badges */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {[
            { label: "CSV",  note: "Offline",   bg: "var(--color-success-bg)",  color: "var(--color-success-text)",  border: "var(--color-success-border)" },
            { label: "XLSX", note: "Offline",   bg: "var(--color-success-bg)",  color: "var(--color-success-text)",  border: "var(--color-success-border)" },
            { label: "XLS",  note: "Offline",   bg: "var(--color-success-bg)",  color: "var(--color-success-text)",  border: "var(--color-success-border)" },
            { label: "PDF",  note: "Text PDFs", bg: "var(--color-info-bg)",      color: "var(--color-info-text)",     border: "var(--color-info-border)" },
          ].map(({ label, note, bg, color, border }) => (
            <span
              key={label}
              className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
              style={{ backgroundColor: bg, color, borderColor: border }}
            >
              {label} — {note}
            </span>
          ))}
        </div>
      </div>

      {/* ── Error message ── */}
      {errorMessage && (
        <div
          className="text-xs p-3.5 rounded-xl flex items-start gap-2 border"
          style={{
            backgroundColor: "var(--color-danger-bg)",
            borderColor: "var(--color-danger-border)",
            color: "var(--color-danger-text)",
          }}
        >
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">Could not parse file</p>
            <p className="font-normal leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* ── Drop zone (shown when idle or after error) ── */}
      {(step === "idle" || step === "error") && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4 group"
          style={{
            backgroundColor: isDragging ? "var(--color-brand-50)" : "var(--color-bg-subtle)",
            borderColor: isDragging ? "var(--color-brand-500)" : "var(--color-border-medium)",
            transform: isDragging ? "scale(1.01)" : "scale(1)",
          }}
        >
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105"
            style={{ backgroundColor: "var(--color-bg-muted)" }}
          >
            <Upload className="w-7 h-7" style={{ color: "var(--color-brand-600)" }} />
          </div>

          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Drag & Drop your bank statement
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              CSV, Excel (.xlsx / .xls), or PDF — up to 20 MB
            </p>
          </div>

          {/* Three format buttons */}
          <div className="flex flex-wrap gap-2 justify-center mt-1">
            {[
              { accept: ".csv",             icon: FileText,        label: "CSV",   color: "#10b981" },
              { accept: ".xlsx,.xls",       icon: FileSpreadsheet, label: "Excel", color: "#3b82f6" },
              { accept: ".pdf",             icon: FileText,        label: "PDF",   color: "#f59e0b" },
            ].map(({ accept, icon: Icon, label, color }) => (
              <label
                key={label}
                className="flex items-center gap-1.5 font-semibold text-xs py-2 px-3.5 rounded-xl cursor-pointer transition-colors border"
                style={{
                  backgroundColor: "var(--color-bg-surface)",
                  color: "var(--color-text-secondary)",
                  borderColor: "var(--color-border-medium)",
                }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color }} />
                {label}
                <input
                  type="file"
                  accept={accept}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            ))}
          </div>

          <label
            className="text-white font-semibold text-xs py-2 px-5 rounded-xl cursor-pointer transition-colors"
            style={{ backgroundColor: "var(--color-brand-600)" }}
          >
            Browse All Files
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* ── Processing spinner ── */}
      {isProcessing && selectedFile && (
        <div
          className="rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-4 border"
          style={{
            backgroundColor: "var(--color-brand-50)",
            borderColor: "var(--color-brand-100)",
          }}
        >
          <div className="relative">
            <RefreshCw className="w-10 h-10 animate-spin" style={{ color: "var(--color-brand-600)" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {selectedFile.name}
            </p>
            <p className="text-xs mt-1 font-mono uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
              {STEP_LABELS[step]}
            </p>
          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-1.5 text-[10px] font-medium flex-wrap justify-center">
            {(["reading", "loading_lib", "parsing", "extracting_pdf", "ai_parsing"] as ProcessingStep[])
              .filter((s) => {
                const ext = selectedFile.name.split(".").pop()?.toLowerCase();
                if (ext !== "pdf" && (s === "extracting_pdf" || s === "ai_parsing")) return false;
                if (ext !== "xlsx" && ext !== "xls" && s === "loading_lib") return false;
                return true;
              })
              .map((s, i, arr) => {
                const stepOrder: ProcessingStep[] = ["reading","loading_lib","parsing","extracting_pdf","ai_parsing","done"];
                const currentIdx = stepOrder.indexOf(step);
                const thisIdx    = stepOrder.indexOf(s);
                const isDone     = thisIdx < currentIdx;
                const isCurrent  = thisIdx === currentIdx;
                return (
                  <React.Fragment key={s}>
                    {i > 0 && <span style={{ color: "var(--color-border-strong)" }}>→</span>}
                    <span
                      className="px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isDone ? "var(--color-success-bg)" : isCurrent ? "var(--color-brand-50)" : "var(--color-bg-muted)",
                        color:           isDone ? "var(--color-success-text)" : isCurrent ? "var(--color-brand-600)" : "var(--color-text-disabled)",
                        border: `1px solid ${isDone ? "var(--color-success-border)" : isCurrent ? "var(--color-brand-100)" : "transparent"}`,
                      }}
                    >
                      {isDone && "✓ "}{STEP_LABELS[s]}
                    </span>
                  </React.Fragment>
                );
              })}
          </div>
        </div>
      )}

      {/* ── Preview table ── */}
      {step === "done" && parsedTxs.length > 0 && (
        <div className="flex flex-col gap-3">
          {/* Preview header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: "var(--color-success-icon)" }} />
              <span className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {parsedTxs.length} transactions found in{" "}
                <span className="font-mono">{selectedFile?.name}</span>
              </span>
            </div>
            <span
              className="text-[10px] font-bold rounded-full px-2.5 py-0.5 border"
              style={{
                backgroundColor: "var(--color-brand-50)",
                color: "var(--color-brand-600)",
                borderColor: "var(--color-brand-100)",
              }}
            >
              {parsedTxs.length} rows
            </span>
          </div>

          {/* Table */}
          <div
            className="rounded-xl overflow-hidden border text-xs"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              borderColor: "var(--color-border-medium)",
            }}
          >
            {/* Table header */}
            <div
              className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                borderColor: "var(--color-border-subtle)",
                color: "var(--color-text-muted)",
              }}
            >
              <span className="col-span-2">Date</span>
              <span className="col-span-5">Description</span>
              <span className="col-span-2">Category</span>
              <span className="col-span-2 text-right">Amount</span>
              <span className="col-span-1"></span>
            </div>

            {/* Rows */}
            <div
              className="max-h-52 overflow-y-auto divide-y"
              style={{ borderColor: "var(--color-border-subtle)" }}
            >
              {preview.map((tx, i) => (
                <div
                  key={tx.id}
                  className="grid grid-cols-12 gap-2 px-3 py-2.5 items-center transition-colors"
                  style={{ borderColor: "var(--color-border-subtle)" }}
                >
                  <span
                    className="col-span-2 font-mono text-[10px]"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {tx.date}
                  </span>
                  <span
                    className="col-span-5 truncate font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                    title={tx.merchant}
                  >
                    {tx.merchant}
                  </span>
                  <span className="col-span-2">
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded border"
                      style={{
                        backgroundColor: "var(--color-brand-50)",
                        color: "var(--color-brand-600)",
                        borderColor: "var(--color-brand-100)",
                      }}
                    >
                      {tx.category}
                    </span>
                  </span>
                  <span
                    className="col-span-2 text-right font-mono font-bold"
                    style={{ color: tx.amount < 0 ? "#f43f5e" : "#10b981" }}
                  >
                    {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
                  </span>
                  <span className="col-span-1" />
                </div>
              ))}
            </div>

            {/* Show more / less */}
            {parsedTxs.length > 6 && (
              <button
                onClick={() => setPreviewExpanded(!previewExpanded)}
                className="w-full py-2 text-[10px] font-bold uppercase tracking-wider border-t transition-colors cursor-pointer"
                style={{
                  backgroundColor: "var(--color-bg-subtle)",
                  borderColor: "var(--color-border-subtle)",
                  color: "var(--color-brand-600)",
                }}
              >
                {previewExpanded
                  ? "Show less"
                  : `Show all ${parsedTxs.length} transactions ↓`}
              </button>
            )}
          </div>

          {/* Summary chips */}
          <div className="flex gap-3 flex-wrap text-[10px]">
            {[
              {
                label: "Expenses",
                val: parsedTxs.filter((t) => t.amount < 0).length,
                color: "#f43f5e",
              },
              {
                label: "Income",
                val: parsedTxs.filter((t) => t.amount > 0).length,
                color: "#10b981",
              },
              {
                label: "Net",
                val: `$${parsedTxs.reduce((a, t) => a + t.amount, 0).toFixed(2)}`,
                color: "var(--color-brand-600)",
              },
            ].map(({ label, val, color }) => (
              <span
                key={label}
                className="px-2.5 py-1 rounded-full border font-semibold"
                style={{
                  backgroundColor: "var(--color-bg-subtle)",
                  borderColor: "var(--color-border-medium)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {label}:{" "}
                <strong style={{ color }}>{val}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Action buttons ── */}
      {step === "done" && parsedTxs.length > 0 && (
        <div className="flex gap-2.5">
          <button
            onClick={resetState}
            className="flex-1 font-semibold text-xs py-2.5 rounded-xl transition-colors cursor-pointer border"
            style={{
              backgroundColor: "var(--color-bg-subtle)",
              color: "var(--color-text-secondary)",
              borderColor: "var(--color-border-medium)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={triggerImport}
            className="flex-1 text-white font-semibold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            style={{ backgroundColor: "var(--color-brand-600)" }}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            Import {parsedTxs.length} Transactions
          </button>
        </div>
      )}

      {/* Retry button after error */}
      {step === "error" && selectedFile && (
        <button
          onClick={() => { resetState(); }}
          className="w-full font-semibold text-xs py-2.5 rounded-xl border transition-colors cursor-pointer"
          style={{
            backgroundColor: "var(--color-bg-subtle)",
            color: "var(--color-text-secondary)",
            borderColor: "var(--color-border-medium)",
          }}
        >
          Try a different file
        </button>
      )}
    </div>
  );
}