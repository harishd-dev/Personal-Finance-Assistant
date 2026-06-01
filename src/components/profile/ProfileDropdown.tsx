import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { 
  User, 
  Settings, 
  LogOut, 
  Check, 
  X, 
  RefreshCw,
  Sparkles,
  Calendar,
  ShieldCheck
} from "lucide-react";

interface ProfileDropdownProps {
  onSignOutTrigger?: () => void;
}

export default function ProfileDropdown({ onSignOutTrigger }: ProfileDropdownProps) {
  const { profile, signOut, updateProfileDetails, demoModeActive } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [fullNameInput, setFullNameInput] = useState(profile?.full_name || "");
  const [isSaving, setIsSaving] = useState(false);

  if (!profile) return null;

  const handleToggle = () => setIsOpen(!isOpen);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullNameInput.trim()) return;

    setIsSaving(true);
    const res = await updateProfileDetails({ full_name: fullNameInput.trim() });
    setIsSaving(false);
    
    if (res.success) {
      setIsEditing(false);
    }
  };

  return (
    <div className="relative" id="profile-manager-container">
      {/* Trigger Button */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-2.5 p-1 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-xl transition-colors cursor-pointer border border-transparent dark:border-slate-800"
        title="View Personal Profile"
        id="profile-trigger-avatar-btn"
      >
        <img
          src={profile.avatar_url}
          alt={profile.full_name}
          className="w-7.5 h-7.5 rounded-lg border border-indigo-150/50 bg-indigo-50 shrink-0"
        />
        <div className="text-left hidden sm:block">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block max-w-24 truncate leading-tight">
            {profile.full_name}
          </span>
          <span className="text-[9px] text-slate-400 dark:text-slate-450 block font-sans truncate pr-1">
            {demoModeActive ? "Sandbox Mode" : "Linked Session"}
          </span>
        </div>
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-85 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl z-50 overflow-hidden animate-in fade-in duration-100 font-sans">
          
          {/* Header */}
          <div className="bg-slate-50 dark:bg-slate-850/50 p-5 border-b border-slate-150 dark:border-slate-800">
            <div className="flex gap-4 items-start">
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="w-12 h-12 rounded-xl bg-indigo-50 border border-slate-200 dark:border-slate-700"
              />
              <div className="min-w-0 flex-1 space-y-1">
                {isEditing ? (
                  <form onSubmit={handleSaveProfile} className="flex gap-1.5 items-center">
                    <input
                      type="text"
                      value={fullNameInput}
                      onChange={(e) => setFullNameInput(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none"
                      required
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 p-1 rounded-md"
                    >
                      {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFullNameInput(profile.full_name);
                        setIsEditing(false);
                      }}
                      className="text-slate-400 hover:text-slate-600 dark:text-slate-500 p-1 rounded-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-bold text-slate-800 dark:text-slate-150 text-sm leading-tight max-w-44 truncate">
                      {profile.full_name}
                    </h4>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                    >
                      (Edit)
                    </button>
                  </div>
                )}
                <span className="text-xs text-slate-450 dark:text-slate-400 block truncate font-mono select-all">
                  {profile.email}
                </span>

                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[8px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-350 px-2 py-0.5 rounded-full uppercase font-bold font-mono tracking-wider">
                    {profile.auth_provider === "google" ? "Google" : "Email OTP"}
                  </span>
                  
                  {demoModeActive && (
                    <span className="text-[8px] bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/25 px-1.5 py-0.5 rounded font-semibold font-mono flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> Sandbox
                    </span>
                  )}
                  
                  {!demoModeActive && (
                    <span className="text-[8px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/25 px-1.5 py-0.5 rounded font-semibold font-mono flex items-center gap-0.5">
                      <ShieldCheck className="w-2.5 h-2.5" /> Real DB
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 mt-4 text-[10px] text-slate-400 dark:text-slate-505 font-mono">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Joined: 2026-05-30</span>
            </div>
          </div>

          {/* Logout Actions */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-850/40 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                if (onSignOutTrigger) {
                  onSignOutTrigger();
                } else {
                  signOut();
                }
              }}
              className="w-full bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Secure Sign Out
            </button>
          </div>

        </div>
      )}

      {/* Popover overlay for clean closing on clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 cursor-default"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </div>
  );
}
