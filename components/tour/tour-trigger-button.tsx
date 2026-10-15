"use client";

import React from "react";
import { Compass, X } from "lucide-react";

interface TourTriggerButtonProps {
  label?: string;
  onClick: () => void;
  onDismiss: () => void;
}

export function TourTriggerButton({
  label = "Take a Tour",
  onClick,
  onDismiss,
}: TourTriggerButtonProps) {
  return (
    <div className="fixed z-40 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 right-4 md:right-6 inline-flex items-center gap-1 p-1 rounded-full bg-[#1e1322]/95 border border-[#e59bc9]/40 shadow-[0_8px_30px_rgb(0,0,0,0.45)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-full hover:bg-white/10 text-xs font-bold text-[#fffafa] transition-colors group focus-visible:outline-2 focus-visible:outline-[#e59bc9] cursor-pointer"
        aria-label="Start interactive guided tour"
        title="Start guided tour"
      >
        <Compass className="size-4 text-[#e59bc9] group-hover:rotate-45 transition-transform duration-300" />
        <span className="hidden sm:inline font-bold tracking-tight">{label}</span>
        <span className="sm:hidden font-bold tracking-tight">Tour</span>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="size-6 rounded-full flex items-center justify-center text-[#b9adb6] hover:text-white hover:bg-white/15 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
        aria-label="Dismiss tour button"
        title="Don't show tour button again"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
