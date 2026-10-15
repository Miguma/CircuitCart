"use client";

import React from "react";
import { Compass } from "lucide-react";

interface TourTriggerButtonProps {
  label?: string;
  onClick: () => void;
}

export function TourTriggerButton({
  label = "Take a Tour",
  onClick,
}: TourTriggerButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed z-40 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 right-4 md:right-6 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-[#1e1322]/95 hover:bg-[#342339] border border-[#e59bc9]/40 text-xs font-bold text-[#fffafa] shadow-[0_8px_30px_rgb(0,0,0,0.45)] backdrop-blur-xl transition-all hover:scale-105 active:scale-95 group focus-visible:outline-2 focus-visible:outline-[#e59bc9] cursor-pointer"
      aria-label="Start interactive guided tour"
      title="Start guided tour"
    >
      <Compass className="size-4 text-[#e59bc9] group-hover:rotate-45 transition-transform duration-300" />
      <span className="hidden sm:inline font-bold tracking-tight">{label}</span>
      <span className="sm:hidden font-bold tracking-tight">Tour</span>
    </button>
  );
}
