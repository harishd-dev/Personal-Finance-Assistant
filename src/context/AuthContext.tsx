import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../services/supabase";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  auth_provider: string;
  theme_preference: "light" | "dark";
  created_at?: string;
  last_login?: string;
}

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isConfigured: boolean;
  demoModeActive: boolean;
  signInWithOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (email: string, code: string, isSignUp: boolean) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateThemePreference: (theme: "light" | "dark") => Promise<void>;
  updateProfileDetails: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  triggerDemoSession: (email: string, name?: string) => void;
}

export function getThemeFromPreference(pref: string | null | undefined): "light" | "dark" {
  if (!pref) return "light";
  if (pref === "light" || pref === "dark") return pref;
  try {
    const parsed = JSON.parse(pref);
    if (parsed && typeof parsed === "object") {
      return parsed.theme === "dark" || parsed.theme_preference === "dark" ? "dark" : "light";
    }
  } catch (e) {}
  return "light";
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // BUG #2 FIX: Start isLoading as true so the app waits for session check before rendering
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [demoModeActive, setDemoModeActive] = useState<boolean>(false);

  // Apply theme class to <html>
  const applyThemeClass = useCallback((theme: "light" | "dark") => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, []);

  // Sync theme from profile or localStorage
  useEffect(() => {
    if (profile?.theme_preference) {
      const themeValue = getThemeFromPreference(profile.theme_preference);
      applyThemeClass(themeValue);
      localStorage.setItem("theme_pref", themeValue);
    } else {
      const savedTheme = localStorage.getItem("theme_pref") as "light" | "dark";
      applyThemeClass(savedTheme || "light");
    }
  }, [profile, applyThemeClass]);

  // ----------------------------------------------------------------
  // BUG #2 FIX: Extracted fetchProfile into a stable, reusable function.
  // Previously this was an inline function that could lose closure context
  // when called from the auth state change listener.
  // ----------------------------------------------------------------
  const fetchProfile = useCallback(async (userId: string, email: string): Promise<void> => {
    // Provide a reliable fallback immediately so the UI never hangs
    const fallbackProfile: UserProfile = {
      id: userId,
      email: email,
      full_name: email.split("@")[0],
      avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
      auth_provider: "email",
      theme_preference: "light",
    };
    setProfile(fallbackProfile);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // Profile row doesn't exist yet — insert one
          const newProfile: UserProfile = { ...fallbackProfile };
          try {
            await (supabase as any).from("profiles").insert(newProfile as any);
          } catch (insertErr) {
            console.error("Could not insert profile, using fallback:", insertErr);
          }
          setProfile(newProfile);
        } else {
          // Other DB error — keep fallback, log it
          console.error("Profile fetch error (keeping fallback):", error);
        }
      } else if (data) {
        setProfile({
          id: data.id,
          email: data.email,
          full_name: data.full_name || data.email.split("@")[0],
          avatar_url: data.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(data.email)}`,
          auth_provider: data.auth_provider || "email",
          theme_preference: (data.theme_preference || "light") as "light" | "dark",
        });
      }
    } catch (err) {
      console.error("Profile sync error (keeping fallback):", err);
    }
  }, []);

  // ----------------------------------------------------------------
  // BUG #2 ROOT FIX: The original code had a race condition where:
  //   1. onAuthStateChange fired BEFORE getSession() resolved
  //   2. The listener set user=null when session was actually valid
  //   3. This caused the app to show AuthPage and then immediately
  //      redirect, losing any attempt to fetch user data
  //
  // Fix: Use a single initialization flow with proper ordering:
  //   1. Handle OAuth redirect tokens from URL hash first
  //   2. Call getSession() to check for existing session
  //   3. Set up onAuthStateChange AFTER initial session is known
  //   4. The listener only handles SUBSEQUENT changes (sign in/out)
  // ----------------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    // Safety timeout — never leave the user on a loading screen forever
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        console.warn("Auth safety timer fired — forcing isLoading=false");
        setIsLoading(false);
      }
    }, 8000);

    const initializeAuth = async () => {
      // --- Step 1: Handle demo mode (no Supabase keys) ---
      if (!isSupabaseConfigured || !supabase) {
        try {
          const cachedDemoUser = localStorage.getItem("PFA_DEMO_USER");
          if (cachedDemoUser) {
            const parsed = JSON.parse(cachedDemoUser);
            if (mounted) {
              setUser(parsed.user);
              setProfile(parsed.profile);
              setDemoModeActive(true);
            }
          }
        } catch (err) {
          console.error("Failed to parse cached demo user:", err);
          localStorage.removeItem("PFA_DEMO_USER");
        }
        if (mounted) setIsLoading(false);
        clearTimeout(safetyTimer);
        return;
      }

      // --- Step 2: Handle OAuth redirect tokens embedded in URL ---
      // Supabase puts access_token in the URL hash after OAuth redirect.
      // We must call setSession() before getSession() to capture it.
      try {
        let hash = window.location.hash || "";
        if (hash.startsWith("#")) hash = hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        const searchParams = new URLSearchParams(window.location.search);

        const access_token = hashParams.get("access_token") || searchParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token") || searchParams.get("refresh_token") || "";

        if (access_token) {
          console.log("OAuth redirect detected — establishing session from URL tokens...");
          const { error: setSessionErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (setSessionErr) {
            console.error("Failed to establish session from URL tokens:", setSessionErr);
          } else {
            // Clean up the URL so tokens aren't re-used on refresh
            try {
              const url = new URL(window.location.href);
              url.hash = "";
              ["access_token","refresh_token","expires_in","token_type","type"].forEach(
                (p) => url.searchParams.delete(p)
              );
              window.history.replaceState({}, document.title, url.pathname + url.search);
            } catch (e) { /* ignore history API errors */ }
          }
        }
      } catch (urlErr) {
        console.error("Error processing redirect URL:", urlErr);
      }

      // --- Step 3: Get current session (includes newly set session from step 2) ---
      try {
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();

        if (sessionErr) {
          console.error("getSession error:", sessionErr);
        }

        if (session && session.user && mounted) {
          // BUG #2 FIX: We found a valid session — set user state and fetch their data
          setUser(session.user);
          setDemoModeActive(false);
          await fetchProfile(session.user.id, session.user.email || "");
          // Clear any stale demo user that might override real session data
          localStorage.removeItem("PFA_DEMO_USER");
        } else if (mounted) {
          // No Supabase session — check if there's a demo session cached
          const cachedDemoUser = localStorage.getItem("PFA_DEMO_USER");
          if (cachedDemoUser) {
            try {
              const parsed = JSON.parse(cachedDemoUser);
              setUser(parsed.user);
              setProfile(parsed.profile);
              setDemoModeActive(true);
            } catch (err) {
              localStorage.removeItem("PFA_DEMO_USER");
            }
          }
          // If no session and no demo: user stays null → AuthPage renders
        }
      } catch (err) {
        console.error("Session initialization error:", err);
      } finally {
        if (mounted) setIsLoading(false);
        clearTimeout(safetyTimer);
      }

      // --- Step 4: Set up auth state change listener for SUBSEQUENT changes ---
      // BUG #2 FIX: This listener now only handles changes that happen AFTER
      // initial load (sign-in from AuthPage, token refresh, sign-out).
      // It does NOT handle the initial session — that's done above in step 3.
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!mounted) return;

          console.log("Auth state change:", event);

          if (event === "SIGNED_IN" && session?.user) {
            // User just signed in via OTP, Google, etc.
            setUser(session.user);
            setDemoModeActive(false);
            await fetchProfile(session.user.id, session.user.email || "");
            localStorage.removeItem("PFA_DEMO_USER");
            // isLoading should already be false here; ensure it stays false
            setIsLoading(false);
          } else if (event === "TOKEN_REFRESHED" && session?.user) {
            // Session token was refreshed — update user reference but
            // don't re-fetch profile (it hasn't changed)
            setUser(session.user);
          } else if (event === "SIGNED_OUT") {
            // Only clear if not in demo mode
            const cachedDemoUser = localStorage.getItem("PFA_DEMO_USER");
            if (!cachedDemoUser) {
              setUser(null);
              setProfile(null);
              setDemoModeActive(!isSupabaseConfigured);
            }
          }
          // Ignore USER_UPDATED — profile re-fetch is handled explicitly
        }
      );

      // Return cleanup function
      return () => subscription?.unsubscribe();
    };

    let cleanupFn: (() => void) | undefined;
    initializeAuth().then((cleanup) => {
      cleanupFn = cleanup;
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      cleanupFn?.();
    };
  }, [fetchProfile]);

  // ----------------------------------------------------------------
  // AUTH METHODS
  // ----------------------------------------------------------------

  const signInWithOtp = async (email: string) => {
    if (!isSupabaseConfigured || !supabase) {
      // Demo mode — pretend OTP was sent
      return { success: true };
    }
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const verifyOtp = async (email: string, code: string, isSignUp: boolean) => {
    if (!isSupabaseConfigured || !supabase) {
      // Demo mode — accept any 6-digit code
      triggerDemoSession(email);
      return { success: true };
    }
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: isSignUp ? "signup" : "email",
      });
      if (error) {
        // Retry with generic 'email' type
        const retryResult = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
        if (retryResult.error) throw retryResult.error;
        if (retryResult.data?.session) {
          setUser(retryResult.data.session.user);
          setDemoModeActive(false);
          await fetchProfile(retryResult.data.session.user.id, retryResult.data.session.user.email || "");
          localStorage.removeItem("PFA_DEMO_USER");
        }
        return { success: true };
      }
      if (data?.session) {
        setUser(data.session.user);
        setDemoModeActive(false);
        await fetchProfile(data.session.user.id, data.session.user.email || "");
        localStorage.removeItem("PFA_DEMO_USER");
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const signInWithGoogle = async () => {
    if (!supabase) {
      return {
        success: false,
        error: "Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Settings > Secrets.",
      };
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const signOut = async () => {
    // 1. Immediately clear local state for instant UI feedback
    setUser(null);
    setProfile(null);
    setDemoModeActive(!isSupabaseConfigured);

    // 2. Clear all local storage keys
    try {
      ["PFA_DEMO_USER","PFA_TRANSACTIONS","PFA_BILLS","PFA_SUGGESTIONS","PFA_INCOME","PFA_ALERTS"].forEach(
        (key) => localStorage.removeItem(key)
      );
      // Clear Supabase auth keys
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("sb-") || key.includes("supabase")) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn("Local storage clear error:", e);
    }

    // 3. Remote sign-out in the background (non-blocking)
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut().catch((err) =>
        console.warn("Background sign-out warning:", err)
      );
    }
  };

  const updateThemePreference = async (newTheme: "light" | "dark") => {
    localStorage.setItem("theme_pref", newTheme);
    applyThemeClass(newTheme);

    if (!profile) return;

    let nextThemePreference: string = newTheme;
    try {
      if (profile.theme_preference !== "light" && profile.theme_preference !== "dark") {
        const parsed = JSON.parse(profile.theme_preference as string);
        if (parsed && typeof parsed === "object") {
          parsed.theme = newTheme;
          parsed.theme_preference = newTheme;
          nextThemePreference = JSON.stringify(parsed);
        }
      }
    } catch (e) {}

    const updatedProfile = { ...profile, theme_preference: nextThemePreference as any };
    setProfile(updatedProfile);

    if (isSupabaseConfigured && supabase && user) {
      try {
        await (supabase as any)
          .from("profiles")
          .update({ theme_preference: nextThemePreference } as any)
          .eq("id", user.id);
      } catch (err) {
        console.error("Theme preference DB sync error:", err);
      }
    } else if (demoModeActive) {
      localStorage.setItem("PFA_DEMO_USER", JSON.stringify({ user, profile: updatedProfile }));
    }
  };

  const updateProfileDetails = async (updates: Partial<UserProfile>) => {
    if (!profile) return { success: false, error: "No active profile session" };

    const updated = { ...profile, ...updates };
    setProfile(updated);

    if (isSupabaseConfigured && supabase && user) {
      try {
        const { error } = await (supabase as any)
          .from("profiles")
          .update(updates as any)
          .eq("id", user.id);
        if (error) throw error;
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    } else {
      localStorage.setItem("PFA_DEMO_USER", JSON.stringify({ user, profile: updated }));
      return { success: true };
    }
  };

  const triggerDemoSession = (email: string, name?: string) => {
    const mockUser = {
      id: "demo-user-123456",
      email,
      user_metadata: { full_name: name || email.split("@")[0] },
    };
    const mockProfile: UserProfile = {
      id: "demo-user-123456",
      email,
      full_name: name || email.split("@")[0],
      avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
      auth_provider: name ? "google" : "email",
      theme_preference: "light",
    };
    setUser(mockUser);
    setProfile(mockProfile);
    setDemoModeActive(true);
    localStorage.setItem("PFA_DEMO_USER", JSON.stringify({ user: mockUser, profile: mockProfile }));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isConfigured: isSupabaseConfigured,
        demoModeActive,
        signInWithOtp,
        verifyOtp,
        signInWithGoogle,
        signOut,
        updateThemePreference,
        updateProfileDetails,
        triggerDemoSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}