"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { TOUR_CONFIGS } from "./tour-config";
import { TourId } from "./types";
import { GuidedTourSpotlight } from "./guided-tour-spotlight";
import { WelcomeTourDialog } from "./welcome-dialog";
import { TourTriggerButton } from "./tour-trigger-button";

interface GuidedTourControllerProps {
  tourId: TourId;
  triggerLabel?: string;
  autoPrompt?: boolean;
}

export function GuidedTourController({
  tourId,
  triggerLabel = "Take a Tour",
  autoPrompt = true,
}: GuidedTourControllerProps) {
  const searchParams = useSearchParams();
  const config = TOUR_CONFIGS[tourId];

  const storageKey = `circuitcart_tour_${tourId}_completed`;
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Check URL param ?tour=1 or ?tour=buyer/seller/admin
  useEffect(() => {
    if (!config) return;

    const tourParam = searchParams.get("tour");
    if (tourParam === "1" || tourParam === tourId) {
      const timer = setTimeout(() => {
        setIsWelcomeOpen(false);
        setCurrentStepIndex(0);
        setIsTourActive(true);
      }, 50);
      return () => clearTimeout(timer);
    }

    if (!autoPrompt) return;

    // Check if user has already completed/dismissed the tour
    try {
      const isCompleted = localStorage.getItem(storageKey);
      if (!isCompleted) {
        // Show gentle welcome prompt on first arrival
        const timer = setTimeout(() => {
          setIsWelcomeOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // Storage access blocked or unavailable
    }
  }, [searchParams, tourId, config, storageKey, autoPrompt]);

  const handleStartTour = useCallback(() => {
    setIsWelcomeOpen(false);
    setCurrentStepIndex(0);
    setIsTourActive(true);
  }, []);

  const handleDismissWelcome = useCallback(() => {
    setIsWelcomeOpen(false);
    try {
      localStorage.setItem(storageKey, "dismissed");
    } catch {
      // Ignore storage errors
    }
  }, [storageKey]);

  const handleCloseTour = useCallback(() => {
    setIsTourActive(false);
    try {
      localStorage.setItem(storageKey, "completed");
    } catch {
      // Ignore storage errors
    }
  }, [storageKey]);

  const handleNextStep = useCallback(() => {
    if (!config) return;

    if (currentStepIndex < config.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleCloseTour();
    }
  }, [config, currentStepIndex, handleCloseTour]);

  const handlePrevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  if (!config) return null;

  return (
    <>
      {/* Persistent floating replay button */}
      <TourTriggerButton label={triggerLabel} onClick={handleStartTour} />

      {/* Welcome first-time prompt dialog */}
      <WelcomeTourDialog
        tour={config}
        isOpen={isWelcomeOpen}
        onStart={handleStartTour}
        onDismiss={handleDismissWelcome}
      />

      {/* Active Spotlight & Tooltip Modal */}
      <GuidedTourSpotlight
        tour={config}
        currentStepIndex={currentStepIndex}
        isOpen={isTourActive}
        onNext={handleNextStep}
        onPrev={handlePrevStep}
        onClose={handleCloseTour}
      />
    </>
  );
}
