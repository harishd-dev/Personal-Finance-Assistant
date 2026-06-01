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
      className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-all duration-300 cursor-pointer shadow-3xs"
      title={`Switch to ${currentTheme === "light" ? "Dark" : "Light"} Mode`}
      id="theme-preference-toggle-btn"
    >
      <div className="relative w-4 h-4 overflow-hidden">
        <span
          className={`absolute inset-0 flex items-center justify-center transform transition-transform duration-300 ${
            currentTheme === "light" ? "translate-y-0 scale-100" : "translate-y-6 scale-0"
          }`}
        >
          <Sun className="w-4 h-4 text-amber-500 font-semibold" />
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center transform transition-transform duration-300 ${
            currentTheme === "dark" ? "translate-y-0 scale-100" : "-translate-y-6 scale-0"
          }`}
        >
          <Moon className="w-4 h-4 text-indigo-400" />
        </span>
      </div>
    </button>
  );
}
