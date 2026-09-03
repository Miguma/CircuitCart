"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Settings,
  ArrowLeft,
  Bell,
  Lock,
  Globe,
  Palette,
  Info,
  Check,
} from "lucide-react";
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
      className="flex items-center justify-between p-3.5 bg-[#342339]/50 border border-white/5 rounded-2xl cursor-pointer hover:bg-[#342339] transition-colors focus-visible:outline-2 focus-visible:outline-[#e59bc9] select-none"
    >
      <div className="pr-4">
        <div id={`${id}-label`} className="text-xs font-semibold text-white">
          {label}
        </div>
        <div id={`${id}-desc`} className="text-[11px] text-[#b9adb6]">
          {description}
        </div>
      </div>

      {/* Semantic Accessible Switch Indicator */}
      <div
        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
          checked ? "bg-[#65486f]" : "bg-[#211a24] border border-white/20"
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
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [priceDrops, setPriceDrops] = useState(true);
  const [securityNotices, setSecurityNotices] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);
  const [showActivity, setShowActivity] = useState(false);
  const [theme, setTheme] = useState<"mauve" | "dark" | "system">("mauve");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Preferences updated for this browser session.");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-[#b9adb6] mb-1">
          <Link
            href="/marketplace"
            className="hover:text-white transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Marketplace</span>
          </Link>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <Settings className="size-6 text-[#e59bc9]" />
          <span>Account Settings</span>
        </h1>
        <p className="text-xs text-[#b9adb6] mt-1">
          Manage your interface preferences, alerts, and demo profile visibility.
        </p>
      </div>

      {/* Demo Notice Banner */}
      <div className="flex items-start gap-3 p-4 bg-[#241c27] border border-[#e59bc9]/30 rounded-2xl text-xs text-[#b9adb6] leading-relaxed shadow-sm">
        <Info className="size-4 text-[#e59bc9] shrink-0 mt-0.5" />
        <span>
          Settings configured here are saved locally for this demonstration session. Permanent profile settings will be synchronized when Supabase database tables are attached.
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: REGION & PREFERENCES */}
        <div className="bg-[#241c27] border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/10">
            <Globe className="size-4 text-[#e59bc9]" />
            <span>Regional Preferences</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label htmlFor="currency-select" className="text-[#b9adb6] font-semibold block">
                Preferred Currency
              </label>
              <select
                id="currency-select"
                defaultValue="PHP"
                className="w-full h-10 px-3 bg-[#342339] border border-white/10 rounded-xl text-white text-xs focus:border-[#e59bc9] focus:outline-none"
              >
                <option value="PHP">Philippine Peso (PHP ₱)</option>
                <option value="USD">US Dollar (USD $)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="hub-select" className="text-[#b9adb6] font-semibold block">
                Primary Trading Hub
              </label>
              <select
                id="hub-select"
                defaultValue="cebu"
                className="w-full h-10 px-3 bg-[#342339] border border-white/10 rounded-xl text-white text-xs focus:border-[#e59bc9] focus:outline-none"
              >
                <option value="cebu">Metro Cebu & Central Visayas</option>
                <option value="davao">Davao Region</option>
                <option value="manila">Metro Manila</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 2: NOTIFICATIONS */}
        <div className="bg-[#241c27] border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/10">
            <Bell className="size-4 text-[#e59bc9]" />
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

        {/* SECTION 3: PRIVACY */}
        <div className="bg-[#241c27] border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/10">
            <Lock className="size-4 text-[#e59bc9]" />
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

        {/* SECTION 4: APPEARANCE */}
        <div className="bg-[#241c27] border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/10">
            <Palette className="size-4 text-[#e59bc9]" />
            <span>Visual Theme</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setTheme("mauve")}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9] ${
                theme === "mauve"
                  ? "bg-[#342339] border-[#e59bc9] text-white shadow-sm"
                  : "bg-[#342339]/40 border-white/5 text-[#b9adb6] hover:bg-[#342339]/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">CircuitCart Mauve</span>
                {theme === "mauve" && <Check className="size-3.5 text-[#e59bc9]" />}
              </div>
              <span className="text-[10px] block mt-1 opacity-80">Default signature theme</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9] ${
                theme === "dark"
                  ? "bg-[#342339] border-[#e59bc9] text-white shadow-sm"
                  : "bg-[#342339]/40 border-white/5 text-[#b9adb6] hover:bg-[#342339]/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">OLED Dark</span>
                {theme === "dark" && <Check className="size-3.5 text-[#e59bc9]" />}
              </div>
              <span className="text-[10px] block mt-1 opacity-80">Deep charcoal contrast</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme("system")}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9] ${
                theme === "system"
                  ? "bg-[#342339] border-[#e59bc9] text-white shadow-sm"
                  : "bg-[#342339]/40 border-white/5 text-[#b9adb6] hover:bg-[#342339]/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">System Default</span>
                {theme === "system" && <Check className="size-3.5 text-[#e59bc9]" />}
              </div>
              <span className="text-[10px] block mt-1 opacity-80">Sync with OS settings</span>
            </button>
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
