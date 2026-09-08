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
import { AuthPhase, FocusedField } from "@/components/login/tech-characters";
import { signUpWithEmail, resendConfirmationEmail } from "@/lib/supabase/auth";
import { toast } from "sonner";

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
  onAuthPhaseChange: (phase: AuthPhase) => void;
  onFocusChange: (field: FocusedField) => void;
  onPasswordVisibilityChange: (visible: boolean) => void;
  onPasswordLengthChange: (length: number) => void;
}

export function RegisterForm({
  onAuthPhaseChange,
  onFocusChange,
  onPasswordVisibilityChange,
  onPasswordLengthChange,
}: RegisterFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [isSubmittingState, setIsSubmittingState] = useState(false);
  const [confirmationRequiredState, setConfirmationRequiredState] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [isConfirmationResending, setIsConfirmationResending] = useState(false);
  const [confirmationResentSuccess, setConfirmationResentSuccess] = useState(false);
  const [formHasSubmittedError, setFormHasSubmittedError] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const {
    register,
    handleSubmit,
    clearErrors,
    setValue,
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

  const watchFullName = useWatch({ control, name: "fullName" }) || "";
  const watchEmail = useWatch({ control, name: "email" }) || "";
  const watchPassword = useWatch({ control, name: "password" }) || "";
  const watchConfirmPassword = useWatch({ control, name: "confirmPassword" }) || "";
  const watchTerms = useWatch({ control, name: "terms" });

  const markTouched = (field: string) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  // Field validity checks
  const isValidFullName = watchFullName.trim().length >= 2;
  const isValidEmail = !!watchEmail && z.string().email().safeParse(watchEmail).success;

  // Live password requirement checklist
  const hasMinLen = watchPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(watchPassword);
  const hasNumber = /[0-9]/.test(watchPassword);
  const isPasswordValid = hasMinLen && hasLetter && hasNumber;

  // Confirm password match status
  const confirmHasTyped = watchConfirmPassword.length > 0;
  const isConfirmMatching = confirmHasTyped && watchConfirmPassword === watchPassword;

  // Overall form validity check for button enabling
  const isFormValid =
    isValidFullName &&
    isValidEmail &&
    isPasswordValid &&
    isConfirmMatching &&
    watchTerms === true;

  // Sync callbacks with local state
  const isPassVisible = showPassword || showConfirmPassword;

  useEffect(() => {
    onPasswordVisibilityChange(isPassVisible);
  }, [isPassVisible, onPasswordVisibilityChange]);

  useEffect(() => {
    onPasswordLengthChange(
      watchPassword.length > 0 ? watchPassword.length : watchConfirmPassword.length
    );
  }, [watchPassword, watchConfirmPassword, onPasswordLengthChange]);

  useEffect(() => {
    if (isSuccessState) {
      onAuthPhaseChange("success");
    } else if (isSubmittingState) {
      onAuthPhaseChange("checking");
    } else if (formHasSubmittedError || authError) {
      onAuthPhaseChange("error");
    } else {
      onAuthPhaseChange("idle");
    }
  }, [isSuccessState, isSubmittingState, formHasSubmittedError, authError, onAuthPhaseChange]);

  const fullNameRegister = register("fullName", {
    onChange: () => {
      setFormHasSubmittedError(false);
      setAuthError(null);
      clearErrors("fullName");
    },
  });

  const emailRegister = register("email", {
    onChange: (e) => {
      setFormHasSubmittedError(false);
      setAuthError(null);
      if (e.target.value && z.string().email().safeParse(e.target.value).success) {
        clearErrors("email");
      }
    },
  });

  const passwordRegister = register("password", {
    onChange: (e) => {
      setFormHasSubmittedError(false);
      setAuthError(null);
      const val = e.target.value;
      if (val.length >= 8 && /[a-zA-Z]/.test(val) && /[0-9]/.test(val)) {
        clearErrors("password");
      }
    },
  });

  const confirmPasswordRegister = register("confirmPassword", {
    onChange: (e) => {
      setFormHasSubmittedError(false);
      setAuthError(null);
      const val = e.target.value;
      if (val === watchPassword) {
        clearErrors("confirmPassword");
      }
    },
  });

  const handleResendRegistrationConfirmation = async () => {
    if (!registeredEmail) return;
    setIsConfirmationResending(true);
    setConfirmationResentSuccess(false);
    try {
      const res = await resendConfirmationEmail(registeredEmail);
      setIsConfirmationResending(false);
      if (res.success) {
        setConfirmationResentSuccess(true);
        toast.success("Confirmation email resent. Check your inbox.");
      } else {
        toast.error(res.error || "Failed to resend confirmation email.");
      }
    } catch {
      setIsConfirmationResending(false);
      toast.error("Failed to resend confirmation email.");
    }
  };

  const onSubmit = async (data: RegisterFormData) => {
    setFormHasSubmittedError(false);
    setAuthError(null);
    setIsSubmittingState(true);

    try {
      const res = await signUpWithEmail(data.email, data.password, data.fullName);

      if (res.success) {
        setIsSubmittingState(false);

        if (res.data?.sessionExists) {
          setIsSuccessState(true);
          setTimeout(() => {
            router.push("/marketplace");
            router.refresh();
          }, 600);
        } else {
          setRegisteredEmail(data.email);
          setConfirmationRequiredState(true);
          toast.success("Account created! Please check your email to confirm your account.");
        }
      } else {
        setIsSubmittingState(false);
        setAuthError(res.error || "Failed to create account. Please try again.");
      }
    } catch {
      setIsSubmittingState(false);
      setAuthError("An unexpected error occurred. Please try again.");
    }
  };

  const onInvalidSubmit = () => {
    setFormHasSubmittedError(true);
  };

  if (confirmationRequiredState) {
    return (
      <div className="w-full max-w-[440px] mx-auto px-4 sm:px-2 animate-in fade-in duration-140">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors mb-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 rounded-sm"
        >
          <ArrowLeft className="size-4" />
          Back to showcase
        </Link>

        <div className="mb-4">
          <div className="mb-2">
            <CircuitCartWordmark />
          </div>

          <div className="flex items-center gap-3 mt-4">
            <div className="size-10 rounded-xl bg-[#6e546f]/10 border border-[#6e546f]/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-5 text-[#6e546f]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1d1720] leading-tight">
                Account created
              </h1>
              <p className="text-xs sm:text-sm text-[#716872] leading-relaxed">
                Confirm your email to get started.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#dfd3d7] shadow-xs flex flex-col gap-3 my-5">
          <p className="text-sm font-semibold text-[#1d1720] leading-snug">
            Account created. Check your email to confirm your account before logging in.
          </p>
          <p className="text-xs text-[#716872] leading-relaxed">
            We sent a confirmation link to <span className="font-semibold text-[#1d1720]">{registeredEmail}</span>. Please click the link to activate your CircuitCart account.
          </p>

          {confirmationResentSuccess && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800 font-medium">
              <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
              <span>Confirmation email resent. Please check your inbox.</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="w-full h-[46px] flex items-center justify-center text-sm font-semibold bg-[#201524] text-white hover:bg-[#34253a] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-140 rounded-xl shadow-xs focus-visible:ring-3 focus-visible:ring-[#6e546f]/30"
          >
            Go to login
          </Link>

          <Button
            type="button"
            variant="outline"
            disabled={isConfirmationResending}
            onClick={handleResendRegistrationConfirmation}
            className="w-full h-[44px] text-xs font-semibold text-[#6e546f] border-[#dfd3d7] hover:bg-[#f7f2f4] hover:text-[#201524] rounded-xl transition-all"
          >
            {isConfirmationResending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-[#6e546f]" />
                Resending…
              </span>
            ) : (
              "Resend confirmation email"
            )}
          </Button>
        </div>
      </div>
    );
  }

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

      {/* Auth Error Banner */}
      {authError && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-xl bg-[#cf6679]/10 border border-[#cf6679]/30 flex items-start gap-2.5 text-xs text-[#b3261e] font-medium animate-in fade-in zoom-in-95 duration-140"
        >
          <CircleAlert className="size-4 shrink-0 mt-0.5 text-[#b3261e]" />
          <span>{authError}</span>
        </div>
      )}

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
              onFocus={() => onFocusChange("name")}
              onBlur={(e) => {
                markTouched("fullName");
                onFocusChange(null);
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
              onFocus={() => onFocusChange("email")}
              onBlur={(e) => {
                markTouched("email");
                onFocusChange(null);
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
              onFocus={() => onFocusChange("password")}
              onBlur={(e) => {
                markTouched("password");
                onFocusChange(null);
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
                  : errors.password && watchPassword.length > 0
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
                  : errors.password && watchPassword.length > 0
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
                  : errors.password && watchPassword.length > 0
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
              onFocus={() => onFocusChange("confirmPassword")}
              onBlur={(e) => {
                markTouched("confirmPassword");
                onFocusChange(null);
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
              checked={watchTerms === true}
              onCheckedChange={(checked) => {
                setValue("terms", checked === true, {
                  shouldValidate: true,
                  shouldDirty: true,
                  shouldTouch: true,
                });
                setFormHasSubmittedError(false);
                setAuthError(null);
                if (checked) clearErrors("terms");
              }}
              disabled={isSubmittingState || isSuccessState}
              onFocus={() => onFocusChange("terms")}
              onBlur={() => onFocusChange(null)}
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
