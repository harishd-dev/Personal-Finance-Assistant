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
  RefreshCw,
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

  const providerMeta = {
    gdrive: { label: "G-Drive",  icon: HardDrive, iconColor: "#f59e0b", badge: "Active",  badgeStyle: { bg: "var(--color-success-bg)",  color: "var(--color-success-text)"  } },
    s3:     { label: "AWS S3",   icon: Cloud,     iconColor: "#f97316", badge: "Ready",  badgeStyle: { bg: "var(--color-brand-50)",    color: "var(--color-brand-600)"    } },
    dropbox:{ label: "Dropbox",  icon: Cloud,     iconColor: "#3b82f6", badge: "Ready",  badgeStyle: { bg: "var(--color-brand-50)",    color: "var(--color-brand-600)"    } },
  } as const;

  const handleTriggerReplication = () => {
    setIsSyncing(true);
    setSyncLogs(null);

    // Simulate cloud replication (mock endpoint)
    setTimeout(() => {
      const net = income - expenses;
      const randomId = Math.random().toString(36).substring(2, 10).toUpperCase();
      const response: CloudExportResponse = {
        success: true,
        provider: selectedProvider,
        fileName: `FINANCIAL_LEDGER_${new Date().toISOString().split("T")[0]}.json`,
        bucketOrFolder:
          selectedProvider === "gdrive"
            ? "/My Drive/Financial Optimizers"
            : `s3://finance-vault-${Math.random().toString(36).substring(2, 6)}/backups`,
        exportTimestamp: new Date().toISOString(),
        shareUrl: `https://storage.googleapis.com/pf-snapshots/${selectedProvider}_${randomId}.enc`,
        transactionsCount,
        metadata: {
          totalIncome: income,
          totalExpenses: expenses,
          netSavings: net,
          exportChecksum: Array.from({ length: 16 }, () =>
            Math.floor(Math.random() * 16).toString(16)
          ).join(""),
        },
      };
      setSyncLogs(response);
      setIsSyncing(false);
      onAddAlert(
        "Backup Synchronized",
        `Replicated ${transactionsCount} entries to ${
          selectedProvider === "gdrive"
            ? "Google Drive"
            : selectedProvider === "s3"
            ? "Amazon S3"
            : "Dropbox"
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
    <div
      id="cloud-sync-container"
      className="p-6 rounded-2xl h-full flex flex-col justify-between transition-all duration-300 brutal-card"
    >
      <div>
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3
              className="text-lg font-bold tracking-tight flex items-center gap-2 font-display"
              style={{ color: "var(--color-text-primary)" }}
            >
              <Cloud className="w-5 h-5 animate-pulse" style={{ color: "var(--color-brand-600)" }} />
              Cloud Storage Export
            </h3>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              Backup your ledger and transaction summaries to cloud storage.
            </p>
          </div>
        </div>

        {/* ── Local download buttons ── */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            onClick={() => onTriggerBackupDownload("csv")}
            className="flex items-center justify-center gap-2 font-semibold text-xs p-2.5 rounded-xl transition-colors cursor-pointer border"
            style={{
              backgroundColor: "var(--color-bg-subtle)",
              borderColor: "var(--color-border-medium)",
              color: "var(--color-text-secondary)",
            }}
          >
            <FileSpreadsheet className="w-4 h-4" style={{ color: "#10b981" }} />
            Export CSV
          </button>
          <button
            onClick={() => onTriggerBackupDownload("json")}
            className="flex items-center justify-center gap-2 font-semibold text-xs p-2.5 rounded-xl transition-colors cursor-pointer border"
            style={{
              backgroundColor: "var(--color-bg-subtle)",
              borderColor: "var(--color-border-medium)",
              color: "var(--color-text-secondary)",
            }}
          >
            <Download className="w-4 h-4" style={{ color: "var(--color-brand-600)" }} />
            Save JSON
          </button>
        </div>

        {/* ── Provider selector ── */}
        <div className="space-y-3">
          <span
            className="text-[10px] font-bold uppercase tracking-widest block"
            style={{ color: "var(--color-text-muted)" }}
          >
            Select Cloud Provider
          </span>

          <div className="grid grid-cols-3 gap-3">
            {(["gdrive", "s3", "dropbox"] as const).map((id) => {
              const meta = providerMeta[id];
              const Icon = meta.icon;
              const isSelected = selectedProvider === id;
              return (
                <button
                  key={id}
                  onClick={() => { setSelectedProvider(id); setSyncLogs(null); }}
                  className="p-3.5 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer"
                  style={{
                    backgroundColor: isSelected ? "var(--color-brand-50)" : "var(--color-bg-surface)",
                    borderColor: isSelected ? "var(--color-brand-500)" : "var(--color-border-medium)",
                    boxShadow: isSelected ? "var(--shadow-sm)" : "none",
                  }}
                >
                  <span
                    className="text-[9px] px-2 py-0.5 font-bold tracking-wide rounded-full uppercase"
                    style={{
                      backgroundColor: isSelected ? meta.badgeStyle.bg : "var(--color-bg-muted)",
                      color: isSelected ? meta.badgeStyle.color : "var(--color-text-muted)",
                    }}
                  >
                    {meta.badge}
                  </span>
                  <Icon className="w-5 h-5" style={{ color: meta.iconColor }} />
                  <span
                    className="text-[10px] font-semibold tracking-tight"
                    style={{ color: isSelected ? "var(--color-brand-600)" : "var(--color-text-secondary)" }}
                  >
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Sync result card ── */}
        {syncLogs && (
          <div
            className="mt-4 rounded-2xl p-4 space-y-2.5 text-xs border"
            style={{
              backgroundColor: "var(--color-success-bg)",
              borderColor: "var(--color-success-border)",
            }}
          >
            {/* Result header */}
            <div
              className="flex justify-between items-center pb-2 border-b"
              style={{ borderColor: "var(--color-success-border)" }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--color-success-text)" }}
              >
                Sync Complete
              </span>
              <span
                className="flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: "var(--color-success-icon)",
                  color: "#ffffff",
                }}
              >
                <Check className="w-3 h-3" /> Secure
              </span>
            </div>

            {/* Metadata rows */}
            <div className="space-y-1.5">
              {[
                { label: "File",    value: syncLogs.fileName },
                { label: "Path",    value: syncLogs.bucketOrFolder },
                { label: "Records", value: `${syncLogs.transactionsCount} entries` },
                { label: "SHA-256", value: syncLogs.metadata.exportChecksum },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-[11px]">
                  <span style={{ color: "var(--color-text-muted)" }}>{label}:</span>
                  <span
                    className="font-medium truncate max-w-[200px] ml-2 font-mono"
                    style={{ color: "var(--color-text-primary)" }}
                    title={value}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* Share link row */}
            <div
              className="flex items-center justify-between p-2 rounded-xl mt-2 border"
              style={{
                backgroundColor: "var(--color-bg-surface)",
                borderColor: "var(--color-success-border)",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <span
                className="text-[10px] truncate max-w-[190px] font-mono pl-1 select-all"
                style={{ color: "var(--color-brand-600)" }}
              >
                {syncLogs.shareUrl}
              </span>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={copyUrlToClipboard}
                  className="p-1.5 rounded-lg transition-colors cursor-pointer"
                  style={{ color: copiedLink ? "var(--color-success-icon)" : "var(--color-text-muted)" }}
                  title="Copy URL"
                >
                  {copiedLink ? (
                    <CheckCircle className="w-3.5 h-3.5 animate-bounce" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <a
                  href={syncLogs.shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--color-text-muted)" }}
                  title="Open Link"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Sync button ── */}
      <button
        onClick={handleTriggerReplication}
        disabled={isSyncing || transactionsCount === 0}
        className="w-full mt-5 text-white text-xs font-semibold py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: "var(--color-brand-600)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {isSyncing ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" /> Synchronizing...
          </>
        ) : (
          "Run Storage Replication"
        )}
      </button>
    </div>
  );
}