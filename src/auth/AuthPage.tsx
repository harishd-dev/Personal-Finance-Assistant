import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Wallet, KeyRound, Mail, Sparkles, LogIn, RefreshCw, AlertCircle, Laptop,
} from "lucide-react";

export default function AuthPage() {
  const {
    signInWithOtp,
    verifyOtp,
    signInWithGoogle,
    triggerDemoSession,
    isConfigured,
  } = useAuth();

  const [email, setEmail]         = useState("");
  const [code, setCode]           = useState("");
  const [step, setStep]           = useState<"email" | "code">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<{
    error: string | null;
    code: string | null;
    description: string | null;
  } | null>(null);

  // Parse OAuth error params from URL
  useEffect(() => {
    const searchParams  = new URLSearchParams(window.location.search);
    let hash = window.location.hash.startsWith("#")
      ? window.location.hash.substring(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);

    const error            = searchParams.get("error")            || hashParams.get("error");
    const errorCode        = searchParams.get("error_code")       || hashParams.get("error_code");
    const errorDescription = searchParams.get("error_description")|| hashParams.get("error_description");

    if (error || errorDescription) {
      setOauthError({ error, code: errorCode, description: errorDescription });
    }
  }, []);

  const clearOauthError = () => {
    setOauthError(null);
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    setErrorMsg(null);
    setNoticeMsg(null);
    const res = await signInWithOtp(email);
    setIsLoading(false);
    if (res.success) {
      setStep("code");
      setNoticeMsg(`A 6-digit code was sent to ${email}. Check your inbox.`);
    } else {
      setErrorMsg(res.error || "Could not send OTP. Please try again.");
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setIsLoading(true);
    setErrorMsg(null);
    const res = await verifyOtp(email, code, false);
    setIsLoading(false);
    if (!res.success) {
      setErrorMsg(res.error || "Incorrect verification code. Please check and retry.");
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    const res = await signInWithGoogle();
    setIsLoading(false);
    if (!res.success) setErrorMsg(res.error || "Google Sign-in failed.");
  };

  const handleTriggerQuickDemo = () => {
    const cleanEmail   = email.trim() || "guest.investor@example.com";
    const userPrefix   = cleanEmail.split("@")[0];
    const capitalized  = userPrefix.charAt(0).toUpperCase() + userPrefix.slice(1);
    triggerDemoSession(cleanEmail, `${capitalized} (Sandbox Guest)`);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 antialiased"
      style={{ backgroundColor: "var(--color-bg-base)" }}
    >
      <div className="w-full max-w-md space-y-6">

        {/* ── Brand heading ── */}
        <div className="text-center space-y-2">
          <div
            className="mx-auto h-12 w-12 flex items-center justify-center rounded-2xl"
            style={{
              backgroundColor: "var(--color-brand-600)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <h1
            className="text-2xl font-extrabold tracking-tight font-display"
            style={{ color: "var(--color-text-primary)" }}
          >
            AI Finance Assistant
          </h1>
          <p
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            Real-Time Portfolio & Subscription Architect
          </p>
        </div>

        {/* ── Supabase not-configured notice ── */}
        {!isConfigured && (
          <div
            className="p-4 rounded-2xl flex gap-3 text-xs border"
            style={{
              backgroundColor: "var(--color-warning-bg)",
              borderColor: "var(--color-warning-border)",
              color: "var(--color-warning-text)",
            }}
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--color-warning-icon)" }} />
            <div className="space-y-1.5">
              <span className="font-bold block">Developer Notice: Supabase Keys Required</span>
              <p className="leading-relaxed text-[11px] font-sans">
                Fill in{" "}
                <code className="px-1 py-0.5 rounded font-bold font-mono"
                      style={{ backgroundColor: "var(--color-warning-border)", color: "var(--color-warning-text)" }}>
                  VITE_SUPABASE_URL
                </code>{" "}
                and{" "}
                <code className="px-1 py-0.5 rounded font-bold font-mono"
                      style={{ backgroundColor: "var(--color-warning-border)", color: "var(--color-warning-text)" }}>
                  VITE_SUPABASE_ANON_KEY
                </code>{" "}
                in <strong>Settings › Secrets</strong> to link your database.
              </p>
              <button
                type="button"
                onClick={handleTriggerQuickDemo}
                className="text-white font-bold text-[10px] px-3 py-1.5 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors"
                style={{ backgroundColor: "var(--color-warning-icon)" }}
              >
                <Sparkles className="w-3.5 h-3.5" /> Launch Sandbox Demo
              </button>
            </div>
          </div>
        )}

        {/* ── Main auth card ── */}
        <div
          className="rounded-3xl p-8 space-y-6"
          style={{
            backgroundColor: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-medium)",
            boxShadow: "var(--shadow-xl)",
          }}
        >
          <div className="space-y-1">
            <h2 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
              {step === "email" ? "Sign In or Create Account" : "Verify Your Code"}
            </h2>
            <p className="text-xs leading-relaxed font-sans" style={{ color: "var(--color-text-muted)" }}>
              {step === "email"
                ? "Enter your email address to receive a one-time login code — no password needed."
                : "Enter the 6-digit code sent to your email inbox."}
            </p>
          </div>

          {/* Demo mode OTP bypass hint */}
          {step === "code" && !isConfigured && (
            <div
              className="rounded-xl p-3.5 space-y-2 text-xs font-sans border"
              style={{
                backgroundColor: "var(--color-warning-bg)",
                borderColor: "var(--color-warning-border)",
                color: "var(--color-warning-text)",
              }}
            >
              <div className="flex gap-2 font-bold items-center">
                <Sparkles className="w-4 h-4 shrink-0" style={{ color: "var(--color-warning-icon)" }} />
                <span>Demo Sandbox Active</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                No email was sent (Supabase not configured). Type any 6 digits or click below:
              </p>
              <button
                type="button"
                onClick={() => {
                  setCode("123456");
                  triggerDemoSession(email || "sandbox.user@example.com",
                    (email || "sandbox.user").split("@")[0] + " (Sandbox)");
                }}
                className="font-bold hover:underline inline-flex items-center gap-1 mt-1 text-[11px] cursor-pointer"
                style={{ color: "var(--color-brand-600)" }}
              >
                ⚡ Auto-Verify & Enter Dashboard
              </button>
            </div>
          )}

          {/* Error banner */}
          {errorMsg && (
            <div
              className="rounded-xl p-3.5 text-xs font-semibold leading-relaxed border"
              style={{
                backgroundColor: "var(--color-danger-bg)",
                borderColor: "var(--color-danger-border)",
                color: "var(--color-danger-text)",
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* OAuth error panel */}
          {oauthError && (
            <div
              className="rounded-2xl p-5 space-y-3.5 text-xs font-sans border"
              style={{
                backgroundColor: "var(--color-danger-bg)",
                borderColor: "var(--color-danger-border)",
                color: "var(--color-text-secondary)",
              }}
            >
              <div className="flex gap-2.5 items-start">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--color-danger-icon)" }} />
                <div className="space-y-1">
                  <h3 className="font-bold" style={{ color: "var(--color-danger-text)" }}>
                    Google OAuth Failed
                  </h3>
                  <div
                    className="text-[11px] px-2.5 py-1.5 rounded-lg font-mono break-all leading-normal"
                    style={{
                      backgroundColor: "var(--color-danger-border)",
                      color: "var(--color-danger-text)",
                    }}
                  >
                    {oauthError.description || oauthError.error || "unexpected_failure"}
                  </div>
                </div>
              </div>
              <div
                className="pt-2.5 border-t space-y-2.5"
                style={{ borderColor: "var(--color-danger-border)" }}
              >
                <p className="font-bold text-[11px] leading-relaxed" style={{ color: "var(--color-text-primary)" }}>
                  Common fixes:
                </p>
                <ol
                  className="space-y-1.5 list-decimal pl-4 text-[11px] leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <li>In Google Cloud Console, choose <strong>Web application</strong> (not Desktop/iOS).</li>
                  <li>Copy the Client Secret into <strong>Supabase › Auth › Providers › Google</strong>.</li>
                  <li>Add your Supabase callback URL to <strong>Authorized redirect URIs</strong>.</li>
                  <li>If OAuth consent screen is in Testing mode, add your email as a Test User.</li>
                </ol>
              </div>
              <div className="flex gap-2 pt-2 border-t" style={{ borderColor: "var(--color-danger-border)" }}>
                <button
                  type="button"
                  onClick={clearOauthError}
                  className="text-white font-bold text-[11px] px-3.5 py-2 rounded-xl cursor-pointer flex-1 transition-colors"
                  style={{ backgroundColor: "var(--color-danger-icon)" }}
                >
                  Dismiss Error
                </button>
                <a
                  href="https://supabase.com/docs/guides/auth/social-login/auth-google"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-[11px] px-3.5 py-2 rounded-xl inline-flex items-center justify-center gap-1 transition-colors border"
                  style={{
                    backgroundColor: "var(--color-bg-subtle)",
                    borderColor: "var(--color-border-medium)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  Setup Guide
                </a>
              </div>
            </div>
          )}

          {/* Notice banner */}
          {noticeMsg && (
            <div
              className="rounded-xl p-3.5 text-xs font-medium leading-relaxed border"
              style={{
                backgroundColor: "var(--color-brand-50)",
                borderColor: "var(--color-brand-100)",
                color: "var(--color-brand-600)",
              }}
            >
              {noticeMsg}
            </div>
          )}

          {/* ── Email form ── */}
          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  className="text-[10px] font-bold uppercase tracking-wider block"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail
                    className="absolute left-3.5 w-4 h-4 pointer-events-none"
                    style={{ color: "var(--color-text-disabled)" }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="brutal-input pl-10"
                    style={{ fontSize: "0.75rem" }}
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                style={{ backgroundColor: "var(--color-brand-600)", boxShadow: "var(--shadow-sm)" }}
              >
                {isLoading ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Sending Code...</>
                ) : (
                  <><LogIn className="w-4 h-4" /> Request Secure OTP</>
                )}
              </button>
            </form>
          ) : (
            /* ── OTP verify form ── */
            <div className="space-y-4">
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    className="text-[10px] font-bold uppercase tracking-wider block"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    6-Digit Verification Code
                  </label>
                  <div className="relative flex items-center">
                    <KeyRound
                      className="absolute left-3.5 w-4 h-4 pointer-events-none"
                      style={{ color: "var(--color-text-disabled)" }}
                    />
                    <input
                      type="text"
                      maxLength={6}
                      pattern="[0-9]*"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="brutal-input pl-10 text-center tracking-widest font-mono font-bold"
                      style={{ fontSize: "0.875rem" }}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="w-full font-bold text-xs py-3 rounded-xl cursor-pointer transition-colors border"
                    style={{
                      backgroundColor: "var(--color-bg-subtle)",
                      borderColor: "var(--color-border-medium)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    Edit Email
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "var(--color-brand-600)" }}
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Verify Code"}
                  </button>
                </div>
              </form>

              {/* Magic link hint */}
              <div
                className="rounded-2xl p-4 space-y-2.5 text-xs font-sans border"
                style={{
                  backgroundColor: "var(--color-bg-subtle)",
                  borderColor: "var(--color-border-subtle)",
                }}
              >
                <div
                  className="font-bold flex items-center gap-2"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  <Mail className="w-4 h-4 shrink-0" style={{ color: "var(--color-brand-600)" }} />
                  Got a login link instead of a code?
                </div>
                <p
                  className="leading-relaxed text-[11px]"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Just <strong>click the link</strong> in your email — it will authenticate and redirect you instantly.
                </p>
              </div>
            </div>
          )}

          {/* ── Divider ── */}
          <div className="relative py-2.5">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t" style={{ borderColor: "var(--color-border-subtle)" }} />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span
                className="px-3 text-[10px] font-bold tracking-wider"
                style={{
                  backgroundColor: "var(--color-bg-surface)",
                  color: "var(--color-text-disabled)",
                }}
              >
                Or continue with
              </span>
            </div>
          </div>

          {/* ── Google OAuth button ── */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2.5 cursor-pointer transition-colors border"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              borderColor: "var(--color-border-medium)",
              color: "var(--color-text-secondary)",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </button>

          {/* ── Sandbox quick-access ── */}
          {!isConfigured && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleTriggerQuickDemo}
                className="text-[10px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1 justify-center"
                style={{ color: "var(--color-text-muted)" }}
              >
                <Laptop className="w-3 h-3" /> Continue in Sandbox Mode
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}