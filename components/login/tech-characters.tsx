"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

export type AuthPhase = "idle" | "checking" | "error" | "success";
export type FocusedField =
  | "name"
  | "email"
  | "password"
  | "confirmPassword"
  | "terms"
  | null;

interface TechCharactersProps {
  authPhase?: AuthPhase;
  focusedField?: FocusedField;
  isPasswordVisible?: boolean;
  passwordLength?: number;
  className?: string;
  showBubble?: boolean;
  defaultMessage?: string;
}

type MascotName = "mon" | "phone" | "key" | "ctrl";
type SpeakerType = "group" | "monitor" | "phone" | "keyboard" | "controller";

interface ActiveMessage {
  text: string;
  speaker: SpeakerType;
  priority: number; // 1 = highest (Success), 10 = lowest (Idle)
  isTemporary: boolean;
  duration?: number;
}

// Smoothing constants per specification
const PUPIL_SMOOTHING = 0.34;
const BODY_SMOOTHING = 0.22;

export function TechCharacters({
  authPhase = "idle",
  focusedField = null,
  isPasswordVisible = false,
  passwordLength = 0,
  className = "",
  showBubble = true,
  defaultMessage = "Ready to find your next upgrade?",
}: TechCharactersProps) {
  const animationFrameRef = useRef<number | null>(null);

  // 12 Separate Mascot Refs for direct DOM manipulation
  const monBodyRef = useRef<SVGGElement>(null);
  const monLeftPupilRef = useRef<SVGGElement>(null);
  const monRightPupilRef = useRef<SVGGElement>(null);
  const monFaceRef = useRef<SVGGElement>(null);

  const phoneBodyRef = useRef<SVGGElement>(null);
  const phoneLeftPupilRef = useRef<SVGGElement>(null);
  const phoneRightPupilRef = useRef<SVGGElement>(null);
  const phoneFaceRef = useRef<SVGGElement>(null);

  const keyBodyRef = useRef<SVGGElement>(null);
  const keyLeftPupilRef = useRef<SVGGElement>(null);
  const keyRightPupilRef = useRef<SVGGElement>(null);
  const keyFaceRef = useRef<SVGGElement>(null);

  const ctrlBodyRef = useRef<SVGGElement>(null);
  const ctrlLeftPupilRef = useRef<SVGGElement>(null);
  const ctrlRightPupilRef = useRef<SVGGElement>(null);
  const ctrlFaceRef = useRef<SVGGElement>(null);

  // Poke & Annoyed reaction state
  const [pokedMascot, setPokedMascot] = useState<MascotName | null>(null);
  const [pokeType, setPokeType] = useState<"normal" | "annoyed" | null>(null);
  const [annoyedMascot, setAnnoyedMascot] = useState<MascotName | null>(null);

  // Rapid poke counts and timers per mascot
  const pokeCounts = useRef<Record<MascotName, number>>({
    mon: 0,
    phone: 0,
    key: 0,
    ctrl: 0,
  });
  const pokeResetTimers = useRef<Record<MascotName, NodeJS.Timeout | null>>({
    mon: null,
    phone: null,
    key: null,
    ctrl: null,
  });
  const reactionTimers = useRef<Record<MascotName, NodeJS.Timeout | null>>({
    mon: null,
    phone: null,
    key: null,
    ctrl: null,
  });

  // Pointer tracking state refs
  const latestPointer = useRef<{ x: number; y: number }>({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
  });
  const pointerActive = useRef<boolean>(false);
  const pointerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPointerMovingRef = useRef<boolean>(false);

  // CENTRAL SPEECH BUBBLE CONTROLLER REFS & STATE
  const msgSequenceToken = useRef<number>(0);
  const messageTimerRef = useRef<NodeJS.Timeout | null>(null);
  const textFadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [displayedText, setDisplayedText] = useState<string>("");
  const [displayedSpeaker, setDisplayedSpeaker] = useState<SpeakerType>("group");
  const [isTextFading, setIsTextFading] = useState<boolean>(false);

  const currentActiveMsg = useRef<ActiveMessage>({
    text: "",
    speaker: "group",
    priority: 99,
    isTemporary: false,
  });

  const dispatchMessageRef = useRef<(msg: ActiveMessage) => void>(() => {});

  // Cached face center bounding box coordinates
  const cachedCenters = useRef<{
    mon: { x: number; y: number } | null;
    phone: { x: number; y: number } | null;
    key: { x: number; y: number } | null;
    ctrl: { x: number; y: number } | null;
  }>({
    mon: null,
    phone: null,
    key: null,
    ctrl: null,
  });

  // Lerped tracking values across all 4 mascots
  const currentOffsets = useRef({
    mon: { eyeX: 0, eyeY: 0, bodyX: 0, bodyY: 0, rot: 0 },
    phone: { eyeX: 0, eyeY: 0, bodyX: 0, bodyY: 0, rot: 0 },
    key: { eyeX: 0, eyeY: 0, bodyX: 0, bodyY: 0, rot: 0 },
    ctrl: { eyeX: 0, eyeY: 0, bodyX: 0, bodyY: 0, rot: 0 },
  });

  // Entrance phase
  const [isEntering, setIsEntering] = useState(true);
  const [entranceBeat, setEntranceBeat] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setEntranceBeat(true), 1300);
    const timer2 = setTimeout(() => {
      setIsEntering(false);
      setEntranceBeat(false);
    }, 1800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const isEnteringState = isEntering && authPhase === "idle";
  const isChecking = authPhase === "checking";
  const isError = authPhase === "error";
  const isSuccess = authPhase === "success";

  const isPasswordTyping = !isPasswordVisible && (focusedField === "password" || focusedField === "confirmPassword") && passwordLength > 0;
  const isPasswordEmpty = !isPasswordVisible && (focusedField === "password" || focusedField === "confirmPassword") && passwordLength === 0;
  const isEmail = focusedField === "email";
  const isFieldError = false; // Kept for layout compatibility

  // Pointer Gaze active
  const isPointerGaze =
    !isEnteringState &&
    !isChecking &&
    !isError &&
    !isSuccess &&
    !isPasswordTyping &&
    !isPasswordVisible;

  // Resolve current live message state based on strict priority hierarchy
  const resolveLiveState = useCallback((): ActiveMessage => {
    if (isSuccess) {
      return {
        text: defaultMessage?.includes("join") ? "Welcome to CircuitCart!" : "Welcome back!",
        speaker: "group",
        priority: 1,
        isTemporary: false,
      };
    }
    if (isChecking) {
      return {
        text: defaultMessage?.includes("join") ? "Creating your account…" : "Checking your account…",
        speaker: "group",
        priority: 2,
        isTemporary: false,
      };
    }
    if (isError) {
      return {
        text: "Let’s try that again.",
        speaker: "group",
        priority: 3,
        isTemporary: false,
      };
    }

    if (isPointerMovingRef.current && isPointerGaze) {
      return {
        text: "We see you looking around.",
        speaker: "group",
        priority: 8,
        isTemporary: true,
        duration: 1600,
      };
    }

    return {
      text: defaultMessage ?? "Ready to find your next upgrade?",
      speaker: "group",
      priority: 9,
      isTemporary: false,
    };
  }, [isSuccess, isChecking, isError, isPointerGaze, defaultMessage]);

  // Central Dispatcher: Enforces priority, tokens, text fade (80ms out/140ms in), and timer cleanup
  const dispatchMessage = useCallback(
    (newMsg: ActiveMessage) => {
      // Priority Rule: Lower-priority states CANNOT interrupt a locked higher-priority message!
      // (lower number = higher priority)
      if (newMsg.priority > currentActiveMsg.current.priority) {
        return;
      }

      // Increment token to invalidate old callbacks
      msgSequenceToken.current += 1;
      const token = msgSequenceToken.current;

      // Clear existing temporary timer
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
        messageTimerRef.current = null;
      }

      currentActiveMsg.current = newMsg;

      // Trigger smooth text-only fade transition
      if (displayedText !== newMsg.text || displayedSpeaker !== newMsg.speaker) {
        setIsTextFading(true);
        if (textFadeTimerRef.current) clearTimeout(textFadeTimerRef.current);
        textFadeTimerRef.current = setTimeout(() => {
          setDisplayedText(newMsg.text);
          setDisplayedSpeaker(newMsg.speaker);
          setIsTextFading(false);
        }, 80); // 80ms fade out before updating text
      } else {
        setDisplayedSpeaker(newMsg.speaker);
      }

      // If temporary message, schedule restoration after duration
      if (newMsg.isTemporary && newMsg.duration) {
        messageTimerRef.current = setTimeout(() => {
          if (token !== msgSequenceToken.current) return;

          // Unlock priority back to lowest so live state re-evaluates
          currentActiveMsg.current = {
            text: "",
            speaker: "group",
            priority: 99,
            isTemporary: false,
          };

          // Re-evaluate live state at expiration time
          const restored = resolveLiveState();
          dispatchMessageRef.current(restored);
        }, newMsg.duration);
      }
    },
    [displayedText, displayedSpeaker, resolveLiveState]
  );

  // Keep ref pointing to latest dispatchMessage
  useEffect(() => {
    dispatchMessageRef.current = dispatchMessage;
  }, [dispatchMessage]);

  // Sync persistent state changes with central message controller
  useEffect(() => {
    const liveMsg = resolveLiveState();

    // If state change is higher or equal priority, dispatch it
    if (liveMsg.priority <= currentActiveMsg.current.priority) {
      const timer = setTimeout(() => {
        dispatchMessage(liveMsg);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [authPhase, resolveLiveState, dispatchMessage]);

  // Handle temporary field focus messages
  useEffect(() => {
    if (focusedField) {
      let text = "";
      if (focusedField === "name") text = "What should we call you?";
      else if (focusedField === "email") text = defaultMessage?.includes("join") ? "Looking good so far." : "Good to see you again.";
      else if (focusedField === "password") text = "Is that a secret?";
      else if (focusedField === "confirmPassword") text = "One more time.";
      else if (focusedField === "terms") text = "Almost there!";

      if (text) {
        const timer = setTimeout(() => {
          dispatchMessage({
            text,
            speaker: "group",
            priority: 7,
            isTemporary: true,
            duration: 1600,
          });
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [focusedField, defaultMessage, dispatchMessage]);

  // Handle temporary password visible message
  useEffect(() => {
    if (isPasswordVisible) {
      const timer = setTimeout(() => {
        dispatchMessage({
          text: "We’re looking away.",
          speaker: "group",
          priority: 4,
          isTemporary: true,
          duration: 1600,
        });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isPasswordVisible, dispatchMessage]);

  // Poke handler for click, tap, and keyboard interaction
  const handlePoke = useCallback(
    (mascot: MascotName) => {
      if (annoyedMascot === mascot) return;

      const newCount = (pokeCounts.current[mascot] || 0) + 1;
      pokeCounts.current[mascot] = newCount;

      if (pokeResetTimers.current[mascot]) {
        clearTimeout(pokeResetTimers.current[mascot]!);
      }
      pokeResetTimers.current[mascot] = setTimeout(() => {
        pokeCounts.current[mascot] = 0;
      }, 1800);

      const speakerMap: Record<MascotName, SpeakerType> = {
        mon: "monitor",
        phone: "phone",
        key: "keyboard",
        ctrl: "controller",
      };
      const textMap: Record<MascotName, string> = {
        mon: "Boop!",
        phone: "Hey!",
        key: "Click!",
        ctrl: "Ready!",
      };

      if (newCount >= 5) {
        setPokedMascot(mascot);
        setPokeType("annoyed");
        setAnnoyedMascot(mascot);

        if (reactionTimers.current[mascot]) clearTimeout(reactionTimers.current[mascot]!);
        reactionTimers.current[mascot] = setTimeout(() => {
          setPokedMascot((curr) => (curr === mascot ? null : curr));
          setPokeType(null);
          setAnnoyedMascot((curr) => (curr === mascot ? null : curr));
          pokeCounts.current[mascot] = 0;
        }, 1500); // 1.5s annoyed duration per spec

        dispatchMessage({
          text: "Okay, okay!",
          speaker: speakerMap[mascot],
          priority: 5,
          isTemporary: true,
          duration: 1500,
        });
      } else {
        setPokedMascot(mascot);
        setPokeType("normal");

        if (reactionTimers.current[mascot]) clearTimeout(reactionTimers.current[mascot]!);
        reactionTimers.current[mascot] = setTimeout(() => {
          setPokedMascot((curr) => (curr === mascot ? null : curr));
          setPokeType(null);
        }, 1000); // 1.0s normal poke duration per spec

        dispatchMessage({
          text: textMap[mascot],
          speaker: speakerMap[mascot],
          priority: 6,
          isTemporary: true,
          duration: 1000,
        });
      }
    },
    [annoyedMascot, dispatchMessage]
  );

  // Compute horizontal tail position percentage
  const getTailLeft = (speaker: SpeakerType) => {
    switch (speaker) {
      case "monitor":
        return "25%";
      case "keyboard":
        return "35%";
      case "phone":
        return "56%";
      case "controller":
        return "76%";
      case "group":
      default:
        return "48%";
    }
  };

  // Reset mascot pupils & bodies to neutral position smoothly
  const returnMascotsToNeutral = useCallback(() => {
    [
      monLeftPupilRef,
      monRightPupilRef,
      phoneLeftPupilRef,
      phoneRightPupilRef,
      keyLeftPupilRef,
      keyRightPupilRef,
      ctrlLeftPupilRef,
      ctrlRightPupilRef,
    ].forEach((ref) => {
      if (ref.current) ref.current.style.transform = "translate3d(0px, 0px, 0px)";
    });
    [monBodyRef, phoneBodyRef, keyBodyRef, ctrlBodyRef].forEach((ref) => {
      if (ref.current) ref.current.style.transform = "none";
    });
    currentOffsets.current = {
      mon: { eyeX: 0, eyeY: 0, bodyX: 0, bodyY: 0, rot: 0 },
      phone: { eyeX: 0, eyeY: 0, bodyX: 0, bodyY: 0, rot: 0 },
      key: { eyeX: 0, eyeY: 0, bodyX: 0, bodyY: 0, rot: 0 },
      ctrl: { eyeX: 0, eyeY: 0, bodyX: 0, bodyY: 0, rot: 0 },
    };
  }, []);

  // Recalculate cached face centers
  const updateCachedCenters = useCallback(() => {
    const getCenter = (elem: SVGGElement | null) => {
      if (!elem) return null;
      const rect = elem.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };

    cachedCenters.current = {
      mon: getCenter(monFaceRef.current),
      phone: getCenter(phoneFaceRef.current),
      key: getCenter(keyFaceRef.current),
      ctrl: getCenter(ctrlFaceRef.current),
    };
  }, []);

  // Update cached bounds on mount, when entrance ends, and on resize/scroll
  useEffect(() => {
    updateCachedCenters();
    const handleResize = () => updateCachedCenters();
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("scroll", handleResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize);
    };
  }, [updateCachedCenters, isEnteringState]);

  // Unified 60fps tracking animation loop
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (prefersReducedMotion || isTouch) return;

    const computeTarget = (
      center: { x: number; y: number } | null,
      px: number,
      py: number,
      maxPupil: number
    ) => {
      if (!center) return { eyeX: 0, eyeY: 0, bodyX: 0, bodyY: 0, rot: 0 };
      const dx = px - center.x;
      const dy = py - center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const normX = dist > 0 ? dx / dist : 0;
      const normY = dist > 0 ? dy / dist : 0;
      const mag = Math.min(dist / 350, 1);

      return {
        eyeX: normX * maxPupil * mag,
        eyeY: normY * maxPupil * mag,
        bodyX: normX * 2.0 * mag,
        bodyY: normY * 1.5 * mag,
        rot: normX * 1.5 * mag,
      };
    };

    const updateFrame = () => {
      if (!isPointerGaze || !pointerActive.current) {
        animationFrameRef.current = null;
        return;
      }

      const px = latestPointer.current.x;
      const py = latestPointer.current.y;
      const centers = cachedCenters.current;

      const targetMon = computeTarget(centers.mon, px, py, 5.5);
      const targetPhone = computeTarget(centers.phone, px, py, 3.5);
      const targetKey = computeTarget(centers.key, px, py, 3.5);
      const targetCtrl = computeTarget(centers.ctrl, px, py, 3.5);

      const curr = currentOffsets.current;

      curr.mon.eyeX += (targetMon.eyeX - curr.mon.eyeX) * PUPIL_SMOOTHING;
      curr.mon.eyeY += (targetMon.eyeY - curr.mon.eyeY) * PUPIL_SMOOTHING;
      curr.mon.bodyX += (targetMon.bodyX - curr.mon.bodyX) * BODY_SMOOTHING;
      curr.mon.bodyY += (targetMon.bodyY - curr.mon.bodyY) * BODY_SMOOTHING;
      curr.mon.rot += (targetMon.rot - curr.mon.rot) * BODY_SMOOTHING;

      curr.phone.eyeX += (targetPhone.eyeX - curr.phone.eyeX) * PUPIL_SMOOTHING;
      curr.phone.eyeY += (targetPhone.eyeY - curr.phone.eyeY) * PUPIL_SMOOTHING;
      curr.phone.bodyX += (targetPhone.bodyX - curr.phone.bodyX) * BODY_SMOOTHING;
      curr.phone.bodyY += (targetPhone.bodyY - curr.phone.bodyY) * BODY_SMOOTHING;
      curr.phone.rot += (targetPhone.rot - curr.phone.rot) * BODY_SMOOTHING;

      curr.key.eyeX += (targetKey.eyeX - curr.key.eyeX) * PUPIL_SMOOTHING;
      curr.key.eyeY += (targetKey.eyeY - curr.key.eyeY) * PUPIL_SMOOTHING;
      curr.key.bodyX += (targetKey.bodyX - curr.key.bodyX) * BODY_SMOOTHING;
      curr.key.bodyY += (targetKey.bodyY - curr.key.bodyY) * BODY_SMOOTHING;
      curr.key.rot += (targetKey.rot - curr.key.rot) * BODY_SMOOTHING;

      curr.ctrl.eyeX += (targetCtrl.eyeX - curr.ctrl.eyeX) * PUPIL_SMOOTHING;
      curr.ctrl.eyeY += (targetCtrl.eyeY - curr.ctrl.eyeY) * PUPIL_SMOOTHING;
      curr.ctrl.bodyX += (targetCtrl.bodyX - curr.ctrl.bodyX) * BODY_SMOOTHING;
      curr.ctrl.bodyY += (targetCtrl.bodyY - curr.ctrl.bodyY) * BODY_SMOOTHING;
      curr.ctrl.rot += (targetCtrl.rot - curr.ctrl.rot) * BODY_SMOOTHING;

      // Batch DOM writes
      if (monLeftPupilRef.current) monLeftPupilRef.current.style.transform = `translate3d(${curr.mon.eyeX.toFixed(2)}px, ${curr.mon.eyeY.toFixed(2)}px, 0px)`;
      if (monRightPupilRef.current) monRightPupilRef.current.style.transform = `translate3d(${curr.mon.eyeX.toFixed(2)}px, ${curr.mon.eyeY.toFixed(2)}px, 0px)`;
      if (monBodyRef.current && !prefersReducedMotion) monBodyRef.current.style.transform = `translate3d(${curr.mon.bodyX.toFixed(2)}px, ${curr.mon.bodyY.toFixed(2)}px, 0px) rotate(${curr.mon.rot.toFixed(2)}deg)`;

      if (phoneLeftPupilRef.current) phoneLeftPupilRef.current.style.transform = `translate3d(${curr.phone.eyeX.toFixed(2)}px, ${curr.phone.eyeY.toFixed(2)}px, 0px)`;
      if (phoneRightPupilRef.current) phoneRightPupilRef.current.style.transform = `translate3d(${curr.phone.eyeX.toFixed(2)}px, ${curr.phone.eyeY.toFixed(2)}px, 0px)`;
      if (phoneBodyRef.current && !prefersReducedMotion) phoneBodyRef.current.style.transform = `translate3d(${curr.phone.bodyX.toFixed(2)}px, ${curr.phone.bodyY.toFixed(2)}px, 0px) rotate(${curr.phone.rot.toFixed(2)}deg)`;

      if (keyLeftPupilRef.current) keyLeftPupilRef.current.style.transform = `translate3d(${curr.key.eyeX.toFixed(2)}px, ${curr.key.eyeY.toFixed(2)}px, 0px)`;
      if (keyRightPupilRef.current) keyRightPupilRef.current.style.transform = `translate3d(${curr.key.eyeX.toFixed(2)}px, ${curr.key.eyeY.toFixed(2)}px, 0px)`;
      if (keyBodyRef.current && !prefersReducedMotion) keyBodyRef.current.style.transform = `translate3d(${curr.key.bodyX.toFixed(2)}px, ${curr.key.bodyY.toFixed(2)}px, 0px) rotate(${curr.key.rot.toFixed(2)}deg)`;

      if (ctrlLeftPupilRef.current) ctrlLeftPupilRef.current.style.transform = `translate3d(${curr.ctrl.eyeX.toFixed(2)}px, ${curr.ctrl.eyeY.toFixed(2)}px, 0px)`;
      if (ctrlRightPupilRef.current) ctrlRightPupilRef.current.style.transform = `translate3d(${curr.ctrl.eyeX.toFixed(2)}px, ${curr.ctrl.eyeY.toFixed(2)}px, 0px)`;
      if (ctrlBodyRef.current && !prefersReducedMotion) ctrlBodyRef.current.style.transform = `translate3d(${curr.ctrl.bodyX.toFixed(2)}px, ${curr.ctrl.bodyY.toFixed(2)}px, 0px) rotate(${curr.ctrl.rot.toFixed(2)}deg)`;

      animationFrameRef.current = requestAnimationFrame(updateFrame);
    };

    const scheduleMascotFrame = () => {
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateFrame);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      latestPointer.current = {
        x: event.clientX,
        y: event.clientY,
      };
      pointerActive.current = true;

      // Trigger cursor message ONCE when movement starts
      if (!isPointerMovingRef.current) {
        isPointerMovingRef.current = true;
        if (isPointerGaze && currentActiveMsg.current.priority >= 9) {
          dispatchMessage({
            text: "We see you looking around.",
            speaker: "group",
            priority: 9,
            isTemporary: true,
            duration: 1600,
          });
        }
      }

      if (pointerTimerRef.current) clearTimeout(pointerTimerRef.current);
      pointerTimerRef.current = setTimeout(() => {
        isPointerMovingRef.current = false;
      }, 1600);

      scheduleMascotFrame();
    };

    const handleWindowBlur = () => {
      pointerActive.current = false;
      isPointerMovingRef.current = false;
      returnMascotsToNeutral();
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
      capture: true,
    });
    window.addEventListener("blur", handleWindowBlur);

    if (isPointerGaze && pointerActive.current) {
      scheduleMascotFrame();
    }

    return () => {
      window.removeEventListener("pointermove", handlePointerMove, {
        capture: true,
      });
      window.removeEventListener("blur", handleWindowBlur);
      if (pointerTimerRef.current) clearTimeout(pointerTimerRef.current);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPointerGaze, returnMascotsToNeutral, dispatchMessage]);

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
      if (textFadeTimerRef.current) clearTimeout(textFadeTimerRef.current);
      if (pointerTimerRef.current) clearTimeout(pointerTimerRef.current);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isPointerGaze) {
      returnMascotsToNeutral();
    }
  }, [isPointerGaze, returnMascotsToNeutral]);

  const enableBlink = authPhase === "idle" && !focusedField && !isPasswordVisible && !entranceBeat && !pokedMascot;

  return (
    <div
      className={`relative flex items-center justify-center w-full max-w-[510px] h-[330px] sm:h-[390px] lg:h-[450px] select-none ${className}`}
      aria-hidden="true"
    >
      {/* SINGLE PERSISTENT BUBBLE WITH SLIDING TAIL & FIXED DIMENSIONS */}
      {showBubble && (
        <div
          className="absolute top-[8%] sm:top-[12%] right-[18%] sm:right-[22%] z-20 pointer-events-none select-none"
          aria-live="polite"
        >
          <div
            className="relative bg-[#6e546f] text-[#fffafa] text-xs sm:text-[13px] font-medium w-[180px] sm:w-[225px] h-[58px] min-h-[58px] rounded-[15px] shadow-[0_4px_12px_rgba(25,19,27,0.12)] flex items-center justify-center text-center leading-snug px-4 py-2.5"
          >
            {/* Fade text content only (80ms out / 140ms in) */}
            <span
              className={`transition-opacity duration-140 ease-out ${
                isTextFading ? "opacity-0" : "opacity-100"
              }`}
            >
              {displayedText}
            </span>
            {/* Sliding bubble tail moving horizontally (160ms transition) toward active speaker */}
            <div
              className="absolute -bottom-2 w-0 h-0 border-x-[7px] border-x-transparent border-t-[9px] border-t-[#6e546f] transition-[left] duration-160 ease-out"
              style={{ left: getTailLeft(displayedSpeaker) }}
            />
          </div>
        </div>
      )}

      {/* SVG MASCOTS & BACKGROUND CIRCUIT TRACES */}
      <svg
        viewBox="0 0 460 290"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        <defs>
          <style>{`
            /* --- ENTRANCE ANIMATION --- */
            @keyframes monDropIn {
              0% { transform: translateY(-140px); opacity: 0; }
              70% { transform: translateY(7px); opacity: 1; }
              88% { transform: translateY(-2px); }
              100% { transform: translateY(0); opacity: 1; }
            }
            @keyframes phoneSlideIn {
              0% { transform: translateX(130px); opacity: 0; }
              70% { transform: translateX(-5px); opacity: 1; }
              88% { transform: translateX(2px); }
              100% { transform: translateX(0); opacity: 1; }
            }
            @keyframes keyRiseUp {
              0% { transform: translateY(140px) scaleY(0.92); opacity: 0; }
              70% { transform: translateY(-7px) scaleY(1.05); opacity: 1; }
              88% { transform: translateY(2px) scaleY(0.99); }
              100% { transform: translateY(0) scaleY(1); opacity: 1; }
            }
            @keyframes ctrlPeekIn {
              0% { transform: translateX(140px); opacity: 0; }
              70% { transform: translateX(-6px); opacity: 1; }
              88% { transform: translateX(2px); }
              100% { transform: translateX(0); opacity: 1; }
            }

            /* --- REACTION KEYFRAMES --- */
            @keyframes groupSuccessHop {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-6px); }
            }
            @keyframes keySquashRebound {
              0%, 100% { transform: scaleY(1); }
              40% { transform: scaleY(0.92); }
              75% { transform: scaleY(1.04); }
            }

            /* --- POKE ANIMATION KEYFRAMES (Spring-like easing, 500-550ms) --- */
            @keyframes pokeMonAnim {
              0%, 100% { transform: translate3d(0,0,0) scaleY(1); }
              50% { transform: translate3d(0, 3px, 0) scaleY(0.95); }
            }
            @keyframes pokePhoneAnim {
              0%, 100% { transform: translate3d(0,0,0) rotate(0deg); }
              50% { transform: translate3d(2px, 0, 0) rotate(4deg); }
            }
            @keyframes pokeKeyAnim {
              0%, 100% { transform: translate3d(0,0,0); }
              50% { transform: translate3d(0, 3px, 0); }
            }
            @keyframes pokeCtrlAnim {
              0%, 100% { transform: translate3d(0,0,0) rotate(0deg); }
              25% { transform: rotate(-3deg); }
              75% { transform: rotate(3deg); }
            }

            /* --- REPEATED-POKE ANNOYED SHAKE KEYFRAMES --- */
            @keyframes mascotAnnoyedShake {
              0%, 100% { transform: translate3d(0,0,0); }
              20%, 60% { transform: translate3d(-2.5px, 0, 0); }
              40%, 80% { transform: translate3d(2.5px, 0, 0); }
            }

            /* --- SAD GROUP POSE --- */
            @keyframes sadMonPose {
              0% { transform: translateY(0) rotate(0deg); }
              13.3% { transform: rotate(1.5deg); }
              33.3%, 100% { transform: translateY(6px) rotate(-2deg); }
            }
            @keyframes sadPhonePose {
              0% { transform: translateX(0) rotate(0deg); }
              13.3% { transform: rotate(1.5deg); }
              33.3%, 100% { transform: translateX(-5px) translateY(2px) rotate(-3.5deg); }
            }
            @keyframes sadKeyPose {
              0% { transform: translateY(0) scaleY(1); }
              13.3% { transform: translateY(0) scaleY(1); }
              33.3%, 100% { transform: translateY(3px) scaleY(0.96); }
            }
            @keyframes sadCtrlPose {
              0% { transform: translateX(0); }
              13.3% { transform: translateX(2px); }
              33.3%, 100% { transform: translateX(-6px); }
            }

            /* --- IDLE BLINKS --- */
            @keyframes blinkMon {
              0%, 97%, 98.8%, 100% { opacity: 1; }
              97.9% { opacity: 0; }
            }
            @keyframes blinkPhone {
              0%, 96%, 98.2%, 100% { opacity: 1; }
              97.1% { opacity: 0; }
            }
            @keyframes blinkKey {
              0%, 97.5%, 99.2%, 100% { opacity: 1; }
              98.3% { opacity: 0; }
            }
            @keyframes blinkCtrl {
              0%, 95.5%, 97.8%, 100% { opacity: 1; }
              96.6% { opacity: 0; }
            }

            .anim-mon-drop { animation: ${isEnteringState ? "monDropIn 1.45s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both" : "none"}; }
            .anim-phone-slide { animation: ${isEnteringState ? "phoneSlideIn 1.45s cubic-bezier(0.22, 1, 0.36, 1) 0.18s both" : "none"}; }
            .anim-key-rise { animation: ${isEnteringState ? "keyRiseUp 1.45s cubic-bezier(0.22, 1, 0.36, 1) 0.28s both" : "none"}; }
            .anim-ctrl-peek { animation: ${isEnteringState ? "ctrlPeekIn 1.45s cubic-bezier(0.22, 1, 0.36, 1) 0.38s both" : "none"}; }

            .anim-poke-mon { animation: pokeMonAnim 0.52s cubic-bezier(0.34, 1.56, 0.64, 1); }
            .anim-poke-phone { animation: pokePhoneAnim 0.52s cubic-bezier(0.34, 1.56, 0.64, 1); }
            .anim-poke-key { animation: pokeKeyAnim 0.52s cubic-bezier(0.34, 1.56, 0.64, 1); }
            .anim-poke-ctrl { animation: pokeCtrlAnim 0.52s cubic-bezier(0.34, 1.56, 0.64, 1); }

            .anim-annoyed-shake { animation: mascotAnnoyedShake 1.0s cubic-bezier(0.36, 0.07, 0.19, 0.97); }

            .anim-success-hop { animation: groupSuccessHop 0.65s cubic-bezier(0.22, 1, 0.36, 1); }
            .anim-key-rebound { animation: keySquashRebound 0.65s cubic-bezier(0.22, 1, 0.36, 1); }

            .anim-sad-mon { animation: sadMonPose 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
            .anim-sad-phone { animation: sadPhonePose 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
            .anim-sad-key { animation: sadKeyPose 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
            .anim-sad-ctrl { animation: sadCtrlPose 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }

            .blink-mon-idle { animation: ${enableBlink ? "blinkMon 8.2s infinite 1.1s" : "none"}; }
            .blink-phone-idle { animation: ${enableBlink ? "blinkPhone 7.4s infinite 2.5s" : "none"}; }
            .blink-key-idle { animation: ${enableBlink ? "blinkKey 9.1s infinite 4.2s" : "none"}; }
            .blink-ctrl-idle { animation: ${enableBlink ? "blinkCtrl 6.6s infinite 0.6s" : "none"}; }

            @media (prefers-reduced-motion: reduce) {
              .anim-mon-drop, .anim-phone-slide, .anim-key-rise, .anim-ctrl-peek,
              .anim-poke-mon, .anim-poke-phone, .anim-poke-key, .anim-poke-ctrl,
              .anim-annoyed-shake, .anim-success-hop, .anim-key-rebound,
              .anim-sad-mon, .anim-sad-phone, .anim-sad-key, .anim-sad-ctrl,
              .blink-mon-idle, .blink-phone-idle, .blink-key-idle, .blink-ctrl-idle {
                animation: none !important;
                transform: none !important;
              }
            }
          `}</style>

          <linearGradient id="monGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#432c45" />
            <stop offset="100%" stopColor="#281729" />
          </linearGradient>
          <linearGradient id="phoneGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#876690" />
            <stop offset="100%" stopColor="#684d72" />
          </linearGradient>
          <linearGradient id="keyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c08f9f" />
            <stop offset="100%" stopColor="#a37282" />
          </linearGradient>
          <linearGradient id="ctrlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#694975" />
            <stop offset="100%" stopColor="#4a3054" />
          </linearGradient>
        </defs>

        {/* LAYER 3: BACKGROUND CIRCUIT TRACES */}
        <g className="pointer-events-none" aria-hidden="true">
          <g stroke="#6e546f" strokeWidth="1" opacity="0.11" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M 90 95 L 45 95 L 25 75 L 12 75" />
            <path d="M 80 190 L 45 190 L 28 207 L 15 207" />
            <path d="M 130 58 L 130 32 L 112 14" />
            <path d="M 335 175 L 370 175 L 392 153" />
            <path d="M 355 240 L 395 240 L 418 217" />
          </g>

          <g fill="#6e546f" opacity="0.15">
            <circle cx="12" cy="75" r="1.8" />
            <circle cx="15" cy="207" r="1.8" />
            <circle cx="112" cy="14" r="1.8" />
            <circle cx="392" cy="153" r="1.8" />
            <circle cx="418" cy="217" r="1.8" />
          </g>
        </g>

        {/* LAYER 4: SHARED GROUND SHADOW */}
        <ellipse cx="230" cy="285" rx="195" ry="12" fill="#1e1021" opacity="0.18" />

        {/* LAYER 5: MAIN MASCOTS GROUP WRAPPER */}
        <g className={isSuccess ? "anim-success-hop" : ""}>

          {/* ========================================================= */}
          {/* 1. DESKTOP MONITOR MASCOT */}
          {/* ========================================================= */}
          <g className="anim-mon-drop">
            <g
              tabIndex={0}
              role="button"
              aria-label="Poke monitor mascot"
              onPointerDown={() => handlePoke("mon")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handlePoke("mon");
                }
              }}
              className="cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-[#6e546f] focus-visible:outline-offset-4 rounded-xl"
              style={{
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
                outline: "none",
                background: "transparent",
                filter: displayedSpeaker === "monitor" ? "brightness(1.03)" : "none",
                transition: "filter 150ms ease-out",
              }}
            >
              {/* Inner Poke Animation Layer */}
              <g
                className={
                  pokedMascot === "mon"
                    ? pokeType === "annoyed"
                      ? "anim-annoyed-shake"
                      : "anim-poke-mon"
                    : ""
                }
                style={{ overflow: "visible" }}
              >
                {/* Cursor-Parallax Body Wrapper */}
                <g
                  ref={monBodyRef}
                  data-mascot="monitor"
                  className={isError ? "anim-sad-mon" : ""}
                  style={{
                    willChange: "transform",
                    transform:
                      !isError && !isEnteringState
                        ? isChecking
                          ? "rotate(2deg) translateY(2px)"
                          : isPasswordVisible
                          ? "rotate(-2.5deg)"
                          : isPasswordTyping
                          ? "translateY(-2.5px)"
                          : isPasswordEmpty
                          ? "rotate(1.5deg)"
                          : isEmail
                          ? "rotate(1.5deg)"
                          : isSuccess
                          ? "translateY(-4px)"
                          : undefined
                        : undefined,
                    transformOrigin: "127px 285px",
                  }}
                >
                  <rect x="90" y="273" width="65" height="12" rx="6" fill="#644e6a" />
                  <rect x="116" y="190" width="12" height="86" rx="4" fill="#7d6484" />

                  <rect x="20" y="55" width="215" height="140" rx="18" fill="url(#monGrad)" stroke="#48334c" strokeWidth="1.5" />
                  <rect x="30" y="65" width="195" height="120" rx="12" fill="#352238" />
                  <rect x="112" y="70" width="30" height="4" rx="2" fill="#1e1020" />

                  {/* Annoyed X-shaped Stress Symbol (Floating ~8px above upper corner) */}
                  {annoyedMascot === "mon" && (
                    <g stroke="#6e546f" strokeWidth="2.2" strokeLinecap="round">
                      <line x1="32" y1="44" x2="40" y2="52" />
                      <line x1="40" y1="44" x2="32" y2="52" />
                    </g>
                  )}

                  {/* Face */}
                  <g
                    ref={monFaceRef}
                    data-face="monitor"
                    style={{
                      transform: !isError
                        ? isChecking
                          ? "translate(5px, 4px)"
                          : entranceBeat
                          ? "translate(0px, 3px)"
                          : isPasswordVisible
                          ? "translate(-5px, -3px)"
                          : isPasswordTyping
                          ? "translate(4px, 0px)"
                          : isPasswordEmpty
                          ? "translate(4px, 0px)"
                          : isEmail
                          ? "translate(4px, 0px)"
                          : isFieldError
                          ? "translate(4px, 0px)"
                          : isSuccess
                          ? "translate(-2px, -1px)"
                          : undefined
                        : undefined,
                    }}
                  >
                    {/* Eyes - Password Privacy Rules strictly enforced */}
                    {isPasswordVisible ? (
                      <g stroke="#fdfaf8" strokeWidth="1.8" strokeLinecap="round" fill="none">
                        <path d="M 104 120 Q 108 124 112 120" />
                        <path d="M 144 120 Q 148 124 152 120" />
                      </g>
                    ) : isError ? (
                      <g fill="#fdfaf8">
                        <circle cx="108" cy="126" r="3.2" />
                        <circle cx="148" cy="126" r="3.2" />
                      </g>
                    ) : annoyedMascot === "mon" ? (
                      <g stroke="#fdfaf8" strokeWidth="1.8" strokeLinecap="round" fill="none">
                        <line x1="104" y1="116" x2="112" y2="119" />
                        <line x1="152" y1="116" x2="144" y2="119" />
                        <circle cx="108" cy="122" r="2.4" fill="#fdfaf8" />
                        <circle cx="148" cy="122" r="2.4" fill="#fdfaf8" />
                      </g>
                    ) : pokedMascot === "mon" ? (
                      <g fill="#fdfaf8">
                        <circle cx="108" cy="122" r="4.2" />
                        <circle cx="148" cy="122" r="4.2" />
                      </g>
                    ) : (
                      <g fill="#fdfaf8" className="blink-mon-idle">
                        <g ref={monLeftPupilRef} data-pupil="mon-left" style={{ willChange: "transform" }}>
                          <circle cx="108" cy="122" r="3.2" />
                        </g>
                        <g ref={monRightPupilRef} data-pupil="mon-right" style={{ willChange: "transform" }}>
                          <circle cx="148" cy="122" r="3.2" />
                        </g>
                      </g>
                    )}

                    {/* Mouth */}
                    {isSuccess || isPasswordVisible ? (
                      <path d="M 122 131 Q 128 136 134 131" stroke="#fdfaf8" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                    ) : isError ? (
                      <path d="M 122 136 Q 128 130 134 136" stroke="#fdfaf8" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                    ) : annoyedMascot === "mon" ? (
                      <line x1="125" y1="133" x2="131" y2="133" stroke="#fdfaf8" strokeWidth="2" strokeLinecap="round" />
                    ) : pokedMascot === "mon" ? (
                      <circle cx="128" cy="132" r="2.5" stroke="#fdfaf8" strokeWidth="1.8" fill="none" />
                    ) : isPasswordTyping ? (
                      <circle cx="128" cy="131" r="2.2" stroke="#fdfaf8" strokeWidth="1.8" fill="none" />
                    ) : isPasswordEmpty || isFieldError || isChecking ? (
                      <line x1="124" y1="131" x2="132" y2="131" stroke="#fdfaf8" strokeWidth="2" strokeLinecap="round" />
                    ) : (
                      <path d="M 122 131 Q 128 136 134 131" stroke="#fdfaf8" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                    )}
                  </g>
                </g>
              </g>
            </g>
          </g>

          {/* ========================================================= */}
          {/* 2. SMARTPHONE MASCOT */}
          {/* ========================================================= */}
          <g className="anim-phone-slide">
            <g
              tabIndex={0}
              role="button"
              aria-label="Poke phone mascot"
              onPointerDown={() => handlePoke("phone")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handlePoke("phone");
                }
              }}
              className="cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-[#6e546f] focus-visible:outline-offset-4 rounded-xl"
              style={{
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
                outline: "none",
                background: "transparent",
                filter: displayedSpeaker === "phone" ? "brightness(1.03)" : "none",
                transition: "filter 150ms ease-out",
              }}
            >
              {/* Inner Poke Animation Layer */}
              <g
                className={
                  pokedMascot === "phone"
                    ? pokeType === "annoyed"
                      ? "anim-annoyed-shake"
                      : "anim-poke-phone"
                    : ""
                }
                style={{ overflow: "visible" }}
              >
                {/* Cursor-Parallax Body Wrapper */}
                <g
                  ref={phoneBodyRef}
                  data-mascot="phone"
                  className={isError ? "anim-sad-phone" : ""}
                  style={{
                    willChange: "transform",
                    transform:
                      !isError && !isEnteringState
                        ? isChecking
                          ? "rotate(2deg) translateY(2px)"
                          : isPasswordVisible
                          ? "rotate(-3.5deg)"
                          : isPasswordTyping
                          ? "translateY(-2.5px)"
                          : isPasswordEmpty
                          ? "rotate(2deg)"
                          : isEmail
                          ? "rotate(2deg) translateX(3px)"
                          : isSuccess
                          ? "rotate(-2deg) translateY(-4px)"
                          : undefined
                        : undefined,
                    transformOrigin: "251px 276px",
                  }}
                >
                  <rect x="210" y="118" width="82" height="158" rx="18" fill="url(#phoneGrad)" stroke="#9876a2" strokeWidth="1.5" />
                  <rect x="217" y="125" width="68" height="144" rx="14" fill="#684e70" />
                  <rect x="241" y="132" width="20" height="3.5" rx="1.75" fill="#442f4b" />

                  {/* Annoyed X-shaped Stress Symbol */}
                  {annoyedMascot === "phone" && (
                    <g stroke="#6e546f" strokeWidth="2.2" strokeLinecap="round">
                      <line x1="208" y1="106" x2="216" y2="114" />
                      <line x1="216" y1="106" x2="208" y2="114" />
                    </g>
                  )}

                  {/* Face */}
                  <g
                    ref={phoneFaceRef}
                    data-face="phone"
                    style={{
                      transform: !isError
                        ? isChecking
                          ? "translate(5px, 4px)"
                          : entranceBeat
                          ? "translate(-3px, 0px)"
                          : isPasswordVisible
                          ? "translate(-4px, 0px)"
                          : isPasswordTyping
                          ? "translate(4.5px, 0px)"
                          : isPasswordEmpty
                          ? "translate(3px, 2px)"
                          : isEmail
                          ? "translate(4px, 0px)"
                          : isFieldError
                          ? "translate(4px, 0px)"
                          : isSuccess
                          ? "translate(-2px, -1px)"
                          : undefined
                        : undefined,
                    }}
                  >
                    {/* Eyes - Password Privacy Rules strictly enforced */}
                    {isPasswordVisible ? (
                      <g stroke="#fdfaf8" strokeWidth="1.8" strokeLinecap="round" fill="none">
                        <path d="M 233 158 Q 237 162 241 158" />
                        <path d="M 261 158 Q 265 162 269 158" />
                      </g>
                    ) : isError ? (
                      <g fill="#fdfaf8">
                        <circle cx="237" cy="164" r="3.2" />
                        <circle cx="265" cy="164" r="3.2" />
                      </g>
                    ) : annoyedMascot === "phone" ? (
                      <g stroke="#fdfaf8" strokeWidth="1.8" strokeLinecap="round" fill="none">
                        <line x1="233" y1="154" x2="241" y2="157" />
                        <line x1="269" y1="154" x2="261" y2="157" />
                        <circle cx="237" cy="160" r="2.4" fill="#fdfaf8" />
                        <circle cx="265" cy="160" r="2.4" fill="#fdfaf8" />
                      </g>
                    ) : pokedMascot === "phone" ? (
                      <g stroke="#fdfaf8" strokeWidth="1.8" strokeLinecap="round" fill="none">
                        <path d="M 233 160 L 241 160" />
                        <path d="M 261 160 L 269 160" />
                      </g>
                    ) : (
                      <g fill="#fdfaf8" className="blink-phone-idle">
                        <g ref={phoneLeftPupilRef} data-pupil="phone-left" style={{ willChange: "transform" }}>
                          <circle cx="237" cy="160" r="3.2" />
                        </g>
                        <g ref={phoneRightPupilRef} data-pupil="phone-right" style={{ willChange: "transform" }}>
                          <circle cx="265" cy="160" r="3.2" />
                        </g>
                      </g>
                    )}

                    {/* Mouth */}
                    {isSuccess || isPasswordVisible ? (
                      <path d="M 246 169 Q 251 174 256 169" stroke="#fdfaf8" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                    ) : isError ? (
                      <path d="M 246 174 Q 251 169 256 174" stroke="#fdfaf8" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                    ) : annoyedMascot === "phone" ? (
                      <line x1="248" y1="171" x2="254" y2="171" stroke="#fdfaf8" strokeWidth="2" strokeLinecap="round" />
                    ) : isPasswordEmpty || isFieldError || isChecking ? (
                      <line x1="247" y1="169" x2="255" y2="169" stroke="#fdfaf8" strokeWidth="2" strokeLinecap="round" />
                    ) : (
                      <circle cx="251" cy="169" r="1.8" stroke="#fdfaf8" strokeWidth="1.8" fill="none" />
                    )}
                  </g>
                </g>
              </g>
            </g>
          </g>

          {/* ========================================================= */}
          {/* 3. KEYBOARD MASCOT */}
          {/* ========================================================= */}
          <g className="anim-key-rise">
            <g
              tabIndex={0}
              role="button"
              aria-label="Poke keyboard mascot"
              onPointerDown={() => handlePoke("key")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handlePoke("key");
                }
              }}
              className="cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-[#6e546f] focus-visible:outline-offset-4 rounded-xl"
              style={{
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
                outline: "none",
                background: "transparent",
                filter: displayedSpeaker === "keyboard" ? "brightness(1.03)" : "none",
                transition: "filter 150ms ease-out",
              }}
            >
              {/* Inner Poke Animation Layer */}
              <g
                className={
                  pokedMascot === "key"
                    ? pokeType === "annoyed"
                      ? "anim-annoyed-shake"
                      : "anim-poke-key"
                    : ""
                }
                style={{ overflow: "visible" }}
              >
                {/* Cursor-Parallax Body Wrapper */}
                <g
                  ref={keyBodyRef}
                  data-mascot="keyboard"
                  className={`${isError ? "anim-sad-key" : ""} ${isSuccess ? "anim-key-rebound" : ""}`}
                  style={{
                    willChange: "transform",
                    transform:
                      !isError && !isEnteringState
                        ? isChecking
                          ? "rotate(1deg) translateY(2px)"
                          : isPasswordVisible
                          ? "translateY(3px)"
                          : isPasswordTyping
                          ? "translateY(-2.5px)"
                          : isPasswordEmpty
                          ? "rotate(1.5deg)"
                          : isEmail
                          ? "rotate(-1deg)"
                          : isSuccess
                          ? "translateY(-4px)"
                          : undefined
                        : undefined,
                    transformOrigin: "145px 282px",
                  }}
                >
                  <g transform="skewX(-4)">
                    <rect x="55" y="210" width="180" height="72" rx="15" fill="#7d4e5d" />
                    <rect x="58" y="205" width="174" height="69" rx="13" fill="url(#keyGrad)" stroke="#d2a0b0" strokeWidth="1.5" />
                    <rect x="64" y="210" width="162" height="59" rx="10" fill="#b17f90" />
                    
                    <g fill="#9f6d7e" opacity="0.6">
                      <rect x="70" y="215" width="20" height="13" rx="3.5" />
                      <rect x="94" y="215" width="20" height="13" rx="3.5" />
                      <rect x="180" y="215" width="20" height="13" rx="3.5" />
                      <rect x="204" y="215" width="20" height="13" rx="3.5" />
                      <rect x="70" y="250" width="24" height="13" rx="3.5" />
                      <rect x="200" y="250" width="24" height="13" rx="3.5" />
                    </g>

                    {/* Annoyed X-shaped Stress Symbol */}
                    {annoyedMascot === "key" && (
                      <g stroke="#6e546f" strokeWidth="2.2" strokeLinecap="round">
                        <line x1="52" y1="194" x2="60" y2="202" />
                        <line x1="60" y1="194" x2="52" y2="202" />
                      </g>
                    )}

                    {/* Face */}
                    <g
                      ref={keyFaceRef}
                      data-face="keyboard"
                      style={{
                        transform: !isError
                          ? isChecking
                            ? "translate(5px, 3px)"
                            : isPasswordVisible
                            ? "translate(-2px, 3px)"
                            : isPasswordTyping
                            ? "translate(3.5px, -1.5px)"
                            : isPasswordEmpty
                            ? "translate(3px, 2px)"
                            : isEmail
                            ? "translate(4px, 0px)"
                            : isFieldError
                            ? "translate(4px, 0px)"
                            : isSuccess
                            ? "translate(2px, -1px)"
                            : undefined
                          : undefined,
                      }}
                    >
                      {/* Eyes - Password Privacy Rules strictly enforced */}
                      {isPasswordVisible ? (
                        <g stroke="#fdfaf8" strokeWidth="1.8" strokeLinecap="round" fill="none">
                          <path d="M 121 233 Q 125 237 129 233" />
                          <path d="M 159 233 Q 163 237 167 233" />
                        </g>
                      ) : isError ? (
                        <g fill="#fdfaf8">
                          <circle cx="125" cy="239" r="3.2" />
                          <circle cx="163" cy="239" r="3.2" />
                        </g>
                      ) : annoyedMascot === "key" ? (
                        <g stroke="#fdfaf8" strokeWidth="1.8" strokeLinecap="round" fill="none">
                          <line x1="121" y1="229" x2="129" y2="232" />
                          <line x1="167" y1="229" x2="159" y2="232" />
                          <circle cx="125" cy="235" r="2.4" fill="#fdfaf8" />
                          <circle cx="163" cy="235" r="2.4" fill="#fdfaf8" />
                        </g>
                      ) : pokedMascot === "key" ? (
                        <g stroke="#fdfaf8" strokeWidth="1.8" strokeLinecap="round" fill="none">
                          <line x1="121" y1="235" x2="129" y2="235" />
                          <line x1="159" y1="235" x2="167" y2="235" />
                        </g>
                      ) : (
                        <g fill="#fdfaf8" className="blink-key-idle">
                          <g ref={keyLeftPupilRef} data-pupil="key-left" style={{ willChange: "transform" }}>
                            <circle cx="125" cy="235" r="3.2" />
                          </g>
                          <g ref={keyRightPupilRef} data-pupil="key-right" style={{ willChange: "transform" }}>
                            <circle cx="163" cy="235" r="3.2" />
                          </g>
                        </g>
                      )}

                      {/* Mouth */}
                      {isSuccess || isPasswordVisible ? (
                        <path d="M 139 243 Q 144 248 149 243" stroke="#fdfaf8" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                      ) : isError ? (
                        <path d="M 139 248 Q 144 243 149 248" stroke="#fdfaf8" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                      ) : annoyedMascot === "key" ? (
                        <line x1="141" y1="245" x2="147" y2="245" stroke="#fdfaf8" strokeWidth="2" strokeLinecap="round" />
                      ) : isPasswordTyping ? (
                        <ellipse cx="144" cy="243" rx="2.5" ry="1.8" stroke="#fdfaf8" strokeWidth="1.8" fill="none" />
                      ) : isPasswordEmpty || isFieldError || isChecking ? (
                        <line x1="140" y1="243" x2="148" y2="243" stroke="#fdfaf8" strokeWidth="2" strokeLinecap="round" />
                      ) : (
                        <path d="M 139 243 Q 144 248 149 243" stroke="#fdfaf8" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                      )}
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>

          {/* ========================================================= */}
          {/* 4. GAME CONTROLLER MASCOT */}
          {/* ========================================================= */}
          <g className="anim-ctrl-peek">
            <g
              tabIndex={0}
              role="button"
              aria-label="Poke controller mascot"
              onPointerDown={() => handlePoke("ctrl")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handlePoke("ctrl");
                }
              }}
              className="cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-[#6e546f] focus-visible:outline-offset-4 rounded-xl"
              style={{
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
                outline: "none",
                background: "transparent",
                filter: displayedSpeaker === "controller" ? "brightness(1.03)" : "none",
                transition: "filter 150ms ease-out",
              }}
            >
              {/* Inner Poke Animation Layer */}
              <g
                className={
                  pokedMascot === "ctrl"
                    ? pokeType === "annoyed"
                      ? "anim-annoyed-shake"
                      : "anim-poke-ctrl"
                    : ""
                }
                style={{ overflow: "visible" }}
              >
                {/* Cursor-Parallax Body Wrapper */}
                <g
                  ref={ctrlBodyRef}
                  data-mascot="controller"
                  className={isError ? "anim-sad-ctrl" : ""}
                  style={{
                    willChange: "transform",
                    transform:
                      !isError && !isEnteringState
                        ? isChecking
                          ? "rotate(2deg) translateY(2px)"
                          : isPasswordVisible
                          ? "rotate(3.5deg)"
                          : isPasswordTyping
                          ? "translateY(-2.5px)"
                          : isPasswordEmpty
                          ? "rotate(2deg)"
                          : isEmail
                          ? "rotate(2.5deg) translateX(3px)"
                          : isSuccess
                          ? "rotate(-2deg) translateY(-3px)"
                          : undefined
                        : undefined,
                    transformOrigin: "300px 238px",
                  }}
                >
                  <path
                    d="M 245 200 C 230 200 220 212 220 230 C 220 252 230 278 245 278 C 255 278 265 264 275 250 Q 300 250 325 250 C 335 264 345 278 355 278 C 370 278 380 252 380 230 C 380 212 370 200 355 200 C 330 196 270 196 245 200 Z"
                    fill="url(#ctrlGrad)"
                    stroke="#7f5d8c"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 248 205 C 235 205 226 215 226 230 C 226 248 234 271 245 271 C 253 271 262 258 272 245 Q 300 245 328 245 C 338 258 347 271 355 271 C 366 271 374 248 374 230 C 374 215 365 205 352 205 C 330 201 270 201 248 205 Z"
                    fill="#4a3054"
                  />

                  <rect x="238" y="228" width="12" height="12" rx="3" fill="#2b1832" />
                  <circle cx="352" cy="229" r="3.5" fill="#9d7eb0" />
                  <circle cx="361" cy="236" r="3.5" fill="#9d7eb0" />

                  {/* Annoyed X-shaped Stress Symbol */}
                  {annoyedMascot === "ctrl" && (
                    <g stroke="#6e546f" strokeWidth="2.2" strokeLinecap="round">
                      <line x1="236" y1="188" x2="244" y2="196" />
                      <line x1="244" y1="188" x2="236" y2="196" />
                    </g>
                  )}

                  {/* Face */}
                  <g
                    ref={ctrlFaceRef}
                    data-face="controller"
                    style={{
                      transform: !isError
                        ? isChecking
                          ? "translate(4px, 3px)"
                          : entranceBeat
                          ? "translate(-3px, -1px)"
                          : isPasswordVisible
                          ? "translate(4px, 0px)"
                          : isPasswordTyping
                          ? "translate(-2px, 0px)"
                          : isPasswordEmpty
                          ? "translate(3px, 2px)"
                          : isEmail
                          ? "translate(4px, 0px)"
                          : isFieldError
                          ? "translate(4px, 0px)"
                          : isSuccess
                          ? "translate(-2px, -1px)"
                          : undefined
                        : undefined,
                    }}
                  >
                    {/* Eyes - Password Privacy Rules strictly enforced */}
                    {isPasswordVisible ? (
                      <g stroke="#fdfaf8" strokeWidth="1.8" strokeLinecap="round" fill="none">
                        <path d="M 279 228 Q 283 232 287 228" />
                        <path d="M 313 228 Q 317 232 321 228" />
                      </g>
                    ) : isError ? (
                      <g fill="#fdfaf8">
                        <circle cx="283" cy="234" r="3.2" />
                        <circle cx="317" cy="234" r="3.2" />
                      </g>
                    ) : annoyedMascot === "ctrl" ? (
                      <g stroke="#fdfaf8" strokeWidth="1.8" strokeLinecap="round" fill="none">
                        <line x1="279" y1="224" x2="287" y2="227" />
                        <line x1="321" y1="224" x2="313" y2="227" />
                        <circle cx="283" cy="230" r="2.4" fill="#fdfaf8" />
                        <circle cx="317" cy="230" r="2.4" fill="#fdfaf8" />
                      </g>
                    ) : (
                      <g fill="#fdfaf8" className="blink-ctrl-idle">
                        <g ref={ctrlLeftPupilRef} data-pupil="ctrl-left" style={{ willChange: "transform" }}>
                          <circle cx="283" cy="230" r="3.2" />
                        </g>
                        <g ref={ctrlRightPupilRef} data-pupil="ctrl-right" style={{ willChange: "transform" }}>
                          <circle cx="317" cy="230" r="3.2" />
                        </g>
                      </g>
                    )}

                    {/* Mouth */}
                    {isSuccess || isPasswordVisible ? (
                      <path d="M 294 238 Q 300 243 306 238" stroke="#fdfaf8" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                    ) : isError ? (
                      <path d="M 294 243 Q 300 238 306 243" stroke="#fdfaf8" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                    ) : annoyedMascot === "ctrl" ? (
                      <line x1="296" y1="240" x2="304" y2="240" stroke="#fdfaf8" strokeWidth="2" strokeLinecap="round" />
                    ) : pokedMascot === "ctrl" ? (
                      <path d="M 293 237 Q 300 244 307 237" stroke="#fdfaf8" strokeWidth="2.4" strokeLinecap="round" fill="none" />
                    ) : isPasswordEmpty || isFieldError || isChecking ? (
                      <line x1="296" y1="238" x2="304" y2="238" stroke="#fdfaf8" strokeWidth="2" strokeLinecap="round" />
                    ) : (
                      <circle cx="300" cy="238" r="1.6" stroke="#fdfaf8" strokeWidth="1.8" fill="none" />
                    )}
                  </g>
                </g>
              </g>
            </g>
          </g>

        </g>
      </svg>
    </div>
  );
}
