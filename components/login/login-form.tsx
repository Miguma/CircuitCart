"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  ShieldCheck,
  CheckCircle2,
  Store,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CircuitCartWordmark } from "@/components/ui/circuitcart-wordmark";
import { signInWithEmail, resendConfirmationEmail } from "@/lib/supabase/auth";
import { AuthPhase, FocusedField } from "./tech-characters";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email address is required")
    .email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onAuthPhaseChange: (phase: AuthPhase) => void;
  onFocusChange: (field: FocusedField) => void;
  onPasswordVisibilityChange: (visible: boolean) => void;
  onPasswordLengthChange: (length: number) => void;
}

export function LoginForm({
  onAuthPhaseChange,
  onFocusChange,
  onPasswordVisibilityChange,
  onPasswordLengthChange,
}: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isConfirmedParam = searchParams.get("confirmed") === "1";
  const isRegisteredParam = searchParams.get("registered") === "true";
  const isCallbackErrorParam = searchParams.get("error") === "auth_callback_failed";

  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isEmailNotConfirmed, setIsEmailNotConfirmed] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [passwordLength, setPasswordLength] = useState(0);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const {
    register,
    handleSubmit,
    clearErrors,
    control,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const watchEmail = useWatch({ control, name: "email" });
  const watchPassword = useWatch({ control, name: "password" });

  const markTouched = (field: string) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  const isValidEmail = !!watchEmail && z.string().email().safeParse(watchEmail).success;
  const isFilledPassword = (watchPassword?.length ?? 0) > 0;

  // Sync callbacks with local state
  useEffect(() => {
    onPasswordVisibilityChange(showPassword);
  }, [showPassword, onPasswordVisibilityChange]);

  useEffect(() => {
    onPasswordLengthChange(passwordLength);
  }, [passwordLength, onPasswordLengthChange]);

  useEffect(() => {
    if (isSuccessState) {
      onAuthPhaseChange("success");
    } else if (authError) {
      onAuthPhaseChange("error");
    } else if (isChecking) {
      onAuthPhaseChange("checking");
    } else {
      onAuthPhaseChange("idle");
    }
  }, [isSuccessState, authError, isChecking, onAuthPhaseChange]);

  // Immediate error clearance when editing either field
  const emailRegister = register("email", {
    onChange: (e) => {
      if (authError) {
        setAuthError(null);
        setIsEmailNotConfirmed(false);
        setResendSuccess(false);
      }
      if (e.target.value && z.string().email().safeParse(e.target.value).success) {
        clearErrors("email");
      }
    },
  });

  const passwordRegister = register("password", {
    onChange: (e) => {
      if (authError) {
        setAuthError(null);
        setIsEmailNotConfirmed(false);
        setResendSuccess(false);
      }
      const val = e.target.value;
      setPasswordLength(val ? val.length : 0);
      if (val) {
        clearErrors("password");
      }
    },
  });

  const handleResendConfirmation = async () => {
    const targetEmail = unconfirmedEmail || watchEmail;
    if (!targetEmail || !z.string().email().safeParse(targetEmail).success) {
      setAuthError("Please enter a valid email address to resend confirmation.");
      return;
    }

    setIsResending(true);
    setResendSuccess(false);

    try {
      const res = await resendConfirmationEmail(targetEmail);
      setIsResending(false);
      if (res.success) {
        setResendSuccess(true);
      } else {
        setAuthError(res.error || "Failed to resend confirmation email.");
      }
    } catch {
      setIsResending(false);
      setAuthError("Failed to resend confirmation email.");
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    setAuthError(null);
    setIsEmailNotConfirmed(false);
    setResendSuccess(false);
    setIsChecking(true);

    try {
      const res = await signInWithEmail(data.email, data.password);

      if (res.success) {
        setIsChecking(false);
        setIsSuccessState(true);
        setTimeout(() => {
          const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
          const redirectTo = params?.get("redirectTo") || "/marketplace";
          router.push(redirectTo);
          router.refresh();
        }, 600);
      } else {
        setIsChecking(false);
        if (res.isEmailNotConfirmed) {
          setIsEmailNotConfirmed(true);
          setUnconfirmedEmail(data.email);
          setAuthError(res.error || "Your email address hasn’t been confirmed yet.");
        } else {
          setIsEmailNotConfirmed(false);
          setAuthError(res.error || "Incorrect email or password.");
        }
      }
    } catch {
      setIsChecking(false);
      setIsEmailNotConfirmed(false);
      setAuthError("An unexpected error occurred. Please try again.");
    }
  };

  const onInvalidSubmit = () => {
    // Native or react-hook-form validation handles focus
  };

  return (
    <div className="w-full max-w-[440px] mx-auto px-4 py-2 sm:px-2">
      {/* Quiet Back to Showcase Link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors mb-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 rounded-sm"
      >
        <ArrowLeft className="size-4" />
        Back to showcase
      </Link>

      {/* Header section */}
      <div className="mb-5">
        <div className="mb-3">
          <CircuitCartWordmark />
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1d1720] leading-tight">
          Welcome back
        </h1>
        <p className="mt-1.5 text-sm text-[#716872] leading-relaxed">
          Sign in to continue to your CircuitCart account.
        </p>
      </div>

      {/* Confirmation & Callback Status Banners */}
      {isConfirmedParam && (
        <div
          role="status"
          className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800 font-medium animate-in fade-in zoom-in-95 duration-140"
        >
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <span>Email confirmed. You can log in now.</span>
        </div>
      )}

      {isRegisteredParam && !isConfirmedParam && (
        <div
          role="status"
          className="mb-4 p-3 rounded-xl bg-[#6e546f]/10 border border-[#6e546f]/30 flex items-center gap-2.5 text-xs text-[#201524] font-medium animate-in fade-in zoom-in-95 duration-140"
        >
          <CheckCircle2 className="size-4 text-[#6e546f] shrink-0" />
          <span>Account created. Please check your email to confirm your account.</span>
        </div>
      )}

      {isCallbackErrorParam && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-xl bg-[#cf6679]/10 border border-[#cf6679]/30 flex items-start gap-2.5 text-xs text-[#b3261e] font-medium animate-in fade-in zoom-in-95 duration-140"
        >
          <CircleAlert className="size-4 text-[#b3261e] shrink-0 mt-0.5" />
          <span>Confirmation link was invalid or expired. Please sign in or resend a new confirmation email.</span>
        </div>
      )}

      {/* Form with compact rhythm */}
      <form onSubmit={handleSubmit(onSubmit, onInvalidSubmit)} className="flex flex-col gap-4" noValidate>
        {/* Email Field Group */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-sm font-semibold text-[#1d1720]">
            Email address
          </Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              disabled={isChecking || isSuccessState}
              {...emailRegister}
              onFocus={() => {
                onFocusChange("email");
                if (authError) setAuthError(null);
              }}
              onBlur={(e) => {
                markTouched("email");
                onFocusChange(null);
                emailRegister.onBlur(e);
              }}
              className={`h-[48px] text-base pl-4 pr-10 bg-white rounded-xl transition-all ${
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
              <span>{errors.email?.message || "Please enter a valid email address"}</span>
            </div>
          )}
        </div>

        {/* Password Field Group */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-semibold text-[#1d1720]">
              Password
            </Label>
            <Link
              href="/login#forgot"
              className="text-xs font-medium text-[#6e546f] hover:text-[#1d1720] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#6e546f] rounded-xs"
              onClick={(e) => {
                e.preventDefault();
                alert("Password reset is coming in a future step.");
              }}
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isChecking || isSuccessState}
              {...passwordRegister}
              onFocus={() => {
                onFocusChange("password");
                if (authError) setAuthError(null);
              }}
              onBlur={(e) => {
                markTouched("password");
                onFocusChange(null);
                passwordRegister.onBlur(e);
              }}
              className={`h-[48px] text-base pl-4 pr-12 bg-white rounded-xl transition-all ${
                errors.password
                  ? "border border-[#cf6679] focus-visible:border-[#cf6679] focus-visible:ring-3 focus-visible:ring-[#cf6679]/20"
                  : isFilledPassword
                  ? "border border-[#b8acb4] focus-visible:border-[#6e546f] focus-visible:ring-3 focus-visible:ring-[#6e546f]/20"
                  : "border border-[#dfd3d7] focus-visible:border-[#6e546f] focus-visible:ring-3 focus-visible:ring-[#6e546f]/20"
              }`}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
            />
            {/* Eye Button with preventDefault on pointer down */}
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                setShowPassword((prev) => !prev);
              }}
              tabIndex={0}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-[#6e546f] rounded-xs p-1"
            >
              {showPassword ? (
                <EyeOff className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </button>
          </div>
          {errors.password && (
            <div id="password-error" className="flex items-center gap-1 text-xs text-[#b3261e] font-medium pt-0.5">
              <CircleAlert className="size-3.5 shrink-0" />
              <span>{errors.password.message}</span>
            </div>
          )}
        </div>

        {/* Remember Me Row (20px gap from password input) */}
        <div className="flex items-center gap-2.5 mt-1">
          <Checkbox
            id="rememberMe"
            {...register("rememberMe")}
            className="size-[18px] rounded-md border-[#dfd3d7] text-[#201524] data-[state=checked]:bg-[#201524] data-[state=checked]:text-white focus-visible:ring-2 focus-visible:ring-[#6e546f]/30 transition-all duration-120"
          />
          <Label htmlFor="rememberMe" className="text-xs font-normal text-[#716872] cursor-pointer select-none">
            Remember me on this device
          </Label>
        </div>

        {/* Form Status Area (Accessible live region) */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mt-1 min-h-[22px] flex items-center justify-center text-center"
        >
          {isSuccessState ? (
            <span className="flex items-center justify-center gap-1.5 text-xs text-emerald-700 font-medium animate-in fade-in duration-140">
              <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
              <span>Welcome back!</span>
            </span>
          ) : isChecking ? (
            <span className="flex items-center justify-center gap-1.5 text-xs text-[#6e546f] font-medium animate-in fade-in duration-140">
              <Loader2 className="size-3.5 animate-spin text-[#6e546f] shrink-0" />
              <span>Checking your account…</span>
            </span>
          ) : isEmailNotConfirmed ? (
            <div className="flex flex-col items-center justify-center gap-1 text-center animate-in fade-in duration-140">
              <span role="alert" className="flex items-center justify-center gap-1.5 text-xs text-[#b3261e] font-medium">
                <CircleAlert className="size-3.5 shrink-0 text-[#b3261e]" />
                <span>Your email address hasn’t been confirmed yet.</span>
              </span>
              {resendSuccess ? (
                <span className="flex items-center justify-center gap-1 text-xs text-emerald-700 font-medium pt-0.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                  <span>Confirmation email resent. Please check your inbox.</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={isResending}
                  className="text-xs font-semibold text-[#6e546f] hover:text-[#201524] hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#6e546f] rounded-xs disabled:opacity-60 transition-colors pt-0.5"
                >
                  {isResending ? "Resending confirmation email…" : "Resend confirmation email"}
                </button>
              )}
            </div>
          ) : authError ? (
            <span role="alert" className="flex items-center justify-center gap-1.5 text-xs text-[#b3261e] font-medium animate-in fade-in duration-140">
              <CircleAlert className="size-3.5 shrink-0" />
              <span>{authError}</span>
            </span>
          ) : null}
        </div>

        {/* Primary Log In Button */}
        <Button
          type="submit"
          disabled={isChecking || isSuccessState}
          className="w-full h-[48px] text-base font-semibold bg-[#201524] text-white hover:bg-[#34253a] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-140 rounded-xl shadow-xs focus-visible:ring-3 focus-visible:ring-[#6e546f]/30 disabled:opacity-70 mt-1"
        >
          {isSuccessState ? (
            <span className="flex items-center justify-center gap-2">
              <Check className="size-5 text-emerald-400" />
              Welcome back
            </span>
          ) : isChecking ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-5 animate-spin text-white" />
              Logging in…
            </span>
          ) : (
            "Log in"
          )}
        </Button>
      </form>

      {/* Footer Link pointing to /register */}
      <div className="mt-4 text-center text-xs text-[#716872]">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-bold text-[#6e546f] hover:underline focus-visible:outline-2 focus-visible:outline-[#6e546f] rounded-xs"
        >
          Create account
        </Link>
      </div>

      {/* TRUST STRIP */}
      <div className="mt-5 pt-4 border-t border-[#e6dadf]">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center text-xs text-[#6e546f] font-medium">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5">
            <ShieldCheck className="size-4 shrink-0 text-[#6e546f]" />
            <span className="leading-tight text-[11px] sm:text-xs">Seller verification</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5">
            <CheckCircle2 className="size-4 shrink-0 text-[#6e546f]" />
            <span className="leading-tight text-[11px] sm:text-xs">Clear product conditions</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5">
            <Store className="size-4 shrink-0 text-[#6e546f]" />
            <span className="leading-tight text-[11px] sm:text-xs">Tech-focused marketplace</span>
          </div>
        </div>
      </div>

      {/* NON-NAVIGATION PLACEHOLDER FOOTER LINKS */}
      <div className="mt-4 text-center text-xs text-[#716872] flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => alert("Privacy policy details coming soon.")}
          className="hover:text-[#1d1720] transition-colors focus-visible:outline-2 focus-visible:outline-[#6e546f] rounded-xs"
        >
          Privacy
        </button>
        <span>•</span>
        <button
          type="button"
          onClick={() => alert("Terms of service details coming soon.")}
          className="hover:text-[#1d1720] transition-colors focus-visible:outline-2 focus-visible:outline-[#6e546f] rounded-xs"
        >
          Terms
        </button>
        <span>•</span>
        <button
          type="button"
          onClick={() => alert("Help Center details coming soon.")}
          className="hover:text-[#1d1720] transition-colors focus-visible:outline-2 focus-visible:outline-[#6e546f] rounded-xs"
        >
          Help
        </button>
      </div>
    </div>
  );
}
