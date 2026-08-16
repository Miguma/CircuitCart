"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  Check,
  CircleAlert,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CircuitCartWordmark } from "@/components/ui/circuitcart-wordmark";
import { MascotState } from "@/components/login/tech-characters";

const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Full name must be at least 2 characters"),
    email: z
      .string()
      .min(1, "Email address is required")
      .email("Please enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-zA-Z]/, "Password must contain at least one letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    terms: z.boolean().refine((val) => val === true, {
      message: "You must accept the terms and privacy policy",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onStateChange: (state: MascotState, customMessage?: string) => void;
}

export function RegisterForm({ onStateChange }: RegisterFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [isSubmittingState, setIsSubmittingState] = useState(false);
  const [formHasSubmittedError, setFormHasSubmittedError] = useState(false);
  const [activeFocus, setActiveFocus] = useState<
    "fullName" | "email" | "password" | "confirmPassword" | "terms" | null
  >(null);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const [passwordValue, setPasswordValue] = useState("");
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");

  const {
    register,
    handleSubmit,
    clearErrors,
    getValues,
    control,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  });

  const watchFullName = useWatch({ control, name: "fullName" });
  const watchEmail = useWatch({ control, name: "email" });
  const watchTerms = useWatch({ control, name: "terms" });

  const markTouched = (field: string) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  // Field validity checks
  const isValidFullName = (watchFullName?.length ?? 0) >= 2;
  const isValidEmail = !!watchEmail && z.string().email().safeParse(watchEmail).success;

  // Live password requirement checklist
  const hasMinLen = passwordValue.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(passwordValue);
  const hasNumber = /[0-9]/.test(passwordValue);
  const isPasswordValid = hasMinLen && hasLetter && hasNumber;

  // Confirm password match status
  const confirmHasTyped = confirmPasswordValue.length > 0;
  const isConfirmMatching = confirmHasTyped && confirmPasswordValue === passwordValue;

  // Overall form validity check for button enabling
  const isFormValid =
    isValidFullName &&
    isValidEmail &&
    isPasswordValid &&
    isConfirmMatching &&
    watchTerms === true;

  // Mascot speech message according to priority
  const isPassVisible = showPassword || showConfirmPassword;

  const getRegistrationMessage = () => {
    if (isSuccessState) return "Welcome to CircuitCart!";
    if (isSubmittingState) return "Creating your account…";
    if (formHasSubmittedError) return "Let’s check that again.";
    if (isPassVisible) return "We’re looking away.";
    if (activeFocus === "password") return "Is that a secret?";
    if (activeFocus === "confirmPassword") return "One more time.";
    if (activeFocus === "fullName") return "What should we call you?";
    if (activeFocus === "email") return "Looking good so far.";
    if (activeFocus === "terms") return "Almost there!";
    return "Ready to join CircuitCart?";
  };

  const currentRegistrationMessage = getRegistrationMessage();

  // Sync mascot state & registration speech message
  useEffect(() => {
    if (isSuccessState) {
      onStateChange("success", currentRegistrationMessage);
      return;
    }
    if (isSubmittingState) {
      onStateChange("checking", currentRegistrationMessage);
      return;
    }
    if (formHasSubmittedError) {
      onStateChange("error", currentRegistrationMessage);
      return;
    }

    if (isPassVisible) {
      onStateChange("password-visible", currentRegistrationMessage);
      return;
    }

    if (activeFocus === "password" || activeFocus === "confirmPassword") {
      const val = activeFocus === "password" ? passwordValue : confirmPasswordValue;
      if (val && val.length > 0) {
        onStateChange("password-typing", currentRegistrationMessage);
      } else {
        onStateChange("password-empty", currentRegistrationMessage);
      }
      return;
    }

    if (activeFocus === "email" || activeFocus === "fullName" || activeFocus === "terms") {
      onStateChange("email", currentRegistrationMessage);
      return;
    }

    onStateChange("idle", currentRegistrationMessage);
  }, [
    isPassVisible,
    activeFocus,
    passwordValue,
    confirmPasswordValue,
    isSubmittingState,
    isSuccessState,
    formHasSubmittedError,
    currentRegistrationMessage,
    onStateChange,
  ]);

  const fullNameRegister = register("fullName", {
    onChange: () => {
      setFormHasSubmittedError(false);
      clearErrors("fullName");
    },
  });

  const emailRegister = register("email", {
    onChange: (e) => {
      setFormHasSubmittedError(false);
      if (e.target.value && z.string().email().safeParse(e.target.value).success) {
        clearErrors("email");
      }
    },
  });

  const passwordRegister = register("password", {
    onChange: (e) => {
      setFormHasSubmittedError(false);
      const val = e.target.value;
      setPasswordValue(val);
      if (val.length >= 8 && /[a-zA-Z]/.test(val) && /[0-9]/.test(val)) {
        clearErrors("password");
      }
    },
  });

  const confirmPasswordRegister = register("confirmPassword", {
    onChange: (e) => {
      setFormHasSubmittedError(false);
      const val = e.target.value;
      setConfirmPasswordValue(val);
      if (val === getValues("password")) {
        clearErrors("confirmPassword");
      }
    },
  });

  const termsRegister = register("terms", {
    onChange: (e) => {
      setFormHasSubmittedError(false);
      if (e.target.checked) clearErrors("terms");
    },
  });

  const onSubmit = async () => {
    setFormHasSubmittedError(false);
    setIsSubmittingState(true);
    onStateChange("checking");

    setTimeout(() => {
      setIsSubmittingState(false);
      setIsSuccessState(true);
      onStateChange("success");

      setTimeout(() => {
        router.push("/marketplace");
      }, 600);
    }, 1000);
  };

  const onInvalidSubmit = () => {
    setFormHasSubmittedError(true);
    onStateChange("field-error");
    setTimeout(() => {
      setFormHasSubmittedError(false);
    }, 2500);
  };

  return (
    <div className="w-full max-w-[440px] mx-auto px-4 sm:px-2">
      {/* Quiet Back to Showcase Link - Completely visible and unclipped */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors mb-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 rounded-sm"
      >
        <ArrowLeft className="size-4" />
        Back to showcase
      </Link>

      {/* Header section */}
      <div className="mb-4">
        <div className="mb-2">
          <CircuitCartWordmark />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1d1720] leading-tight">
          Create your account
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[#716872] leading-relaxed">
          One account for buying. Seller access comes after verification.
        </p>
      </div>

      {/* Hidden ARIA announcement for custom mascot message */}
      <div aria-live="polite" className="sr-only">
        {currentRegistrationMessage}
      </div>

      {/* Form using exact 20px vertical gap system */}
      <form onSubmit={handleSubmit(onSubmit, onInvalidSubmit)} className="flex flex-col gap-[20px]" noValidate>
        {/* Full Name Field Group (6px gap between label and input) */}
        <div className="flex flex-col gap-[6px]">
          <Label htmlFor="fullName" className="text-xs sm:text-sm font-semibold text-[#1d1720]">
            Full name
          </Label>
          <div className="relative">
            <Input
              id="fullName"
              type="text"
              placeholder="Jane Doe"
              autoComplete="name"
              disabled={isSubmittingState || isSuccessState}
              {...fullNameRegister}
              onFocus={() => setActiveFocus("fullName")}
              onBlur={(e) => {
                markTouched("fullName");
                setActiveFocus(null);
                fullNameRegister.onBlur(e);
              }}
              className={`h-[44px] text-sm pl-3.5 pr-10 bg-white rounded-xl transition-all ${
                (touchedFields.fullName || errors.fullName) && !isValidFullName
                  ? "border border-[#cf6679] focus-visible:border-[#cf6679] focus-visible:ring-3 focus-visible:ring-[#cf6679]/20"
                  : "border border-[#dfd3d7] focus-visible:border-[#6e546f] focus-visible:ring-3 focus-visible:ring-[#6e546f]/20"
              }`}
              aria-invalid={(touchedFields.fullName || errors.fullName) && !isValidFullName}
              aria-describedby={errors.fullName ? "fullName-error" : undefined}
            />
            {touchedFields.fullName && isValidFullName && (
              <CheckCircle2 className="size-4 text-[#6e546f] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none animate-in fade-in zoom-in-90 duration-140" />
            )}
          </div>
          {(touchedFields.fullName || errors.fullName) && !isValidFullName && (
            <div id="fullName-error" className="flex items-center gap-1 text-xs text-[#b3261e] font-medium pt-0.5">
              <CircleAlert className="size-3.5 shrink-0" />
              <span>Full name must be at least 2 characters</span>
            </div>
          )}
        </div>

        {/* Email Address Field Group (6px gap between label and input) */}
        <div className="flex flex-col gap-[6px]">
          <Label htmlFor="email" className="text-xs sm:text-sm font-semibold text-[#1d1720]">
            Email address
          </Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              disabled={isSubmittingState || isSuccessState}
              {...emailRegister}
              onFocus={() => setActiveFocus("email")}
              onBlur={(e) => {
                markTouched("email");
                setActiveFocus(null);
                emailRegister.onBlur(e);
              }}
              className={`h-[44px] text-sm pl-3.5 pr-10 bg-white rounded-xl transition-all ${
                (touchedFields.email || errors.email) && !isValidEmail
                  ? "border border-[#cf6679] focus-visible:border-[#cf6679] focus-visible:ring-3 focus-visible:ring-[#cf6679]/20"
                  : "border border-[#dfd3d7] focus-visible:border-[#6e546f] focus-visible:ring-3 focus-visible:ring-[#6e546f]/20"
              }`}
              aria-invalid={(touchedFields.email || errors.email) && !isValidEmail}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {touchedFields.email && isValidEmail && (
              <CheckCircle2 className="size-4 text-[#6e546f] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none animate-in fade-in zoom-in-90 duration-140" />
            )}
          </div>
          {(touchedFields.email || errors.email) && !isValidEmail && (
            <div id="email-error" className="flex items-center gap-1 text-xs text-[#b3261e] font-medium pt-0.5">
              <CircleAlert className="size-3.5 shrink-0" />
              <span>Please enter a valid email address</span>
            </div>
          )}
        </div>

        {/* Password Field Group */}
        <div className="flex flex-col gap-[6px]">
          <Label htmlFor="password" className="text-xs sm:text-sm font-semibold text-[#1d1720]">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={isSubmittingState || isSuccessState}
              {...passwordRegister}
              onFocus={() => setActiveFocus("password")}
              onBlur={(e) => {
                markTouched("password");
                setActiveFocus(null);
                passwordRegister.onBlur(e);
              }}
              className={`h-[44px] text-sm pl-3.5 pr-11 bg-white rounded-xl transition-all ${
                errors.password
                  ? "border border-[#cf6679] focus-visible:border-[#cf6679] focus-visible:ring-3 focus-visible:ring-[#cf6679]/20"
                  : "border border-[#dfd3d7] focus-visible:border-[#6e546f] focus-visible:ring-3 focus-visible:ring-[#6e546f]/20"
              }`}
              aria-invalid={!!errors.password}
              aria-describedby="password-checklist password-error"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => setShowPassword((prev) => !prev)}
              tabIndex={0}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-[#6e546f] rounded-xs p-1"
            >
              {showPassword ? (
                <EyeOff className="size-4.5" />
              ) : (
                <Eye className="size-4.5" />
              )}
            </button>
          </div>

          {/* Password Requirements Checklist (8px gap from input, 4px between items) */}
          <div id="password-checklist" aria-live="polite" className="mt-[2px] text-xs text-[#716872] flex flex-col gap-[4px]">
            <div
              className={`flex items-center gap-1.5 transition-colors duration-140 ${
                hasMinLen
                  ? "text-[#6e546f] font-medium"
                  : errors.password && passwordValue.length > 0
                  ? "text-[#b3261e]"
                  : "text-[#716872]"
              }`}
            >
              {hasMinLen ? (
                <Check className="size-3.5 text-[#6e546f] shrink-0 stroke-[2.5] animate-in fade-in zoom-in-90 duration-140" />
              ) : (
                <div className={`size-3 rounded-full border shrink-0 ${errors.password ? "border-[#b3261e]" : "border-zinc-400"}`} />
              )}
              <span>At least eight characters</span>
            </div>

            <div
              className={`flex items-center gap-1.5 transition-colors duration-140 ${
                hasLetter
                  ? "text-[#6e546f] font-medium"
                  : errors.password && passwordValue.length > 0
                  ? "text-[#b3261e]"
                  : "text-[#716872]"
              }`}
            >
              {hasLetter ? (
                <Check className="size-3.5 text-[#6e546f] shrink-0 stroke-[2.5] animate-in fade-in zoom-in-90 duration-140" />
              ) : (
                <div className={`size-3 rounded-full border shrink-0 ${errors.password ? "border-[#b3261e]" : "border-zinc-400"}`} />
              )}
              <span>Contains a letter</span>
            </div>

            <div
              className={`flex items-center gap-1.5 transition-colors duration-140 ${
                hasNumber
                  ? "text-[#6e546f] font-medium"
                  : errors.password && passwordValue.length > 0
                  ? "text-[#b3261e]"
                  : "text-[#716872]"
              }`}
            >
              {hasNumber ? (
                <Check className="size-3.5 text-[#6e546f] shrink-0 stroke-[2.5] animate-in fade-in zoom-in-90 duration-140" />
              ) : (
                <div className={`size-3 rounded-full border shrink-0 ${errors.password ? "border-[#b3261e]" : "border-zinc-400"}`} />
              )}
              <span>Contains a number</span>
            </div>
          </div>
        </div>

        {/* Confirm Password Field Group (18px gap from checklist -> label) */}
        <div className="flex flex-col gap-[6px] -mt-[2px]">
          <Label htmlFor="confirmPassword" className="text-xs sm:text-sm font-semibold text-[#1d1720]">
            Confirm password
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={isSubmittingState || isSuccessState}
              {...confirmPasswordRegister}
              onFocus={() => setActiveFocus("confirmPassword")}
              onBlur={(e) => {
                markTouched("confirmPassword");
                setActiveFocus(null);
                confirmPasswordRegister.onBlur(e);
              }}
              className={`h-[44px] text-sm pl-3.5 pr-11 bg-white rounded-xl transition-all ${
                confirmHasTyped && !isConfirmMatching
                  ? "border border-[#cf6679] focus-visible:border-[#cf6679] focus-visible:ring-3 focus-visible:ring-[#cf6679]/20"
                  : "border border-[#dfd3d7] focus-visible:border-[#6e546f] focus-visible:ring-3 focus-visible:ring-[#6e546f]/20"
              }`}
              aria-invalid={confirmHasTyped && !isConfirmMatching}
              aria-describedby="confirmPassword-feedback"
            />
            <button
              type="button"
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              aria-pressed={showConfirmPassword}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              tabIndex={0}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-[#6e546f] rounded-xs p-1"
            >
              {showConfirmPassword ? (
                <EyeOff className="size-4.5" />
              ) : (
                <Eye className="size-4.5" />
              )}
            </button>
          </div>

          {/* Confirm Password State-driven Feedback */}
          {confirmHasTyped && (
            <div id="confirmPassword-feedback" className="pt-0.5">
              {isConfirmMatching ? (
                <div className="flex items-center gap-1 text-xs text-[#6e546f] font-medium">
                  <CheckCircle2 className="size-3.5 text-[#6e546f] shrink-0" />
                  <span>Passwords match</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs text-[#b3261e] font-medium">
                  <CircleAlert className="size-3.5 shrink-0" />
                  <span>Passwords do not match</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Terms and Privacy Row Group (20px gap controlled by parent) */}
        <div className="flex flex-col gap-[4px]">
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="terms"
              disabled={isSubmittingState || isSuccessState}
              {...termsRegister}
              onFocus={() => setActiveFocus("terms")}
              onBlur={() => setActiveFocus(null)}
              className="size-[18px] rounded-md border-[#dfd3d7] text-[#201524] focus-visible:ring-2 focus-visible:ring-[#6e546f]/30"
            />
            <Label htmlFor="terms" className="text-xs font-normal text-[#716872] leading-snug cursor-pointer select-none">
              I agree to the{" "}
              <button
                type="button"
                onClick={() => alert("Terms of Service document coming soon.")}
                className="font-semibold text-[#6e546f] hover:underline focus-visible:outline-2 focus-visible:outline-[#6e546f] rounded-xs inline"
              >
                Terms of Service
              </button>{" "}
              and{" "}
              <button
                type="button"
                onClick={() => alert("Privacy Policy document coming soon.")}
                className="font-semibold text-[#6e546f] hover:underline focus-visible:outline-2 focus-visible:outline-[#6e546f] rounded-xs inline"
              >
                Privacy Policy
              </button>
            </Label>
          </div>
          {errors.terms && (
            <div className="flex items-center gap-1 text-xs text-[#b3261e] font-medium pt-0.5">
              <CircleAlert className="size-3.5 shrink-0" />
              <span>{errors.terms.message}</span>
            </div>
          )}
        </div>

        {/* Primary Create Account Button (Disabled: ~35-40% aubergine, cursor: not-allowed; Enabled: 100% aubergine + 1px hover translation) */}
        <Button
          type="submit"
          disabled={!isFormValid || isSubmittingState || isSuccessState}
          className="w-full h-[46px] text-base font-semibold bg-[#201524] text-white hover:bg-[#34253a] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-140 rounded-xl shadow-xs focus-visible:ring-3 focus-visible:ring-[#6e546f]/30 disabled:bg-[#201524]/38 disabled:text-[#fffafa]/78 disabled:cursor-not-allowed disabled:transform-none disabled:opacity-100"
        >
          {isSuccessState ? (
            <span className="flex items-center justify-center gap-2">
              <Check className="size-5 text-emerald-400" />
              Account created
            </span>
          ) : isSubmittingState ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-5 animate-spin text-white" />
              Creating account…
            </span>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      {/* Footer Link pointing to /login (14px gap from button) */}
      <div className="mt-[14px] text-center text-xs text-[#716872]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-bold text-[#6e546f] hover:underline focus-visible:outline-2 focus-visible:outline-[#6e546f] rounded-xs"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}
