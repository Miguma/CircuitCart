"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Search,
  Package,
  ShoppingCart,
  MessageSquare,
  ShieldCheck,
  LayoutDashboard,
  Store,
  ShoppingBag,
  FileText,
  Compass,
} from "lucide-react";
import { TourConfig, TourStep } from "./types";

interface GuidedTourSpotlightProps {
  tour: TourConfig;
  currentStepIndex: number;
  isOpen: boolean;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Sparkles,
  Search,
  Package,
  ShoppingCart,
  MessageSquare,
  ShieldCheck,
  LayoutDashboard,
  Store,
  ShoppingBag,
  FileText,
  Compass,
};

export function GuidedTourSpotlight({
  tour,
  currentStepIndex,
  isOpen,
  onNext,
  onPrev,
  onClose,
}: GuidedTourSpotlightProps) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isCenteredFallback, setIsCenteredFallback] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStep: TourStep | undefined = tour.steps[currentStepIndex];
  const totalSteps = tour.steps.length;

  const updatePosition = useCallback(() => {
    if (!isOpen || !currentStep) return;

    if (!currentStep.target) {
      setTargetRect(null);
      setIsCenteredFallback(true);
      return;
    }

    const el = document.querySelector(currentStep.target) as HTMLElement | null;
    if (!el) {
      setTargetRect(null);
      setIsCenteredFallback(true);
      return;
    }

    // Scroll into view if needed
    const rect = el.getBoundingClientRect();
    const isOutOfView =
      rect.top < 60 ||
      rect.bottom > window.innerHeight - 60 ||
      rect.left < 0 ||
      rect.right > window.innerWidth;

    if (isOutOfView) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    const updatedRect = el.getBoundingClientRect();
    const padding = 8;

    setTargetRect({
      top: Math.max(0, updatedRect.top - padding),
      left: Math.max(0, updatedRect.left - padding),
      width: updatedRect.width + padding * 2,
      height: updatedRect.height + padding * 2,
    });
    setIsCenteredFallback(false);
  }, [isOpen, currentStep]);

  useEffect(() => {
    if (!isOpen) return;

    // Initial positioning with slight delay to allow smooth scroll
    const timer = setTimeout(updatePosition, 100);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, currentStepIndex, updatePosition]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onNext, onPrev, onClose]);

  if (!isOpen || !currentStep) return null;

  const StepIcon = currentStep.iconName ? ICON_MAP[currentStep.iconName] || Sparkles : Sparkles;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Tooltip positioning logic
  const calculateTooltipStyle = (): React.CSSProperties => {
    if (isCenteredFallback || !targetRect) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 100000,
      };
    }

    const tooltipWidth = 360;
    const tooltipHeight = 220;
    const margin = 14;

    let top = targetRect.top + targetRect.height + margin;
    let left = targetRect.left;

    // Check bottom space
    if (top + tooltipHeight > window.innerHeight - 20) {
      // Position above if space allows
      if (targetRect.top - tooltipHeight - margin > 20) {
        top = targetRect.top - tooltipHeight - margin;
      } else {
        // Fallback to center vertically
        top = Math.max(20, (window.innerHeight - tooltipHeight) / 2);
      }
    }

    // Check right space
    if (left + tooltipWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - tooltipWidth - 16);
    }
    if (left < 16) {
      left = 16;
    }

    return {
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 100000,
    };
  };

  return (
    <div
      className="fixed inset-0 z-[99990] transition-opacity duration-300"
      aria-modal="true"
      role="dialog"
      aria-label={currentStep.title}
    >
      {/* Dimmed backdrop with Spotlight Cutout */}
      {targetRect && !isCenteredFallback ? (
        <>
          {/* Spotlight Highlight Box */}
          <div
            className="fixed pointer-events-none rounded-2xl border-2 border-[#e59bc9] ring-4 ring-[#e59bc9]/25 transition-all duration-300 ease-out"
            style={{
              top: `${targetRect.top}px`,
              left: `${targetRect.left}px`,
              width: `${targetRect.width}px`,
              height: `${targetRect.height}px`,
              boxShadow:
                "0 0 0 9999px rgba(12, 7, 16, 0.78), 0 0 30px rgba(229, 155, 201, 0.45)",
              zIndex: 99995,
            }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-[#0c0710]/80 backdrop-blur-xs transition-opacity duration-300 pointer-events-auto" />
      )}

      {/* Floating Tour Tooltip Card */}
      <div
        ref={tooltipRef}
        style={calculateTooltipStyle()}
        className="w-[calc(100vw-32px)] max-w-sm sm:max-w-md pointer-events-auto rounded-3xl border border-[#e59bc9]/35 bg-[#1e1322]/95 p-5 text-white shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#65486f]/50 border border-[#e59bc9]/40 text-[11px] font-bold text-[#e59bc9]">
              <Compass className="size-3 text-[#e59bc9]" />
              <span className="truncate">{tour.badge}</span>
            </span>
            <span className="text-xs text-[#b9adb6] font-semibold">
              Step {currentStepIndex + 1} of {totalSteps}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#d6cbd5] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close tour"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-4 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-[#65486f] text-white flex items-center justify-center shrink-0 shadow-xs border border-[#e59bc9]/40">
              <StepIcon className="size-4 text-[#e59bc9]" />
            </div>
            <h3 className="text-base font-extrabold text-[#fffafa] tracking-tight">
              {currentStep.title}
            </h3>
          </div>
          <p className="text-xs sm:text-[13px] text-[#d6cbd5] leading-relaxed pl-0.5">
            {currentStep.content}
          </p>
        </div>

        {/* Progress Dots */}
        <div className="flex items-center gap-1.5 py-1.5">
          {tour.steps.map((step, idx) => (
            <div
              key={step.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStepIndex
                  ? "w-6 bg-[#e59bc9]"
                  : idx < currentStepIndex
                  ? "w-2 bg-[#65486f]"
                  : "w-2 bg-white/15"
              }`}
            />
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-[#b9adb6] hover:text-white transition-colors cursor-pointer"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={onPrev}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
              >
                <ChevronLeft className="size-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-1 px-4 py-2 text-xs font-bold text-white bg-[#65486f] hover:bg-[#7a5985] active:scale-95 rounded-xl shadow-md transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9]"
            >
              <span>{isLastStep ? "Finish Tour" : "Next"}</span>
              {!isLastStep && <ChevronRight className="size-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
