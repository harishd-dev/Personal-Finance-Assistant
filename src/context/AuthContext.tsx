import React, { createContext, useContext, useState, useEffect } from "react";
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [demoModeActive, setDemoModeActive] = useState<boolean>(!isSupabaseConfigured);

  // Read theme preference from database, localStorage or defaults
  useEffect(() => {
    if (profile?.theme_preference) {
      const themeValue = getThemeFromPreference(profile.theme_preference);
      applyThemeClass(themeValue);
      localStorage.setItem("theme_pref", themeValue);
    } else {
      const savedTheme = localStorage.getItem("theme_pref") as "light" | "dark";
      applyThemeClass(savedTheme || "light");
    }
  }, [profile]);

  const applyThemeClass = (theme: "light" | "dark") => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  // Helper to sync or construct a profile record
  const fetchProfile = async (userId: string, email: string) => {
    // 1. Immediately provision a highly reliable fallback profile
    // so that the UI can render instantly and never get stuck or hide the logout options.
    const fallbackProfile: UserProfile = {
      id: userId,
      email: email,
      full_name: email.split("@")[0],
      avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
      auth_provider: "email",
      theme_preference: "light"
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
          // Profile doesn't exist yet, insert one
          const newProfile: UserProfile = {
            id: userId,
            email: email,
            full_name: email.split("@")[0],
            avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
            auth_provider: "email",
            theme_preference: "light"
          };
          try {
            await (supabase as any).from("profiles").insert(newProfile as any);
          } catch (insertErr) {
            console.error("Could not insert profile in DB, continuing with local fallback:", insertErr);
          }
          setProfile(newProfile);
        } else {
          console.error("Error reading profile database (using fallback):", error);
        }
      } else if (data) {
        setProfile({
          id: data.id,
          email: data.email,
          full_name: data.full_name || data.email.split("@")[0],
          avatar_url: data.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(data.email)}`,
          auth_provider: data.auth_provider || "email",
          theme_preference: (data.theme_preference || "light") as "light" | "dark"
        });
      }
    } catch (err) {
      console.error("Profile sync failure (retained local fallback):", err);
    }
  };

  // Check existing session
  useEffect(() => {
    // Fail-safe safety timer: Force hide loading spinner after 6 seconds to prevent any frozen states!
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 6000);

    if (!isSupabaseConfigured || !supabase) {
      // Setup mock persistence if in Demo Mode
      try {
        const cachedDemoUser = localStorage.getItem("PFA_DEMO_USER");
        if (cachedDemoUser) {
          const parsed = JSON.parse(cachedDemoUser);
          setUser(parsed.user);
          setProfile(parsed.profile);
          setDemoModeActive(true);
        }
      } catch (err) {
        console.error("Failed to parse cached demo user", err);
        localStorage.removeItem("PFA_DEMO_USER");
      }
      setIsLoading(false);
      clearTimeout(safetyTimer);
      return;
    }

    // Supabase standard session check
    const initAuth = async () => {
      try {
        // Manually parse hash or search parameters from the URL in case of redirect/iframe storage restrictions
        let hash = window.location.hash || "";
        if (hash.startsWith("#")) {
          hash = hash.substring(1);
        }
        const hashParams = new URLSearchParams(hash);
        const searchParams = new URLSearchParams(window.location.search);
        
        const access_token = hashParams.get("access_token") || searchParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token") || searchParams.get("refresh_token") || "";

        if (access_token) {
          console.log("Detected access token in redirect URL. Establishing session manually...");
          const { data: setSessionData, error: setSessionErr } = await supabase.auth.setSession({
            access_token,
            refresh_token
          });
          if (setSessionErr) {
            console.error("Manual URL session establishment error:", setSessionErr);
          } else if (setSessionData && setSessionData.session) {
            console.log("Success! Session established from URL tokens.");
            // Clean hash info and queries from address bar so that refreshing doesn't loop or reuse expired tokens
            try {
              const url = new URL(window.location.href);
              url.hash = "";
              url.searchParams.delete("access_token");
              url.searchParams.delete("refresh_token");
              url.searchParams.delete("expires_in");
              url.searchParams.delete("token_type");
              url.searchParams.delete("type");
              window.history.replaceState({}, document.title, url.pathname + url.search);
            } catch (historyErr) {
              console.warn("Could not clean address bar hash/params:", historyErr);
            }
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          setDemoModeActive(false);
          await fetchProfile(session.user.id, session.user.email || "");
        } else {
          // If no supabase session, fallback to local storage for demo
          const cachedDemoUser = localStorage.getItem("PFA_DEMO_USER");
          if (cachedDemoUser) {
            try {
              const parsed = JSON.parse(cachedDemoUser);
              setUser(parsed.user);
              setProfile(parsed.profile);
              setDemoModeActive(true);
            } catch (err) {
              console.error("Malformed cached demo user JSON", err);
              localStorage.removeItem("PFA_DEMO_USER");
            }
          }
        }
      } catch (err) {
        console.error("Error loading auth session:", err);
      } finally {
        setIsLoading(false);
        clearTimeout(safetyTimer);
      }
    };

    initAuth();

    // Setup listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user);
        setDemoModeActive(false);
        await fetchProfile(session.user.id, session.user.email || "");
        // Clear demo user to prefer the real Supabase authenticated user
        localStorage.removeItem("PFA_DEMO_USER");
      } else {
        // Only clear if we didn't deliberately activate simulation mode
        try {
          const cachedDemoUser = localStorage.getItem("PFA_DEMO_USER");
          if (!cachedDemoUser) {
            setUser(null);
            setProfile(null);
          }
        } catch (err) {
          setUser(null);
          setProfile(null);
        }
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription?.unsubscribe();
    };
  }, []);

  // OTP Login step 1: Request OTP
  const signInWithOtp = async (email: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return { success: true }; // Dummy success to trigger Otp Token screen in Demo mode
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin
        }
      });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // OTP Login step 2: Verify code
  const verifyOtp = async (email: string, code: string, isSignUp: boolean) => {
    if (!isSupabaseConfigured || !supabase) {
      // Simulate Demo session creation
      triggerDemoSession(email);
      return { success: true };
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: isSignUp ? "signup" : "email"
      });

      if (error) {
        // Fallback or retry with generic 'email' if signup type errors
        const retryResult = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: "email"
        });
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

  // Google Sign-in trigger
  const signInWithGoogle = async () => {
    if (!supabase) {
      return { 
        success: false, 
        error: "Supabase is not configured yet. Please add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Settings > Secrets." 
      };
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: "offline",
            prompt: "consent"
          }
        }
      });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Sign out
  const signOut = async () => {
    // 1. Immediately nullify credentials locally for instantaneous, zero-latency feedback
    setUser(null);
    setProfile(null);
    setDemoModeActive(!isSupabaseConfigured);

    // 2. Clear token traces and cache vectors from storage
    try {
      localStorage.removeItem("PFA_DEMO_USER");
      localStorage.removeItem("PFA_TRANSACTIONS");
      localStorage.removeItem("PFA_BILLS");
      localStorage.removeItem("PFA_SUGGESTIONS");
      localStorage.removeItem("PFA_INCOME");
      localStorage.removeItem("PFA_ALERTS");
      
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith("sb-") || key.includes("supabase")) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn("Local caches purge anomaly:", e);
    }

    // 3. Initiate background remote sign-out non-blockingly so any slow connection/hang never impacts the user logout
    if (isSupabaseConfigured && supabase) {
      try {
        supabase.auth.signOut().catch(err => {
          console.warn("Background remote auth sign-out completed or warning:", err);
        });
      } catch (err) {
        console.warn("Synchronous background sign-out execution warning:", err);
      }
    }
  };

  // Theme support
  const updateThemePreference = async (newTheme: "light" | "dark") => {
    localStorage.setItem("theme_pref", newTheme);
    applyThemeClass(newTheme);

    if (profile) {
      let nextThemePreference: string = newTheme;
      if (profile.theme_preference) {
        try {
          if (profile.theme_preference !== "light" && profile.theme_preference !== "dark") {
            const parsed = JSON.parse(profile.theme_preference);
            if (parsed && typeof parsed === "object") {
              parsed.theme = newTheme;
              parsed.theme_preference = newTheme;
              nextThemePreference = JSON.stringify(parsed);
            }
          }
        } catch (e) {}
      }

      const updatedProfile = { ...profile, theme_preference: nextThemePreference as any };
      setProfile(updatedProfile);

      if (isSupabaseConfigured && supabase && user) {
        try {
          await (supabase as any)
            .from("profiles")
            .update({ theme_preference: nextThemePreference } as any)
            .eq("id", user.id);
        } catch (err) {
          console.error("Database theme preference synchronization error:", err);
        }
      } else if (demoModeActive) {
        localStorage.setItem(
          "PFA_DEMO_USER",
          JSON.stringify({ user, profile: updatedProfile })
        );
      }
    }
  };

  // Profile fields edits
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

  // Direct mock simulation triggers
  const triggerDemoSession = (email: string, name?: string) => {
    const mockUser = {
      id: "demo-user-123456",
      email,
      user_metadata: { full_name: name || email.split("@")[0] }
    };
    const mockProfile: UserProfile = {
      id: "demo-user-123456",
      email,
      full_name: name || email.split("@")[0],
      avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
      auth_provider: name ? "google" : "email",
      theme_preference: "light"
    };

    setUser(mockUser);
    setProfile(mockProfile);
    setDemoModeActive(true);

    localStorage.setItem(
      "PFA_DEMO_USER",
      JSON.stringify({ user: mockUser, profile: mockProfile })
    );
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
        triggerDemoSession
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
