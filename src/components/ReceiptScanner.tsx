import React, { useState, useRef, useEffect } from "react";
import {
  Camera, Upload, Check, AlertCircle, RefreshCw, Layers, ShieldCheck,
} from "lucide-react";
import { Transaction } from "../types";

interface ReceiptScannerProps {
  onAddTransaction: (transaction: Omit<Transaction, "id">) => void;
  onAddAlert: (title: string, message: string, type: "warning" | "info" | "success") => void;
}

export default function ReceiptScanner({
  onAddTransaction,
  onAddAlert,
}: ReceiptScannerProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [ocrResult, setOcrResult] = useState<{
    merchant: string;
    date: string;
    totalAmount: number;
    category: any;
    items: Array<{ name: string; price: number }>;
    confidence: number;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setErrorMessage(null);
    setCapturedImage(null);
    setOcrResult(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setStream(mediaStream);
      setIsCameraActive(true);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch (err: any) {
      const isDenied =
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError" ||
        err.message?.toLowerCase().includes("permission") ||
        err.message?.toLowerCase().includes("denied");

      setErrorMessage(
        isDenied
          ? "Camera permission denied. You can drag-and-drop your receipt image or use the upload button below."
          : "Could not access camera. Check system permissions, or use drag-and-drop / file upload instead."
      );
    }
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [isCameraActive, stream]);

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setCapturedImage(dataUrl);
        stopCamera();
        analyzeReceipt(dataUrl);
      }
    }
  };

  const processUploadedFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (PNG, JPG, JPEG).");
      onAddAlert("Invalid Format", "Only image files can be scanned by Gemini OCR.", "warning");
      return;
    }
    setErrorMessage(null);
    setOcrResult(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setCapturedImage(base64);
      analyzeReceipt(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUploadedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processUploadedFile(file);
  };

  const analyzeReceipt = async (base64Image: string) => {
    setIsAnalyzing(true);
    setOcrResult(null);
    setErrorMessage(null);

    const steps = [
      "Securing connection...",
      "Extracting text via Gemini OCR...",
      "Analyzing categories & line items...",
      "Finalizing receipt structure...",
    ];

    let stepIndex = 0;
    setAnalysisProgress(steps[0]);
    const progressInterval = setInterval(() => {
      if (stepIndex < steps.length - 1) {
        stepIndex++;
        setAnalysisProgress(steps[stepIndex]);
      }
    }, 1500);

    try {
      const response = await fetch("/api/upload-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Image,
          mimeType: base64Image.split(";")[0].split(":")[1] || "image/jpeg",
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || errData.error || "Server failed to process receipt.");
      }

      const receiptData = await response.json();
      setOcrResult(receiptData);
      onAddAlert(
        "Receipt Scanned",
        `Extracted $${receiptData.totalAmount} at ${receiptData.merchant}`,
        "success"
      );
    } catch (err: any) {
      clearInterval(progressInterval);
      setErrorMessage(err.message || "An error occurred during scanning. Please try again.");
      onAddAlert("Scanning Failed", "Could not analyze receipt with Gemini AI.", "warning");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveTransaction = () => {
    if (!ocrResult) return;
    onAddTransaction({
      date: ocrResult.date,
      merchant: ocrResult.merchant,
      description: `Receipt OCR — ${ocrResult.merchant}`,
      amount: -Math.abs(ocrResult.totalAmount),
      category: ocrResult.category,
      isRecurring: false,
      source: "receipt",
      notes: `Scanned items: ${ocrResult.items.map((i) => `${i.name} ($${i.price})`).join(", ")}`,
    });
    onAddAlert("Transaction Logged", `Saved $${ocrResult.totalAmount} at ${ocrResult.merchant}`, "success");
    setCapturedImage(null);
    setOcrResult(null);
  };

  return (
    <div
      id="receipt-scanner-container"
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
              <Camera className="w-5 h-5" style={{ color: "var(--color-brand-600)" }} />
              Receipt Scanner
            </h3>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              Transcribe paper receipts to your ledger using Gemini AI OCR.
            </p>
          </div>
        </div>

        {/* Error frame */}
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

        {/* Camera / upload viewport */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="relative aspect-video rounded-2xl overflow-hidden flex flex-col items-center justify-center text-center p-4 transition-all duration-300"
          style={{
            backgroundColor: isDragging ? "#1e1b4b" : "#0f172a",
            border: isDragging
              ? "2px dashed #818cf8"
              : "1px solid #1e293b",
          }}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 pointer-events-none"
              style={{ backgroundColor: "rgba(30,27,75,0.92)" }}
            >
              <Upload className="w-12 h-12 mb-3 animate-bounce" style={{ color: "#818cf8" }} />
              <span className="text-sm font-semibold tracking-wider" style={{ color: "#c7d2fe" }}>
                Drop Receipt Photo Here
              </span>
            </div>
          )}

          {isCameraActive ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover rounded-2xl"
              />
              <div
                className="absolute inset-0 border border-dashed m-4 rounded-xl flex flex-col items-center justify-between p-4 pointer-events-none"
                style={{ borderColor: "rgba(129,140,248,0.60)" }}
              >
                <div
                  className="text-[10px] font-medium px-3 py-1 rounded-full uppercase tracking-wider border"
                  style={{
                    backgroundColor: "rgba(15,23,42,0.90)",
                    color: "#c7d2fe",
                    borderColor: "#1e293b",
                  }}
                >
                  Align receipt within frame
                </div>
                <div className="w-full flex justify-center pointer-events-auto">
                  <button
                    onClick={captureFrame}
                    className="h-10 w-10 rounded-full border-2 border-white shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    style={{ backgroundColor: "#6366f1" }}
                  />
                </div>
              </div>
            </>
          ) : capturedImage ? (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden rounded-2xl"
                 style={{ backgroundColor: "#020617" }}>
              <img
                src={capturedImage}
                alt="Captured receipt"
                className="max-h-full max-w-full object-contain"
              />
              {isAnalyzing && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center"
                  style={{ backgroundColor: "rgba(2,6,23,0.88)" }}
                >
                  <RefreshCw className="w-10 h-10 animate-spin mb-3" style={{ color: "#818cf8" }} />
                  <span className="text-sm font-semibold tracking-tight font-display" style={{ color: "#f1f5f9" }}>
                    AI Receipt Reading...
                  </span>
                  <span className="text-xs mt-2 font-mono uppercase" style={{ color: "#a5b4fc" }}>
                    {analysisProgress}
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center gap-3.5 p-4">
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "#1e293b" }}
              >
                <Camera className="w-6 h-6" style={{ color: "#64748b" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>
                  Receipt Snap
                </p>
                <p className="text-xs mt-1" style={{ color: "#475569" }}>
                  Use live camera, drag-and-drop, or upload a receipt photo.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5 mt-2 justify-center">
                <button
                  onClick={startCamera}
                  className="text-white font-semibold text-xs py-2 px-4 rounded-xl transition-colors cursor-pointer"
                  style={{ backgroundColor: "#4f46e5" }}
                >
                  Start Camera
                </button>
                <label
                  className="font-semibold border text-xs py-2 px-4 rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: "#1e293b",
                    color: "#cbd5e1",
                    borderColor: "#334155",
                  }}
                >
                  <Upload className="w-3.5 h-3.5" /> Upload File
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* OCR result panel */}
        {ocrResult && (
          <div
            className="mt-4 border p-4 rounded-xl flex-1 overflow-y-auto"
            style={{
              backgroundColor: "var(--color-bg-subtle)",
              borderColor: "var(--color-border-subtle)",
            }}
          >
            {/* Header row */}
            <div
              className="flex justify-between items-center pb-2 mb-3.5 border-b"
              style={{ borderColor: "var(--color-border-subtle)" }}
            >
              <h4
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--color-text-primary)" }}
              >
                Extracted Data
              </h4>
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border"
                style={{
                  backgroundColor: "var(--color-brand-50)",
                  borderColor: "var(--color-brand-100)",
                  color: "var(--color-brand-600)",
                }}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {(ocrResult.confidence * 100).toFixed(0)}% Confidence
              </div>
            </div>

            {/* Editable fields */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label
                  className="text-[10px] font-semibold block mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Merchant
                </label>
                <input
                  type="text"
                  value={ocrResult.merchant}
                  onChange={(e) => setOcrResult({ ...ocrResult, merchant: e.target.value })}
                  className="brutal-input text-xs"
                />
              </div>
              <div>
                <label
                  className="text-[10px] font-semibold block mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Date
                </label>
                <input
                  type="date"
                  value={ocrResult.date}
                  onChange={(e) => setOcrResult({ ...ocrResult, date: e.target.value })}
                  className="brutal-input text-xs"
                />
              </div>
              <div>
                <label
                  className="text-[10px] font-semibold block mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Category
                </label>
                <select
                  value={ocrResult.category}
                  onChange={(e) => setOcrResult({ ...ocrResult, category: e.target.value as any })}
                  className="brutal-input text-xs"
                >
                  {["Food","Utilities","Entertainment","Transportation","Shopping","Health","Education","Other"].map(
                    (c) => <option key={c} value={c}>{c}</option>
                  )}
                </select>
              </div>
              <div>
                <label
                  className="text-[10px] font-semibold block mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Total Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={ocrResult.totalAmount}
                  onChange={(e) => setOcrResult({ ...ocrResult, totalAmount: parseFloat(e.target.value) || 0 })}
                  className="brutal-input text-xs font-mono font-bold"
                />
              </div>
            </div>

            {/* Line items */}
            {ocrResult.items && ocrResult.items.length > 0 && (
              <div className="border-t pt-3" style={{ borderColor: "var(--color-border-subtle)" }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Layers className="w-3.5 h-3.5" style={{ color: "var(--color-text-muted)" }} />
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Line Items Detected
                  </span>
                </div>
                <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                  {ocrResult.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      className="flex justify-between items-center text-xs py-0.5 border-b last:border-b-0"
                      style={{ borderColor: "var(--color-border-subtle)" }}
                    >
                      <span className="truncate max-w-[170px]" style={{ color: "var(--color-text-secondary)" }}>
                        {item.name}
                      </span>
                      <span className="font-semibold font-mono" style={{ color: "var(--color-text-primary)" }}>
                        ${item.price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons when OCR complete */}
      {ocrResult && (
        <div className="mt-4 flex gap-2.5">
          <button
            onClick={() => { setCapturedImage(null); setOcrResult(null); }}
            className="flex-1 brutal-btn-secondary text-xs py-2.5 rounded-xl"
          >
            Clear
          </button>
          <button
            onClick={handleSaveTransaction}
            className="flex-1 brutal-btn-primary text-xs py-2.5 flex items-center justify-center gap-1.5 rounded-xl"
          >
            <Check className="w-3.5 h-3.5" /> Save to Ledger
          </button>
        </div>
      )}

      {isCameraActive && (
        <button
          onClick={stopCamera}
          className="mt-4 w-full font-semibold border text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
          style={{
            backgroundColor: "var(--color-danger-bg)",
            color: "var(--color-danger-text)",
            borderColor: "var(--color-danger-border)",
          }}
        >
          Cancel Camera
        </button>
      )}
    </div>
  );
}