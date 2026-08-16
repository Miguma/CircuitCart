"use client";

import React, { useState } from "react";
import { TechCharacters, MascotState } from "@/components/login/tech-characters";
import { RegisterForm } from "@/components/register/register-form";

export default function RegisterPage() {
  const [characterState, setCharacterState] = useState<MascotState>("idle");
  const [customMessage, setCustomMessage] = useState<string | undefined>(undefined);

  const handleStateChange = (state: MascotState, msg?: string) => {
    setCharacterState(state);
    setCustomMessage(msg);
  };

  return (
    <main className="min-h-screen lg:h-[100svh] lg:max-h-[100svh] w-full bg-[#faf6f7] text-[#1d1720] flex flex-col md:flex-row overflow-x-hidden box-border">
      {/* 
        DESKTOP & TABLET: Split-Screen Layout (100svh viewport fit)
        Left panel: 56% desktop (50% tablet), dusty-mauve background
        Right panel: 44% desktop (50% tablet), Warm off-white background
      */}

      {/* LEFT PANEL: Mascot Illustration & Background System */}
      <section
        aria-label="Illustration"
        className="hidden md:flex w-full md:w-[50%] lg:w-[56%] bg-[#e5d5d8] border-b md:border-b-0 md:border-r border-[#d4c3c6] flex-col items-center justify-center p-6 lg:p-10 md:h-full box-border relative overflow-hidden select-none"
      >
        {/* Faint Radial Spotlight Layer */}
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.45)_0%,_transparent_65%)] pointer-events-none"
          aria-hidden="true"
        />

        <div className="w-full max-w-[520px] flex flex-col items-center justify-center relative z-10">
          <TechCharacters state={characterState} customMessage={customMessage} showBubble={true} />
          
          <p className="mt-3 text-center text-sm font-medium text-[#5e495f] max-w-sm tracking-wide">
            Good tech deserves a second story.
          </p>
        </div>
      </section>

      {/* MOBILE COMPACT ILLUSTRATION (Visible on Mobile only, above form) */}
      <div className="flex md:hidden w-full bg-[#e5d5d8] p-5 items-center justify-center border-b border-[#d4c3c6] relative overflow-hidden select-none">
        <TechCharacters state={characterState} customMessage={customMessage} className="max-w-xs h-[190px]" showBubble={true} />
      </div>

      {/* RIGHT PANEL: Registration Form (Top-Aligned & Compact) */}
      <section
        aria-label="Registration Form"
        className="w-full md:w-[50%] lg:w-[44%] flex flex-col justify-start items-center py-6 sm:py-8 px-5 sm:px-8 md:h-full bg-[#faf6f7] box-border overflow-y-auto"
      >
        <RegisterForm onStateChange={handleStateChange} />
      </section>
    </main>
  );
}
