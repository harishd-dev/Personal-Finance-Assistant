import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Wallet, KeyRound, Mail, Sparkles, LogIn, RefreshCw, AlertCircle, Laptop } from "lucide-react";

export default function AuthPage() {
  const { 
    signInWithOtp, 
    verifyOtp, 
    signInWithGoogle, 
    triggerDemoSession,
    isConfigured 
  } = useAuth();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<{
    error: string | null;
    code: string | null;
    description: string | null;
  } | null>(null);

  useEffect(() => {
    const parseUrlParams = () => {
      const searchParams = new URLSearchParams(window.location.search);
      
      // Look inside hash (e.g. #error=... or #error_description=...)
      let hash = window.location.hash;
      if (hash.startsWith("#")) {
        hash = hash.substring(1);
      }
      const hashParams = new URLSearchParams(hash);

      const error = searchParams.get("error") || hashParams.get("error");
      const errorCode = searchParams.get("error_code") || hashParams.get("error_code");
      const errorDescription = searchParams.get("error_description") || hashParams.get("error_description");

      if (error || errorDescription) {
        setOauthError({
          error,
          code: errorCode,
          description: errorDescription,
        });
      }
    };

    parseUrlParams();
  }, []);

  const clearOauthError = () => {
    setOauthError(null);
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
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
      setNoticeMsg(`A 6-digit verification code has been dispatched to ${email}. Check your inbox!`);
    } else {
      setErrorMsg(res.error || "Could not send OTP code. Please retry.");
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
    if (!res.success) {
      setErrorMsg(res.error || "Failed to trigger Google Sign-in.");
    }
  };

  const handleTriggerQuickDemo = () => {
    const cleanEmail = email.trim() || "guest.investor@example.com";
    const userPrefix = cleanEmail.split("@")[0];
    const capitalized = userPrefix.charAt(0).toUpperCase() + userPrefix.slice(1);
    triggerDemoSession(cleanEmail, `${capitalized} (Sandbox Guest)`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 antialiased selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-md space-y-6">
        
        {/* Logo and Brand Heading */}
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 bg-indigo-650 text-white flex items-center justify-center rounded-2xl shadow-md border border-indigo-500/20">
            <Wallet className="w-6 h-6 text-indigo-50" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">AI Finance Assistant</h1>
          <p className="text-xs text-slate-400 font-medium">REAL-TIME PORTFOLIO & SUBSCRIPTION ARCHITECT</p>
        </div>

        {/* Configuration Notice for developers in sandbox */}
        {!isConfigured && (
          <div className="bg-amber-50 border border-amber-200/60 p-4 rounded-2xl flex gap-3 text-xs text-amber-800">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <span className="font-bold block">Developer Notice: Supabase Keys Required</span>
              <p className="leading-relaxed text-[11px] font-sans">
                You are running in sandbox preview. Fill in <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-bold font-mono">VITE_SUPABASE_URL</code> and <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-bold font-mono">VITE_SUPABASE_ANON_KEY</code> in the **Settings &gt; Secrets** of AI Studio to link your real PostgreSQL instance.
              </p>
              <button
                type="button"
                onClick={handleTriggerQuickDemo}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" /> Launch Guest Simulator
              </button>
            </div>
          </div>
        )}

        {/* Primary Auth Card */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-8 space-y-6">
          
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-800">
              {step === "email" ? "Unify Your Financial Ledger" : "Verify Authentication OTP"}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              {step === "email" 
                ? "Enter your email to login or sign up instantly without password hurdles." 
                : "Enter the OTP token containing 6 digits sent to your designated email inbox."
              }
            </p>
          </div>

          {step === "code" && !isConfigured && (
            <div className="bg-amber-50 border border-amber-200/50 rounded-xl p-3.5 space-y-2 text-amber-900 text-xs font-sans leading-relaxed">
              <div className="flex gap-2 font-bold items-center text-amber-800">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Demo Sandbox Simulator Active</span>
              </div>
              <p className="text-[11px] text-amber-800/80">
                Since your Supabase configuration keys are not inputted yet, no email can be sent. Simply type <strong>any 6 digits</strong> (like 123456) or click the express log-in link below.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCode("123456");
                  triggerDemoSession(email || "sandbox.user@example.com", (email || "sandbox.user").split("@")[0] + " (Sandbox)");
                }}
                className="text-indigo-650 hover:text-indigo-700 font-bold hover:underline inline-flex items-center gap-1 mt-1 text-[11px] cursor-pointer"
              >
                ⚡ Express Auto-Verify & Log In
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-100 text-rose-800 rounded-xl p-3.5 text-xs font-semibold leading-relaxed">
              {errorMsg}
            </div>
          )}

          {oauthError && (
            <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5 space-y-3.5 text-xs font-sans animate-fade-in text-slate-700">
              <div className="flex gap-2.5 items-start">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-bold text-rose-950">Google OAuth Authorization Failed</h3>
                  <div className="text-[11px] text-rose-900 bg-rose-100/65 px-2.5 py-1.5 rounded-lg font-mono break-all leading-normal">
                    {oauthError.description || oauthError.error || "unexpected_failure (Unable to exchange external code)"}
                  </div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-rose-150 space-y-2.5">
                <p className="font-bold text-slate-800 text-[11px] leading-relaxed">
                  💡 This "Unable to exchange external code: 4/0A..." error means Google's token validator rejected Supabase's signature checklist. Let's fix this in 60 seconds:
                </p>

                <ol className="space-y-2.5 list-decimal pl-4 text-[11px] text-slate-600 leading-relaxed">
                  <li>
                    <strong>Select "Web application" in Google:</strong> When creating credentials in Google Cloud Console, you <strong>MUST</strong> choose <strong className="text-indigo-750">"Web application"</strong> as the Application Type. If you mistakenly selected "Desktop application", "Android", or "iOS", Google will not generate or show a Client Secret!
                  </li>
                  <li>
                    <strong>Check Google Client Secret in Supabase:</strong> Open your <strong>Google Cloud Console &gt; Credentials</strong>, copy the client secret generated for your Web client, and paste it into <strong>Supabase Dashboard &gt; Authentication &gt; Providers &gt; Google</strong>.
                  </li>
                  <li>
                    <strong>Match Client ID Exactly:</strong> Confirm that the saved Client ID inside your Supabase dashboard matches the client ID inside the Google console exactly.
                  </li>
                  <li>
                    <strong>Add the Callback URL to Google Console:</strong> copy the callback URI from Supabase (e.g., <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold">https://&lt;project-id&gt;.supabase.co/auth/v1/callback</code>) and paste it into <strong>Authorized redirect URIs</strong> in the Google Cloud Console credential settings.
                  </li>
                  <li>
                    <strong>Register User in OAuth Consent Settings:</strong> If your OAuth App is configured in "Testing" mode, you must register your personal Google account email as a <strong>Test User</strong> under the <strong>OAuth Consent Screen</strong> page inside the Google Cloud Console.
                  </li>
                </ol>
              </div>

              <div className="flex gap-2 pt-2 border-t border-rose-150">
                <button
                  type="button"
                  onClick={clearOauthError}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] px-3.5 py-2 rounded-xl text-center flex-1 cursor-pointer transition-colors"
                >
                  Dismiss & Clear Error
                </button>
                <a
                  href="https://supabase.com/docs/guides/auth/social-login/auth-google"
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] px-3.5 py-2 rounded-xl text-center inline-flex items-center justify-center gap-1 transition-colors"
                >
                  View Setup Guide
                </a>
              </div>
            </div>
          )}

          {noticeMsg && (
            <div className="bg-indigo-50 border border-indigo-100 text-indigo-850 rounded-xl p-3.5 text-xs font-medium leading-relaxed">
              {noticeMsg}
            </div>
          )}

          {step === "email" ? (
            /* Part 1: Email Form */
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white text-slate-800 text-xs px-10 py-3.5 rounded-xl font-medium outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-indigo-650/10 transition-colors"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sending Login Code...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Request Secure OTP
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Part 2: Enter Verification Code */
            <div className="space-y-4">
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">6-Digit Verification Token</label>
                  <div className="relative flex items-center">
                    <KeyRound className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      maxLength={6}
                      pattern="[0-9]*"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white text-slate-800 font-mono text-center tracking-widest text-sm py-3.5 pl-10 pr-4 rounded-xl font-bold outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="w-full bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-650 font-bold text-xs py-3 rounded-xl cursor-pointer transition-colors"
                  >
                    Edit Email
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      "Verify Code"
                    )}
                  </button>
                </div>
              </form>

              {/* Helpful section explaining how magic links and OTPs are toggled in Supabase */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5 text-slate-600 dark:text-slate-300 text-xs font-sans mt-3">
                <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Got a Login Link instead of an OTP?</span>
                </div>
                <p className="leading-relaxed text-[11px] text-slate-500 dark:text-slate-400">
                  Simply **click the login link** inside the email you received! It will securely authenticate you and redirect you straight back to this exact window instantly.
                </p>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                  💡 <strong>To use 6-digit number OTPs:</strong> Go to your <strong>Supabase Dashboard &gt; Authentication &gt; Providers &gt; Email</strong> and ensure <em>"Secure email change"</em> or custom templates are customized, or ensure the OTP flow is preferred.
                </div>
              </div>
            </div>
          )}

          {/* OAuth Google Sign-in */}
          <div className="relative py-2.5">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-[10px] font-bold text-slate-400 tracking-wider">Alternative SignIn</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2.5 cursor-pointer shadow-3xs transition-colors"
          >
            <svg className="w-4 h-4 text-slate-650" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            Sign In with Google
          </button>

          {/* Sandbox warning helper */}
          {!isConfigured && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleTriggerQuickDemo}
                className="text-[10px] text-slate-400 hover:text-indigo-650 font-bold transition-colors cursor-pointer inline-flex items-center gap-1 justify-center leading-none"
              >
                <Laptop className="w-3 h-3" /> Quick Test App in Demo Sandbox Mode
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
