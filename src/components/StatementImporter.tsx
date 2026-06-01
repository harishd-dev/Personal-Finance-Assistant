import React, { useState } from "react";
import { Upload, FileText, CheckCircle2, ArrowDownToLine, RefreshCw, AlertCircle } from "lucide-react";
import { Transaction } from "../types";

interface StatementImporterProps {
  onImportTransactions: (newTransactions: Transaction[]) => void;
  onAddAlert: (title: string, message: string, type: "warning" | "info" | "success") => void;
}

export default function StatementImporter({ onImportTransactions, onAddAlert }: StatementImporterProps) {
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

  const handleDragLeave = () => {
    setIsDragging(false);
  };

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

      setProcessingStatus("Submitting bank statement to Gemini AI engine...");

      try {
        const response = await fetch("/api/parse-bank-statement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileBase64,
            fileName: file.name,
            mimeType
          })
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
            source: "bank_statement",
            notes: `Imported from bank statement: ${file.name}`
          }));

          setParsedTransactions(mapped);
          onAddAlert(
            "Statement Parsed",
            `Extracted ${mapped.length} historical records using Gemini AI!`,
            "success"
          );
        } else {
          throw new Error("No readable transactions list generated from bank statement.");
        }
      } catch (err: any) {
        console.error(err);
        setErrorMessage(
          err.message || "Could not analyze the statement. Max file sizes are ~20MB for PDF."
        );
        onAddAlert("Import Failed", "Gemini could not parse bank statement format.", "warning");
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
    if (file) {
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const triggerImport = () => {
    if (parsedTransactions.length === 0) return;
    
    onImportTransactions(parsedTransactions);
    onAddAlert(
      "Imported Saved",
      `Added ${parsedTransactions.length} transaction entries to active portfolio logs.`,
      "success"
    );
    
    setSelectedFile(null);
    setParsedTransactions([]);
  };

  return (
    <div id="statement-importer-container" className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm h-full flex flex-col justify-between hover:shadow-md transition-all duration-300">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2 font-display">
              <FileText className="w-5 h-5 text-indigo-500" />
              File Statement Ingestion
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Drop bank statement PDF or CSV spreadsheets to analyze history instantly.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-100 text-rose-800 text-xs p-3.5 rounded-xl flex items-start gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Drag & Drop Visual Box */}
        {!selectedFile && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border border-dashed p-8 rounded-2xl text-center bg-slate-50/20 cursor-pointer transition-all flex flex-col items-center justify-center gap-4 group ${
              isDragging ? "bg-indigo-50 border-indigo-400 scale-[1.01]" : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <div className="h-12 w-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Upload className="w-6 h-6 text-indigo-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Drag & Drop Statement File</p>
              <p className="text-xs text-slate-400 mt-1 font-sans">Accepts PDF bank outputs or CSV formats up to 20MB</p>
            </div>
            
            <label className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-4 rounded-xl flex items-center gap-2 cursor-pointer transition-colors shadow-2xs">
              Browse Files
              <input
                type="file"
                accept=".pdf,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Active Uploading / Processing Screen */}
        {selectedFile && isProcessing && (
          <div className="bg-indigo-50/40 border border-indigo-100 p-8 rounded-2xl flex flex-col items-center justify-center text-center shadow-2xs">
            <RefreshCw className="w-10 h-10 text-indigo-650 animate-spin mb-4" />
            <span className="text-sm font-semibold text-slate-800">Processing "{selectedFile.name}"</span>
            <span className="text-xs text-slate-400 mt-1.5 font-mono uppercase tracking-wide">{processingStatus}</span>
          </div>
        )}

        {/* Result grid preview lists */}
        {selectedFile && !isProcessing && parsedTransactions.length > 0 && (
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-bounce" />
                <span className="text-xs font-semibold text-slate-700">Ready to Ingest:</span>
              </div>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100/60 rounded-full px-2.5 py-0.5">
                {parsedTransactions.length} Items Identified
              </span>
            </div>

            <div className="max-h-52 overflow-y-auto border border-slate-200/60 rounded-xl bg-white text-xs divide-y divide-slate-100 select-none">
              {parsedTransactions.map((tx) => (
                <div key={tx.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{tx.date}</span>
                      <span className="font-semibold text-slate-700 truncate max-w-[190px]" title={tx.merchant}>{tx.merchant}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="brutal-badge-indigo">{tx.category}</span>
                      {tx.isRecurring && (
                        <span className="text-[9px] font-bold bg-amber-50 text-amber-750 border border-amber-200 px-2 py-0.5 rounded">
                          Recurring
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`font-mono font-bold shrink-0 text-right ${tx.amount < 0 ? "text-red-500" : "text-emerald-600"}`}>
                    {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedFile && !isProcessing && parsedTransactions.length > 0 && (
        <div className="mt-4 flex gap-2.5">
          <button
            onClick={() => {
              setSelectedFile(null);
              setParsedTransactions([]);
            }}
            className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
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
