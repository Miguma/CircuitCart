"use client";

import React from "react";
import { Sparkles, Compass, X } from "lucide-react";
import { TourConfig } from "./types";

interface WelcomeDialogProps {
  tour: TourConfig;
  isOpen: boolean;
  onStart: () => void;
  onDismiss: () => void;
}

export function WelcomeTourDialog({
  tour,
  isOpen,
  onStart,
  onDismiss,
}: WelcomeDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99980] flex items-center justify-center p-4 bg-[#0a050d]/70 backdrop-blur-xs animate-in fade-in duration-200"
      aria-modal="true"
      role="dialog"
    >
      <div className="relative w-full max-w-sm sm:max-w-md rounded-3xl border border-[#e59bc9]/35 bg-[#1e1322]/95 p-6 text-white shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 duration-200 space-y-4">
        {/* Close Button */}
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-[#d6cbd5] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Dismiss welcome prompt"
        >
          <X className="size-4" />
        </button>

        {/* Header Icon & Badge */}
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-[#65486f] text-white flex items-center justify-center shrink-0 shadow-md border border-[#e59bc9]/40">
            <Compass className="size-6 text-[#e59bc9] animate-pulse" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#e59bc9] block">
              {tour.badge}
            </span>
            <h3 className="text-lg font-black text-[#fffafa] tracking-tight">
              Welcome to CircuitCart!
            </h3>
          </div>
        </div>

        {/* Message */}
        <p className="text-xs sm:text-[13px] text-[#d6cbd5] leading-relaxed">
          Would you like a quick 1-minute interactive walkthrough to explore verified listings, instant chat negotiations, and safe meetup downpayments?
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onDismiss}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-[#b9adb6] hover:text-white transition-colors cursor-pointer text-center"
          >
            Explore Myself
          </button>
          <button
            type="button"
            onClick={onStart}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-[#65486f] hover:bg-[#7a5985] active:scale-95 rounded-xl shadow-md transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
          >
            <Sparkles className="size-3.5 text-[#e59bc9]" />
            <span>Start Guided Tour</span>
          </button>
        </div>
      </div>
    </div>
  );
}
