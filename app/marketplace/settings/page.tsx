"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Settings,
  ArrowLeft,
  Bell,
  Lock,
  Globe,
  Palette,
  Info,
  Check,
  Loader2,
  Sun,
  Moon,
  Sparkles,
} from "lucide-react";
import { useMarketplaceAccount } from "@/components/marketplace/marketplace-account";
import { useTheme } from "@/components/theme/theme-provider";
import { toast } from "sonner";

interface SwitchControlProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SwitchControl({
  id,
  label,
  description,
  checked,
  onChange,
}: SwitchControlProps) {
  return (
    <div
      role="switch"
      id={id}
      tabIndex={0}
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-desc`}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className="flex items-center justify-between p-3.5 cc-surface-secondary border cc-border rounded-2xl cursor-pointer hover:cc-surface-tertiary transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9] select-none"
    >
      <div className="pr-4">
        <div id={`${id}-label`} className="text-xs font-semibold cc-text-primary">
          {label}
        </div>
        <div id={`${id}-desc`} className="text-[11px] cc-text-muted">
          {description}
        </div>
      </div>

      {/* Semantic Accessible Switch Indicator */}
      <div
        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
          checked ? "bg-[#65486f]" : "bg-[#211a24] border cc-border"
        }`}
      >
        <div
          className={`size-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { userId, isLoading: isAccountLoading } = useMarketplaceAccount();

  React.useEffect(() => {
    if (!isAccountLoading && !userId) {
      router.replace("/login?redirectTo=/marketplace/settings");
    }
  }, [isAccountLoading, userId, router]);

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [priceDrops, setPriceDrops] = useState(true);
  const [securityNotices, setSecurityNotices] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);
  const [showActivity, setShowActivity] = useState(false);
  const { theme, setTheme } = useTheme();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Preferences updated for this browser session.");
  };

  if (isAccountLoading || !userId) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
        <Loader2 className="size-8 text-[var(--cc-accent-pink)] animate-spin" />
        <p className="text-sm cc-text-muted">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs cc-text-muted mb-1">
          <Link
            href="/marketplace"
            className="hover:cc-text-primary transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Marketplace</span>
          </Link>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold cc-text-primary tracking-tight flex items-center gap-2.5">
          <Settings className="size-6 text-[var(--cc-accent-pink)]" />
          <span>Account Settings</span>
        </h1>
        <p className="text-xs cc-text-muted mt-1">
          Manage your interface preferences, alerts, and profile visibility.
        </p>
      </div>

      {/* Notice Banner */}
      <div className="flex items-start gap-3 p-4 cc-surface-secondary border border-[#e59bc9]/30 rounded-2xl text-xs cc-text-muted leading-relaxed shadow-sm">
        <Info className="size-4 text-[var(--cc-accent-pink)] shrink-0 mt-0.5" />
        <span>
          Interface preferences and alert settings are stored for your browser session. To update your public profile and account details, visit your Profile page.
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: APPEARANCE / VISUAL THEME */}
        <div id="appearance" className="cc-surface-card border cc-border rounded-3xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold cc-text-primary flex items-center gap-2 pb-2 border-b cc-border">
            <Palette className="size-4 text-[var(--cc-accent-pink)]" />
            <span>Appearance & Visual Theme</span>
          </h2>
          <p className="text-xs cc-text-muted">
            Select your preferred display theme. Changes apply immediately across CircuitCart.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* 1. Default Theme */}
            <button
              type="button"
              onClick={() => {
                setTheme("default");
                toast.success("Theme changed to CircuitCart Default.");
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9] ${
                theme === "default"
                  ? "bg-[var(--cc-surface-secondary)] border-[#e59bc9] cc-text-primary shadow-md ring-2 ring-[#e59bc9]/30"
                  : "cc-surface-secondary border cc-border cc-text-muted hover:cc-surface-tertiary"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-[#65486f] flex items-center justify-center text-white shrink-0">
                    <Sparkles className="size-3.5 text-[#e59bc9]" />
                  </div>
                  <span className="text-xs font-bold">Default</span>
                </div>
                {theme === "default" && <Check className="size-3.5 text-[#e59bc9]" />}
              </div>
              <span className="text-[10px] block mt-2 opacity-85 leading-snug">
                Signature plum & mauve CircuitCart appearance
              </span>
            </button>

            {/* 2. Light Theme */}
            <button
              type="button"
              onClick={() => {
                setTheme("light");
                toast.success("Theme changed to Light.");
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9] ${
                theme === "light"
                  ? "bg-[var(--cc-surface-secondary)] border-[#e59bc9] cc-text-primary shadow-md ring-2 ring-[#e59bc9]/30"
                  : "cc-surface-secondary border cc-border cc-text-muted hover:cc-surface-tertiary"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                    <Sun className="size-3.5 text-amber-500" />
                  </div>
                  <span className="text-xs font-bold">Light</span>
                </div>
                {theme === "light" && <Check className="size-3.5 text-[#e59bc9]" />}
              </div>
              <span className="text-[10px] block mt-2 opacity-85 leading-snug">
                Clean light surfaces with dark readable text
              </span>
            </button>

            {/* 3. Dark Theme */}
            <button
              type="button"
              onClick={() => {
                setTheme("dark");
                toast.success("Theme changed to Dark.");
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9] ${
                theme === "dark"
                  ? "bg-[var(--cc-surface-secondary)] border-[#e59bc9] cc-text-primary shadow-md ring-2 ring-[#e59bc9]/30"
                  : "cc-surface-secondary border cc-border cc-text-muted hover:cc-surface-tertiary"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                    <Moon className="size-3.5 text-indigo-400" />
                  </div>
                  <span className="text-xs font-bold">Dark</span>
                </div>
                {theme === "dark" && <Check className="size-3.5 text-[#e59bc9]" />}
              </div>
              <span className="text-[10px] block mt-2 opacity-85 leading-snug">
                Deep near-black aesthetic with brand accents
              </span>
            </button>
          </div>
        </div>

        {/* SECTION 2: REGION & PREFERENCES */}
        <div className="cc-surface-card border cc-border rounded-3xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold cc-text-primary flex items-center gap-2 pb-2 border-b cc-border">
            <Globe className="size-4 text-[var(--cc-accent-pink)]" />
            <span>Regional Preferences</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label htmlFor="currency-select" className="cc-text-muted font-semibold block">
                Preferred Currency
              </label>
              <select
                id="currency-select"
                defaultValue="PHP"
                className="w-full h-10 px-3 cc-surface-secondary border cc-border rounded-xl cc-text-primary text-xs focus:border-[#e59bc9] focus:outline-none"
              >
                <option value="PHP">Philippine Peso (PHP ₱)</option>
                <option value="USD">US Dollar (USD $)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="hub-select" className="cc-text-muted font-semibold block">
                Primary Trading Hub
              </label>
              <select
                id="hub-select"
                defaultValue="cebu"
                className="w-full h-10 px-3 cc-surface-secondary border cc-border rounded-xl cc-text-primary text-xs focus:border-[#e59bc9] focus:outline-none"
              >
                <option value="cebu">Metro Cebu & Central Visayas</option>
                <option value="davao">Davao Region</option>
                <option value="manila">Metro Manila</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 3: NOTIFICATIONS */}
        <div className="cc-surface-card border cc-border rounded-3xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold cc-text-primary flex items-center gap-2 pb-2 border-b cc-border">
            <Bell className="size-4 text-[var(--cc-accent-pink)]" />
            <span>Notification Preferences</span>
          </h2>

          <div className="space-y-3">
            <SwitchControl
              id="switch-email-alerts"
              label="Email Notifications"
              description="Receive updates about your listings and inquiries."
              checked={emailAlerts}
              onChange={setEmailAlerts}
            />

            <SwitchControl
              id="switch-price-drops"
              label="Price Drop Alerts"
              description="Get notified when saved electronics change prices."
              checked={priceDrops}
              onChange={setPriceDrops}
            />

            <SwitchControl
              id="switch-security-notices"
              label="Security & Verification Notices"
              description="Important safety and account protection advisories."
              checked={securityNotices}
              onChange={setSecurityNotices}
            />
          </div>
        </div>

        {/* SECTION 4: PRIVACY */}
        <div className="cc-surface-card border cc-border rounded-3xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold cc-text-primary flex items-center gap-2 pb-2 border-b cc-border">
            <Lock className="size-4 text-[var(--cc-accent-pink)]" />
            <span>Privacy Controls</span>
          </h2>

          <div className="space-y-3">
            <SwitchControl
              id="switch-public-profile"
              label="Public Profile"
              description="Allow other marketplace buyers and sellers to see your rating."
              checked={publicProfile}
              onChange={setPublicProfile}
            />

            <SwitchControl
              id="switch-show-activity"
              label="Show Recent Activity"
              description="Display public transaction feedback on your seller card."
              checked={showActivity}
              onChange={setShowActivity}
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 text-xs font-semibold bg-[#65486f] hover:bg-[#7a5985] text-white rounded-xl shadow-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
          >
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
}
