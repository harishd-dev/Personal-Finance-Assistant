import React, { useState, useRef, useEffect } from "react";
import { Camera, Upload, Check, AlertCircle, RefreshCw, Layers, ShieldCheck } from "lucide-react";
import { Transaction } from "../types";

interface ReceiptScannerProps {
  onAddTransaction: (transaction: Omit<Transaction, "id">) => void;
  onAddAlert: (title: string, message: string, type: "warning" | "info" | "success") => void;
}

export default function ReceiptScanner({ onAddTransaction, onAddAlert }: ReceiptScannerProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Results view states
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
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Camera access failed", err);
      if (
        err.name === "NotAllowedError" || 
        err.name === "PermissionDeniedError" || 
        err.name === "PermissionDismissedError" || 
        err.message?.toLowerCase().includes("permission") || 
        err.message?.toLowerCase().includes("dismiss") ||
        err.message?.toLowerCase().includes("denied")
      ) {
        setErrorMessage(
          "Camera permission was dismissed or blocked. No worries! You can drag and drop your receipt image directly into the frame, or upload a photo using the button below."
        );
      } else {
        setErrorMessage(
          "Could not access camera. Please check your system camera permissions, or use drag-and-drop/manual file upload instead."
        );
      }
    }
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
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

  const processUploadedReceiptFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select or drop a valid image file (PNG, JPG, JPEG).");
      onAddAlert(
        "Invalid File Format",
        "Only photo images (PNG, JPG, JPEG) can be transcribed using Gemini OCR.",
        "warning"
      );
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
    if (file) {
      processUploadedReceiptFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedReceiptFile(file);
    }
  };

  const analyzeReceipt = async (base64Image: string) => {
    setIsAnalyzing(true);
    setOcrResult(null);
    setErrorMessage(null);
    
    const steps = [
      "Securing connection...",
      "Extracting text via Gemini Optical OCR...",
      "Analyzing categories & line items...",
      "Finalizing receipt schema structure..."
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
          mimeType: base64Image.split(";")[0].split(":")[1] || "image/jpeg"
        })
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || errData.error || "Server failed to process receipt.");
      }

      const receiptData = await response.json();
      setOcrResult(receiptData);
      
      onAddAlert(
        "Receipt OCR Complete",
        `Extracted spent total $${receiptData.totalAmount} at ${receiptData.merchant}`,
        "success"
      );
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error(err);
      setErrorMessage(err.message || "An error occurred during scanning. Attempt again.");
      onAddAlert("Scanning Failed", "Could not analyze the receipt with Gemini AI", "warning");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveTransaction = () => {
    if (!ocrResult) return;
    
    onAddTransaction({
      date: ocrResult.date,
      merchant: ocrResult.merchant,
      description: `Receipt OCR - ${ocrResult.merchant}`,
      amount: -Math.abs(ocrResult.totalAmount),
      category: ocrResult.category,
      isRecurring: false,
      source: "receipt",
      notes: `Scanned items: ${ocrResult.items.map(i => `${i.name} ($${i.price})`).join(", ")}`
    });

    onAddAlert("Transaction Logged", `Saved $${ocrResult.totalAmount} at ${ocrResult.merchant}`, "success");
    
    setCapturedImage(null);
    setOcrResult(null);
  };

  return (
    <div id="receipt-scanner-container" className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm h-full flex flex-col justify-between hover:shadow-md transition-all duration-300">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2 font-display">
              <Camera className="w-5 h-5 text-indigo-500" />
              Receipt Scanner
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Transcribe physical paper bills to active system ledgers using Gemini AI.
            </p>
          </div>
        </div>

        {/* Error Frame */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-100 text-rose-800 text-xs p-3.5 rounded-xl flex items-start gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Window */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative aspect-video rounded-2xl overflow-hidden flex flex-col items-center justify-center text-center p-4 transition-all duration-350 shadow-inner ${
            isDragging 
              ? "bg-indigo-950/95 border-2 border-dashed border-indigo-400 scale-[1.01]" 
              : "bg-slate-900 border border-slate-800"
          }`}
        >
          {isDragging && (
            <div className="absolute inset-0 bg-indigo-950/90 z-20 flex flex-col items-center justify-center p-4 pointer-events-none">
              <Upload className="w-12 h-12 text-indigo-400 animate-bounce mb-3" />
              <span className="text-sm text-indigo-300 font-semibold tracking-wider">Drop Photo of Receipt Here</span>
            </div>
          )}
          
          {isCameraActive ? (
            <>
              {/* Live Web Camera Feed */}
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="absolute inset-0 w-full h-full object-cover rounded-2xl"
              />
              <div className="absolute inset-0 border border-dashed border-indigo-400/60 m-4 rounded-xl flex flex-col items-center justify-between p-4 pointer-events-none">
                <div className="text-[10px] text-indigo-200/90 font-medium bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-full uppercase tracking-wider">
                  Align Receipt details properly
                </div>
                <div className="w-full flex justify-center pointer-events-auto">
                  <button
                    onClick={captureFrame}
                    className="h-10 w-10 rounded-full border-2 border-white bg-indigo-500 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  />
                </div>
              </div>
            </>
          ) : capturedImage ? (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden rounded-2xl">
              <img src={capturedImage} alt="Captured receipt" className="max-h-full max-w-full object-contain" />
              
              {isAnalyzing && (
                <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center p-4 text-center">
                  <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mb-3" />
                  <span className="text-sm text-white font-semibold tracking-tight font-display">AI Receipt Reading...</span>
                  <span className="text-xs text-indigo-300 mt-2 font-mono uppercase">{analysisProgress}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3.5 p-4">
              <div className="h-12 w-12 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center shadow-md">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">Receipt Snap deck</p>
                <p className="text-xs text-slate-500 mt-1">Use a live feed video scanner, drag-and-drop, or upload receipt shots.</p>
              </div>
              <div className="flex flex-wrap gap-2.5 mt-2 justify-center">
                <button
                  onClick={startCamera}
                  className="bg-indigo-650 hover:bg-indigo-600 active:bg-indigo-700 text-white font-semibold text-xs py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Start Camera Feed
                </button>
                <label className="bg-slate-800 text-slate-300 hover:bg-slate-750 font-semibold border border-slate-700 text-xs py-2 px-4 rounded-xl flex items-center gap-2 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" /> Drag or Upload File
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* OCR Result details render */}
        {ocrResult && (
          <div className="mt-4 bg-slate-50/50 border border-slate-100 p-4 rounded-xl flex-1 overflow-y-auto">
            <div className="flex justify-between items-center pb-2 mb-3.5 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">
                Extracted Data Values
              </h4>
              <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full text-[10px] text-indigo-700 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                {(ocrResult.confidence * 100).toFixed(0)}% Confidence
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Merchant</label>
                <input
                  type="text"
                  value={ocrResult.merchant}
                  onChange={(e) => setOcrResult({ ...ocrResult, merchant: e.target.value })}
                  className="brutal-input text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Date</label>
                <input
                  type="date"
                  value={ocrResult.date}
                  onChange={(e) => setOcrResult({ ...ocrResult, date: e.target.value })}
                  className="brutal-input text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Category</label>
                <select
                  value={ocrResult.category}
                  onChange={(e) => setOcrResult({ ...ocrResult, category: e.target.value as any })}
                  className="brutal-input text-xs"
                >
                  <option value="Food">Food</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Transportation">Transportation</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Health">Health</option>
                  <option value="Education">Education</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Total Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={ocrResult.totalAmount}
                  onChange={(e) => setOcrResult({ ...ocrResult, totalAmount: parseFloat(e.target.value) || 0 })}
                  className="brutal-input text-xs font-mono font-bold text-slate-800"
                />
              </div>
            </div>

            {/* Individual Receipt Line Items */}
            {ocrResult.items && ocrResult.items.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Line Items Detected</span>
                </div>
                <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                  {ocrResult.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="flex justify-between items-center text-xs text-slate-700 py-0.5 border-b border-slate-50 last:border-b-0">
                      <span className="truncate max-w-[170px] text-slate-600">{item.name}</span>
                      <span className="font-semibold text-slate-800 font-mono">${item.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {ocrResult && (
        <div className="mt-4 flex gap-2.5">
          <button
            onClick={() => {
              setCapturedImage(null);
              setOcrResult(null);
            }}
            className="flex-1 brutal-btn-secondary text-xs py-2.5 rounded-xl hover:bg-slate-50"
          >
            Clear Fields
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
          className="mt-4 w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold border border-rose-200 text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          Cancel Scan Feed
        </button>
      )}
    </div>
  );
}
