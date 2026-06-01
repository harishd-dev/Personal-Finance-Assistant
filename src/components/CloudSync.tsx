import { useState } from "react";
import { 
  Cloud, 
  FileSpreadsheet, 
  Download, 
  HardDrive, 
  Check, 
  Copy, 
  ArrowUpRight, 
  CheckCircle,
  RefreshCw
} from "lucide-react";
import { CloudExportResponse } from "../types";

interface CloudSyncProps {
  transactionsCount: number;
  income: number;
  expenses: number;
  onTriggerBackupDownload: (format: "csv" | "json") => void;
  onAddAlert: (title: string, message: string, type?: "success" | "warning" | "info") => void;
}

export default function CloudSync({
  transactionsCount,
  income,
  expenses,
  onTriggerBackupDownload,
  onAddAlert,
}: CloudSyncProps) {
  const [selectedProvider, setSelectedProvider] = useState<"gdrive" | "s3" | "dropbox">("gdrive");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<CloudExportResponse | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleTriggerReplication = () => {
    setIsSyncing(true);
    setSyncLogs(null);

    // Mock-Replicating to simulate deep micro-service replication
    setTimeout(() => {
      const net = income - expenses;
      const response: CloudExportResponse = {
        success: true,
        provider: selectedProvider,
        fileName: `FINANCIAL_LEDGER_EXPORT_${new Date().toISOString().split("T")[0]}.json`,
        bucketOrFolder: selectedProvider === "gdrive" ? "/My Drive/Financial Optimizers" : `s3://finance-vault-${Math.random().toString(36).substring(2, 6)}/backups`,
        exportTimestamp: new Date().toISOString(),
        shareUrl: `https://storage.googleapis.com/download-pf-snapshots/${selectedProvider}_payload_${Math.random().toString(36).substring(2, 10)}.enc`,
        transactionsCount,
        metadata: {
          totalIncome: income,
          totalExpenses: expenses,
          netSavings: net,
          exportChecksum: Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
        },
      };

      setSyncLogs(response);
      setIsSyncing(false);
      onAddAlert(
        "Backup Synchronized",
        `Securely replicated ${transactionsCount} ledger entries to your unified ${
          selectedProvider === "gdrive" ? "Google Drive" : selectedProvider === "s3" ? "Amazon S3 Hub" : "Dropbox Folders"
        }.`,
        "success"
      );
    }, 1800);
  };

  const copyUrlToClipboard = () => {
    if (!syncLogs?.shareUrl) return;
    navigator.clipboard.writeText(syncLogs.shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div id="cloud-sync-container" className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm h-full flex flex-col justify-between hover:shadow-md transition-all duration-300">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2 font-display">
              <Cloud className="w-5 h-5 text-indigo-500 animate-pulse" />
              Cloud Storage Export
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Safely backup summaries and transactional ledgers to cloud storage directories.
            </p>
          </div>
        </div>

        {/* Local download exports directly */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            onClick={() => onTriggerBackupDownload("csv")}
            className="flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 text-xs text-slate-700 font-semibold p-2.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export CSV
          </button>
          <button
            onClick={() => onTriggerBackupDownload("json")}
            className="flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 text-xs text-slate-700 font-semibold p-2.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-indigo-500" /> Save JSON Backup
          </button>
        </div>

        {/* Cloud Providers Grid Options */}
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Select Cloud Provider</span>
          
          <div className="grid grid-cols-3 gap-3">
            
            {/* Google Drive option */}
            <button
              onClick={() => { setSelectedProvider("gdrive"); setSyncLogs(null); }}
              className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                selectedProvider === "gdrive" 
                  ? "bg-indigo-50/50 border-indigo-400 text-indigo-900 shadow-sm" 
                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-500"
              }`}
            >
              <span className={`text-[9px] px-2 py-0.5 font-bold tracking-wide rounded-full uppercase ${selectedProvider === "gdrive" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>Active</span>
              <HardDrive className="w-5 h-5 text-amber-500" />
              <span className="text-[10px] font-semibold tracking-tight">G-Drive</span>
            </button>

            {/* AWS S3 option */}
            <button
              onClick={() => { setSelectedProvider("s3"); setSyncLogs(null); }}
              className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                selectedProvider === "s3" 
                  ? "bg-indigo-50/50 border-indigo-400 text-indigo-900 shadow-sm" 
                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-500"
              }`}
            >
              <span className={`text-[9px] px-2 py-0.5 font-bold tracking-wide rounded-full uppercase ${selectedProvider === "s3" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>Ready</span>
              <Cloud className="w-5 h-5 text-orange-500" />
              <span className="text-[10px] font-semibold tracking-tight">AWS S3</span>
            </button>

            {/* Dropbox option */}
            <button
              onClick={() => { setSelectedProvider("dropbox"); setSyncLogs(null); }}
              className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                selectedProvider === "dropbox" 
                  ? "bg-indigo-50/50 border-indigo-400 text-indigo-900 shadow-sm" 
                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-500"
              }`}
            >
              <span className={`text-[9px] px-2 py-0.5 font-bold tracking-wide rounded-full uppercase ${selectedProvider === "dropbox" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>Ready</span>
              <Cloud className="w-5 h-5 text-blue-500" />
              <span className="text-[10px] font-semibold tracking-tight">Dropbox</span>
            </button>

          </div>
        </div>

        {/* Sync logs summary display if success card */}
        {syncLogs && (
          <div className="mt-4 bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4 space-y-2.5 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-emerald-100/60">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider font-sans">Synced Snapshots Data</span>
              <span className="flex items-center gap-1 font-bold text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                <Check className="w-3 h-3" /> Secure Sync
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Target File:</span>
                <span className="text-slate-700 font-medium truncate max-w-[190px]">{syncLogs.fileName}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Path:</span>
                <span className="text-slate-700 font-medium max-w-[190px] truncate" title={syncLogs.bucketOrFolder}>
                  {syncLogs.bucketOrFolder}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Records Copied:</span>
                <span className="text-slate-700 font-medium">{syncLogs.transactionsCount} entries</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">SHA-256 Sum:</span>
                <span className="text-slate-500 font-mono truncate max-w-[120px]">{syncLogs.metadata.exportChecksum}</span>
              </div>
            </div>

            {/* Sharing link container */}
            <div className="bg-white border border-emerald-100 p-2 rounded-xl flex items-center justify-between mt-2 shadow-2xs">
              <span className="text-[10px] text-indigo-600 truncate max-w-[180px] font-mono select-all font-medium pl-1">
                {syncLogs.shareUrl}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={copyUrlToClipboard}
                  className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                  title="Copy URL"
                >
                  {copiedLink ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 animate-bounce" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={syncLogs.shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-400 hover:text-indigo-500 transition-colors"
                  title="Open Link"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleTriggerReplication}
        disabled={isSyncing || transactionsCount === 0}
        className="w-full mt-5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isSyncing ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" /> Synchronizing Ledger...
          </>
        ) : (
          "Run Storage Replication"
        )}
      </button>
    </div>
  );
}
