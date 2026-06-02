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
  ShieldCheck,
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
    if (res.success) setIsEditing(false);
  };

  return (
    <div className="relative" id="profile-manager-container">
      {/* ── Trigger Button ── */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-2.5 px-2.5 py-1 rounded-xl border transition-colors cursor-pointer"
        style={{
          backgroundColor: "var(--color-bg-subtle)",
          borderColor: "var(--color-border-medium)",
        }}
        title="View Profile"
        id="profile-trigger-avatar-btn"
      >
        <img
          src={profile.avatar_url}
          alt={profile.full_name}
          className="w-7 h-7 rounded-lg border shrink-0"
          style={{
            backgroundColor: "var(--color-brand-50)",
            borderColor: "var(--color-border-medium)",
          }}
        />
        <div className="text-left hidden sm:block">
          <span
            className="text-xs font-bold block max-w-24 truncate leading-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            {profile.full_name}
          </span>
          <span
            className="text-[9px] block font-sans truncate pr-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            {demoModeActive ? "Sandbox Mode" : "Linked Session"}
          </span>
        </div>
      </button>

      {/* ── Dropdown Popover ── */}
      {isOpen && (
        <div
          className="absolute right-0 mt-3 w-80 rounded-2xl z-50 overflow-hidden"
          style={{
            backgroundColor: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border-medium)",
            boxShadow: "var(--shadow-xl)",
          }}
        >
          {/* Header */}
          <div
            className="p-5 border-b"
            style={{
              backgroundColor: "var(--color-bg-subtle)",
              borderColor: "var(--color-border-subtle)",
            }}
          >
            <div className="flex gap-4 items-start">
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="w-12 h-12 rounded-xl border"
                style={{
                  backgroundColor: "var(--color-brand-50)",
                  borderColor: "var(--color-border-medium)",
                }}
              />
              <div className="min-w-0 flex-1 space-y-1">
                {isEditing ? (
                  <form onSubmit={handleSaveProfile} className="flex gap-1.5 items-center">
                    <input
                      type="text"
                      value={fullNameInput}
                      onChange={(e) => setFullNameInput(e.target.value)}
                      className="w-full rounded-lg px-2 py-1 text-xs font-semibold outline-none border"
                      style={{
                        backgroundColor: "var(--color-bg-input)",
                        borderColor: "var(--color-border-medium)",
                        color: "var(--color-text-primary)",
                      }}
                      required
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="p-1 rounded-md transition-colors"
                      style={{ color: "var(--color-success-icon)" }}
                    >
                      {isSaving ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFullNameInput(profile.full_name);
                        setIsEditing(false);
                      }}
                      className="p-1 rounded-md transition-colors"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4
                      className="font-bold text-sm leading-tight max-w-44 truncate"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {profile.full_name}
                    </h4>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-[10px] font-bold hover:underline cursor-pointer"
                      style={{ color: "var(--color-brand-600)" }}
                    >
                      (Edit)
                    </button>
                  </div>
                )}

                <span
                  className="text-xs block truncate font-mono select-all"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {profile.email}
                </span>

                {/* Auth method badges */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span
                    className="text-[8px] px-2 py-0.5 rounded-full uppercase font-bold font-mono tracking-wider"
                    style={{
                      backgroundColor: "var(--color-bg-muted)",
                      color: "var(--color-text-tertiary)",
                    }}
                  >
                    {profile.auth_provider === "google" ? "Google" : "Email OTP"}
                  </span>

                  {demoModeActive && (
                    <span
                      className="text-[8px] px-1.5 py-0.5 rounded font-semibold font-mono flex items-center gap-0.5 border"
                      style={{
                        backgroundColor: "var(--color-warning-bg)",
                        color: "var(--color-warning-text)",
                        borderColor: "var(--color-warning-border)",
                      }}
                    >
                      <Sparkles className="w-2.5 h-2.5" /> Sandbox
                    </span>
                  )}

                  {!demoModeActive && (
                    <span
                      className="text-[8px] px-1.5 py-0.5 rounded font-semibold font-mono flex items-center gap-0.5 border"
                      style={{
                        backgroundColor: "var(--color-success-bg)",
                        color: "var(--color-success-text)",
                        borderColor: "var(--color-success-border)",
                      }}
                    >
                      <ShieldCheck className="w-2.5 h-2.5" /> Live DB
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Join date */}
            <div
              className="flex items-center gap-1.5 mt-4 text-[10px] font-mono"
              style={{ color: "var(--color-text-disabled)" }}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Member since {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}</span>
            </div>
          </div>

          {/* Sign-out action */}
          <div
            className="p-4 text-center"
            style={{ backgroundColor: "var(--color-bg-subtle)" }}
          >
            <button
              onClick={() => {
                setIsOpen(false);
                if (onSignOutTrigger) {
                  onSignOutTrigger();
                } else {
                  signOut();
                }
              }}
              className="w-full font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer border"
              style={{
                backgroundColor: "var(--color-danger-bg)",
                color: "var(--color-danger-text)",
                borderColor: "var(--color-danger-border)",
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Secure Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Click-outside overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 cursor-default"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}