import React, { useState } from "react";
import {
  Upload, FileText, CheckCircle2, ArrowDownToLine, RefreshCw, AlertCircle,
} from "lucide-react";
import { Transaction } from "../types";

interface StatementImporterProps {
  onImportTransactions: (newTransactions: Transaction[]) => void;
  onAddAlert: (title: string, message: string, type: "warning" | "info" | "success") => void;
}

export default function StatementImporter({
  onImportTransactions,
  onAddAlert,
}: StatementImporterProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<Transaction[]>([]);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setErrorMessage(null);
    setParsedTransactions([]);
    setProcessingStatus("Reading document data stream...");

    const reader = new FileReader();
    reader.onerror = () => {
      setErrorMessage("Failed to read the bank statement file.");
      setIsProcessing(false);
    };

    reader.onload = async () => {
      const base64Content = reader.result as string;
      const fileBase64 = base64Content.split(",")[1] || base64Content;
      const mimeType = file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "text/csv");

      setProcessingStatus("Submitting to Gemini AI engine...");

      try {
        const response = await fetch("/api/parse-bank-statement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileBase64, fileName: file.name, mimeType }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || errData.error || "Failed to parse document");
        }

        const data = await response.json();

        if (data.transactions && Array.isArray(data.transactions)) {
          const mapped: Transaction[] = data.transactions.map((t: any) => ({
            id: `imported-${Math.random().toString(36).substring(2, 9)}`,
            date: t.date || new Date().toISOString().split("T")[0],
            merchant: t.description || "Unidentified Merchant",
            description: t.description || "Historical Statement Entry",
            amount: parseFloat(t.amount) || 0,
            category: t.category || "Other",
            isRecurring: !!t.isRecurring,
            source: "bank_statement" as const,
            notes: `Imported from: ${file.name}`,
          }));
          setParsedTransactions(mapped);
          onAddAlert("Statement Parsed", `Extracted ${mapped.length} records using Gemini AI!`, "success");
        } else {
          throw new Error("No readable transactions found in bank statement.");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Could not analyze the statement. Max size ~20MB for PDF.");
        onAddAlert("Import Failed", "Gemini could not parse the bank statement format.", "warning");
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsDataURL(file);
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
  };

  const triggerImport = () => {
    if (parsedTransactions.length === 0) return;
    onImportTransactions(parsedTransactions);
    onAddAlert(
      "Import Saved",
      `Added ${parsedTransactions.length} transaction entries to your ledger.`,
      "success"
    );
    setSelectedFile(null);
    setParsedTransactions([]);
  };

  return (
    <div
      id="statement-importer-container"
      className="p-6 rounded-2xl h-full flex flex-col justify-between transition-all duration-300 brutal-card"
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3
              className="text-lg font-bold tracking-tight flex items-center gap-2 font-display"
              style={{ color: "var(--color-text-primary)" }}
            >
              <FileText className="w-5 h-5" style={{ color: "var(--color-brand-600)" }} />
              File Statement Ingestion
            </h3>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              Drop bank statement PDF or CSV files to analyze history instantly.
            </p>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div
            className="text-xs p-3.5 rounded-xl flex items-start gap-2 mb-4 border"
            style={{
              backgroundColor: "var(--color-danger-bg)",
              borderColor: "var(--color-danger-border)",
              color: "var(--color-danger-text)",
            }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Drag & drop zone */}
        {!selectedFile && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="border border-dashed p-8 rounded-2xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4 group"
            style={{
              backgroundColor: isDragging ? "var(--color-brand-50)" : "var(--color-bg-subtle)",
              borderColor: isDragging ? "var(--color-brand-500)" : "var(--color-border-medium)",
              transform: isDragging ? "scale(1.01)" : "scale(1)",
            }}
          >
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
              style={{ backgroundColor: "var(--color-bg-muted)" }}
            >
              <Upload className="w-6 h-6" style={{ color: "var(--color-brand-600)" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Drag & Drop Statement File
              </p>
              <p className="text-xs mt-1 font-sans" style={{ color: "var(--color-text-muted)" }}>
                Accepts PDF bank outputs or CSV formats up to 20MB
              </p>
            </div>
            <label
              className="text-white font-semibold text-xs py-2 px-4 rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
              style={{ backgroundColor: "var(--color-brand-600)" }}
            >
              Browse Files
              <input type="file" accept=".pdf,.csv" onChange={handleFileChange} className="hidden" />
            </label>
          </div>
        )}

        {/* Processing screen */}
        {selectedFile && isProcessing && (
          <div
            className="border p-8 rounded-2xl flex flex-col items-center justify-center text-center"
            style={{
              backgroundColor: "var(--color-brand-50)",
              borderColor: "var(--color-brand-100)",
            }}
          >
            <RefreshCw className="w-10 h-10 animate-spin mb-4" style={{ color: "var(--color-brand-600)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Processing "{selectedFile.name}"
            </span>
            <span className="text-xs mt-1.5 font-mono uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
              {processingStatus}
            </span>
          </div>
        )}

        {/* Preview grid */}
        {selectedFile && !isProcessing && parsedTransactions.length > 0 && (
          <div
            className="border p-4 rounded-xl flex flex-col"
            style={{
              backgroundColor: "var(--color-bg-subtle)",
              borderColor: "var(--color-border-subtle)",
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 animate-bounce" style={{ color: "var(--color-success-icon)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Ready to Import:
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
                {parsedTransactions.length} Items
              </span>
            </div>

            <div
              className="max-h-52 overflow-y-auto border rounded-xl text-xs divide-y"
              style={{
                backgroundColor: "var(--color-bg-surface)",
                borderColor: "var(--color-border-medium)",
                divideColor: "var(--color-border-subtle)",
              }}
            >
              {parsedTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 flex items-center justify-between transition-colors"
                  style={{ borderColor: "var(--color-border-subtle)" }}
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="text-[9px] font-mono px-2 py-0.5 rounded border"
                        style={{
                          backgroundColor: "var(--color-bg-subtle)",
                          color: "var(--color-text-disabled)",
                          borderColor: "var(--color-border-subtle)",
                        }}
                      >
                        {tx.date}
                      </span>
                      <span
                        className="font-semibold truncate max-w-[190px]"
                        style={{ color: "var(--color-text-primary)" }}
                        title={tx.merchant}
                      >
                        {tx.merchant}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="brutal-badge-indigo">{tx.category}</span>
                      {tx.isRecurring && (
                        <span
                          className="text-[9px] font-bold border px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: "var(--color-warning-bg)",
                            color: "var(--color-warning-text)",
                            borderColor: "var(--color-warning-border)",
                          }}
                        >
                          Recurring
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className="font-mono font-bold shrink-0 text-right"
                    style={{ color: tx.amount < 0 ? "#f43f5e" : "#10b981" }}
                  >
                    {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Import action buttons */}
      {selectedFile && !isProcessing && parsedTransactions.length > 0 && (
        <div className="mt-4 flex gap-2.5">
          <button
            onClick={() => { setSelectedFile(null); setParsedTransactions([]); }}
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
            className="flex-1 brutal-btn-primary text-xs py-2.5 flex items-center justify-center gap-1.5 rounded-xl"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" /> Import Statement
          </button>
        </div>
      )}
    </div>
  );
}