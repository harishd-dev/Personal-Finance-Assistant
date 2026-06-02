import React from "react";
import { useAuth, getThemeFromPreference } from "../../context/AuthContext";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const { profile, updateThemePreference } = useAuth();

  const currentTheme = getThemeFromPreference(profile?.theme_preference);

  const handleToggle = () => {
    const nextTheme = currentTheme === "light" ? "dark" : "light";
    updateThemePreference(nextTheme);
  };

  return (
    <button
      onClick={handleToggle}
      className="p-2.5 rounded-xl border transition-all duration-200 cursor-pointer"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        borderColor: "var(--color-border-medium)",
        color: "var(--color-text-secondary)",
        boxShadow: "var(--shadow-xs)",
      }}
      title={`Switch to ${currentTheme === "light" ? "Dark" : "Light"} Mode`}
      id="theme-preference-toggle-btn"
      aria-label={`Switch to ${currentTheme === "light" ? "dark" : "light"} mode`}
    >
      <div className="relative w-4 h-4 overflow-hidden">
        {/* Sun icon — visible in light mode */}
        <span
          className="absolute inset-0 flex items-center justify-center transform transition-all duration-300"
          style={{
            opacity: currentTheme === "light" ? 1 : 0,
            transform: currentTheme === "light" ? "translateY(0) scale(1)" : "translateY(8px) scale(0)",
          }}
        >
          <Sun className="w-4 h-4" style={{ color: "#f59e0b" }} />
        </span>

        {/* Moon icon — visible in dark mode */}
        <span
          className="absolute inset-0 flex items-center justify-center transform transition-all duration-300"
          style={{
            opacity: currentTheme === "dark" ? 1 : 0,
            transform: currentTheme === "dark" ? "translateY(0) scale(1)" : "translateY(-8px) scale(0)",
          }}
        >
          <Moon className="w-4 h-4" style={{ color: "#818cf8" }} />
        </span>
      </div>
    </button>
  );
}