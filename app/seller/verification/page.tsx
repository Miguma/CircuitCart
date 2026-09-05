"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  FileCheck,
  UserCheck,
  Clock,
  Camera,
  Upload,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Award,
  Check,
  ChevronRight,
  Info,
  Smartphone,
  Mail,
  User,
  Image as ImageIcon,
} from "lucide-react";
import { SellerLayout } from "@/components/seller/seller-layout";
import {
  DEMO_VERIFICATION_DATA,
  type VerificationStatus,
  type SellerVerificationData,
} from "@/lib/seller/seller-data";
import { toast } from "sonner";

export default function SellerVerificationPage() {
  const [verification, setVerification] = useState<SellerVerificationData>(
    DEMO_VERIFICATION_DATA
  );
  const [currentStep, setCurrentStep] = useState(1);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState(verification.fullName);
  const [dob, setDob] = useState(verification.dateOfBirth);
  const [sellerType, setSellerType] = useState<"Individual" | "Business">(
    verification.sellerType
  );
  const [cityAddress, setCityAddress] = useState(verification.cityAddress);
  const [businessName, setBusinessName] = useState(
    verification.businessName || ""
  );
  const [idType, setIdType] = useState(verification.idType);
  const [hasFrontId, setHasFrontId] = useState(true);
  const [hasBackId, setHasBackId] = useState(true);
  const [hasSelfie, setHasSelfie] = useState(true);

  const steps = [
    { number: 1, title: "Basic Information", icon: User },
    { number: 2, title: "Government ID", icon: FileCheck },
    { number: 3, title: "Face Verification", icon: Camera },
    { number: 4, title: "Contact Details", icon: Smartphone },
    { number: 5, title: "Review & Submit", icon: ShieldCheck },
  ];

  const handleSubmitReview = () => {
    if (!termsAgreed) {
      toast.error("Please confirm the information accuracy before submitting.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const now = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      setVerification((prev) => ({
        ...prev,
        status: "Under Review",
        submittedAt: `${now} · Today`,
      }));
      toast.success("Verification documents submitted for review!");
    }, 600);
  };

  const handleStartFresh = () => {
    setVerification((prev) => ({
      ...prev,
      status: "In Progress",
    }));
    setCurrentStep(1);
    toast.info("Starting seller verification flow.");
  };

  return (
    <SellerLayout
      title="Seller Verification"
      subtitle="Verify your identity to build trust and unlock verified seller features."
      showAddProduct={true}
    >
      <div className="max-w-4xl space-y-8">
        {/* ======================================================= */}
        {/* 1. TOP STATUS CARD                                      */}
        {/* ======================================================= */}
        <div className="bg-[#1e1322]/85 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`size-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-xl shrink-0 ${
                  verification.status === "Verified"
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                    : verification.status === "Under Review"
                    ? "bg-amber-950/80 text-amber-300 border border-amber-500/40"
                    : "bg-[#3d2743] text-[#e59bc9] border border-[#e59bc9]/30"
                }`}
              >
                {verification.status === "Verified" ? (
                  <CheckCircle2 className="size-6" />
                ) : verification.status === "Under Review" ? (
                  <Clock className="size-6 animate-pulse" />
                ) : (
                  <ShieldCheck className="size-6" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#b9adb6]">
                    Account Status
                  </span>
                  <span
                    className={`text-xs font-extrabold px-2.5 py-0.5 rounded-md ${
                      verification.status === "Verified"
                        ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30"
                        : verification.status === "Under Review"
                        ? "bg-amber-950/80 text-amber-300 border border-amber-500/30"
                        : "bg-[#45284f] text-[#e59bc9] border border-[#e59bc9]/30"
                    }`}
                  >
                    {verification.status}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#fffafa] tracking-tight mt-0.5">
                  {verification.status === "Verified"
                    ? "You are a Verified CircuitCart Seller"
                    : verification.status === "Under Review"
                    ? "Your Verification is Under Review"
                    : "Complete Verification to Unlock Seller Perks"}
                </h2>
              </div>
            </div>

            {verification.status === "Verified" && (
              <button
                type="button"
                onClick={handleStartFresh}
                className="text-xs font-semibold text-[#b9adb6] hover:text-white px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/5 transition-colors self-start sm:self-auto"
              >
                Update Verification Documents
              </button>
            )}
          </div>

          {/* Contextual Description */}
          {verification.status === "Verified" && (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-xs text-emerald-300 space-y-1 leading-relaxed">
              <p className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <span>Verified on {verification.reviewedAt}</span>
              </p>
              <p className="text-emerald-300/80">
                Your shop is authenticated with biometric identity checks. The verified checkmark is active on all your product listings and public shop storefront.
              </p>
            </div>
          )}

          {verification.status === "Under Review" && (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/20 text-xs text-amber-300 space-y-1 leading-relaxed">
              <p className="font-bold flex items-center gap-1.5">
                <Clock className="size-4 text-amber-400" />
                <span>Submitted on {verification.submittedAt}</span>
              </p>
              <p className="text-amber-300/80">
                Our verification team is reviewing your Philippine ID and facial selfie. Estimated review time is 1–3 business days. You will be notified once approved.
              </p>
            </div>
          )}

          {/* Verified Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
              <p className="text-xs font-bold text-[#fffafa] flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-400" />
                <span>Verified Badge</span>
              </p>
              <p className="text-[11px] text-[#b9adb6] leading-snug">
                Green verified checkmark displayed across all search results.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
              <p className="text-xs font-bold text-[#fffafa] flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-[#e59bc9]" />
                <span>Filter Priority</span>
              </p>
              <p className="text-[11px] text-[#b9adb6] leading-snug">
                Eligible for the &ldquo;Verified sellers only&rdquo; buyer filter.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
              <p className="text-xs font-bold text-[#fffafa] flex items-center gap-1.5">
                <Award className="size-3.5 text-amber-300" />
                <span>Buyer Trust</span>
              </p>
              <p className="text-[11px] text-[#b9adb6] leading-snug">
                Verified sellers achieve 3.4x higher conversion on GPU & laptop sales.
              </p>
            </div>
          </div>
        </div>

        {/* ======================================================= */}
        {/* 2. 5-STEP VERIFICATION FLOW                             */}
        {/* ======================================================= */}
        {verification.status !== "Under Review" && (
          <div className="bg-[#1e1322]/85 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-8">
            {/* Step Stepper Header */}
            <div className="w-full overflow-x-auto scrollbar-none no-scrollbar pb-1">
              <div className="flex items-center min-w-[540px] md:min-w-0 w-full justify-between">
                {steps.map((st, idx) => {
                  const isDone = currentStep > st.number;
                  const isCurrent = currentStep === st.number;

                  return (
                    <React.Fragment key={st.number}>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(st.number)}
                        className={`flex items-center gap-2 group cursor-pointer transition-all shrink-0 ${
                          isCurrent
                            ? "text-[#fffafa]"
                            : isDone
                            ? "text-emerald-400"
                            : "text-[#8f7d8c]"
                        }`}
                      >
                        <div
                          className={`size-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                            isCurrent
                              ? "bg-[#65486f] text-white ring-2 ring-[#e59bc9]"
                              : isDone
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                              : "bg-white/5 border border-white/10"
                          }`}
                        >
                          {isDone ? <Check className="size-3.5" /> : st.number}
                        </div>
                        <span className="text-xs font-semibold whitespace-nowrap">
                          {st.title}
                        </span>
                      </button>

                      {idx < steps.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 min-w-3 mx-2 sm:mx-3 transition-colors ${
                            currentStep > st.number
                              ? "bg-emerald-500/50"
                              : "bg-white/10"
                          }`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* STEP 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="border-b border-white/[0.08] pb-3">
                  <h3 className="text-base font-bold text-[#fffafa]">
                    Step 1: Personal & Business Information
                  </h3>
                  <p className="text-xs text-[#b9adb6] mt-0.5">
                    Provide your legal identity details matching your government-issued ID.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                      Full Legal Name <span className="text-[#e59bc9]">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Mark Anthony Miguma"
                      className="w-full h-10 px-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                      Date of Birth <span className="text-[#e59bc9]">*</span>
                    </label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                      Seller Entity Type
                    </label>
                    <select
                      value={sellerType}
                      onChange={(e) =>
                        setSellerType(e.target.value as "Individual" | "Business")
                      }
                      className="w-full h-10 px-3 rounded-xl bg-[#342339] border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9]"
                    >
                      <option value="Individual">Individual Hardware Seller</option>
                      <option value="Business">Registered Business / DTI Store</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                      Business / Shop Trade Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. TechVault Cebu Hardware"
                      className="w-full h-10 px-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                    Permanent / Residential Address
                  </label>
                  <input
                    type="text"
                    value={cityAddress}
                    onChange={(e) => setCityAddress(e.target.value)}
                    placeholder="e.g. Gov. Cuenco Ave, Banilad, Cebu City 6000"
                    className="w-full h-10 px-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9]"
                  />
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-6 py-2.5 rounded-xl bg-[#65486f] text-white hover:bg-[#7a5985] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Continue to Government ID</span>
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Government ID */}
            {currentStep === 2 && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="border-b border-white/[0.08] pb-3">
                  <h3 className="text-base font-bold text-[#fffafa]">
                    Step 2: Government-Issued Identity Document
                  </h3>
                  <p className="text-xs text-[#b9adb6] mt-0.5">
                    Select your Philippine ID type and upload clear front & back photos.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                    Select Philippine ID Type <span className="text-[#e59bc9]">*</span>
                  </label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-[#342339] border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9]"
                  >
                    <option value="Philippine National ID (PhilID)">Philippine National ID (PhilID / ePhilID)</option>
                    <option value="LTO Driver's License">LTO Driver&apos;s License</option>
                    <option value="Philippine Passport">Philippine Passport (DFA)</option>
                    <option value="Unified Multi-Purpose ID (UMID)">Unified Multi-Purpose ID (UMID / SSS)</option>
                    <option value="Postal ID">Postal ID (Digitized)</option>
                    <option value="PRC ID">PRC Professional ID</option>
                  </select>
                </div>

                {/* Front & Back Upload Previews */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/20 text-center space-y-3">
                    <div className="size-10 rounded-xl bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#e59bc9]">
                      <FileCheck className="size-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#fffafa]">
                        Front of ID Card
                      </p>
                      <p className="text-[11px] text-[#b9adb6]">
                        {hasFrontId ? "philid_front_scan.png (Attached)" : "PNG, JPG up to 10MB"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setHasFrontId(true);
                        toast.success("Front of ID attached.");
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors"
                    >
                      {hasFrontId ? "Replace Photo" : "Upload Front Photo"}
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/20 text-center space-y-3">
                    <div className="size-10 rounded-xl bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#e59bc9]">
                      <FileCheck className="size-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#fffafa]">
                        Back of ID Card
                      </p>
                      <p className="text-[11px] text-[#b9adb6]">
                        {hasBackId ? "philid_back_scan.png (Attached)" : "PNG, JPG up to 10MB"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setHasBackId(true);
                        toast.success("Back of ID attached.");
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors"
                    >
                      {hasBackId ? "Replace Photo" : "Upload Back Photo"}
                    </button>
                  </div>
                </div>

                {/* ID Guidance */}
                <div className="p-3.5 rounded-xl bg-[#281827]/60 border border-white/[0.06] text-xs text-[#b9adb6] space-y-1">
                  <p className="font-bold text-[#fffafa] flex items-center gap-1.5">
                    <Info className="size-3.5 text-[#e59bc9]" />
                    <span>Upload Requirements</span>
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Ensure all four corners are visible, text is fully readable without glare or flash reflection, and the document is valid and unexpired.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-4 py-2 text-xs font-semibold text-[#b9adb6] hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-6 py-2.5 rounded-xl bg-[#65486f] text-white hover:bg-[#7a5985] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Continue to Face Verification</span>
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Selfie / Face Verification */}
            {currentStep === 3 && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="border-b border-white/[0.08] pb-3">
                  <h3 className="text-base font-bold text-[#fffafa]">
                    Step 3: Biometric Face / Selfie Verification
                  </h3>
                  <p className="text-xs text-[#b9adb6] mt-0.5">
                    Confirm you are the legitimate owner of the submitted government document.
                  </p>
                </div>

                <div className="max-w-md mx-auto p-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/20 text-center space-y-4">
                  <div className="size-16 rounded-full bg-[#342339] border border-[#e59bc9]/30 flex items-center justify-center mx-auto text-[#e59bc9]">
                    <Camera className="size-8" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#fffafa]">
                      Take Live Facial Selfie
                    </h4>
                    <p className="text-xs text-[#b9adb6] mt-1 leading-relaxed">
                      Position your face inside the frame with neutral lighting. Remove hats, masks, or tinted glasses.
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setHasSelfie(true);
                        toast.success("Selfie captured successfully.");
                      }}
                      className="px-5 py-2.5 rounded-xl bg-[#65486f] hover:bg-[#7a5985] text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Camera className="size-3.5" />
                      <span>{hasSelfie ? "Retake Selfie" : "Capture Selfie"}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-4 py-2 text-xs font-semibold text-[#b9adb6] hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="px-6 py-2.5 rounded-xl bg-[#65486f] text-white hover:bg-[#7a5985] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Continue to Contact Details</span>
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Contact Details */}
            {currentStep === 4 && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="border-b border-white/[0.08] pb-3">
                  <h3 className="text-base font-bold text-[#fffafa]">
                    Step 4: Contact Authentication
                  </h3>
                  <p className="text-xs text-[#b9adb6] mt-0.5">
                    Ensure your account contact channels are reachable for order notifications and escrow releases.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 flex items-center justify-center">
                        <Mail className="size-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#fffafa]">
                          {verification.email}
                        </p>
                        <p className="text-[11px] text-[#b9adb6]">
                          Primary Seller Email
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                      <Check className="size-3" />
                      Verified
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 flex items-center justify-center">
                        <Smartphone className="size-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#fffafa]">
                          {verification.phone}
                        </p>
                        <p className="text-[11px] text-[#b9adb6]">
                          Philippine Mobile Number (+63)
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                      <Check className="size-3" />
                      Verified
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-4 py-2 text-xs font-semibold text-[#b9adb6] hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(5)}
                    className="px-6 py-2.5 rounded-xl bg-[#65486f] text-white hover:bg-[#7a5985] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Review & Submit</span>
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: Review & Submit */}
            {currentStep === 5 && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="border-b border-white/[0.08] pb-3">
                  <h3 className="text-base font-bold text-[#fffafa]">
                    Step 5: Review & Submit for Verification
                  </h3>
                  <p className="text-xs text-[#b9adb6] mt-0.5">
                    Review your submitted details before sending to CircuitCart compliance.
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <span className="text-[#8f7d8c] block text-[11px]">
                        Applicant Name & DOB
                      </span>
                      <p className="font-bold text-[#fffafa] text-sm mt-0.5">
                        {fullName} ({dob})
                      </p>
                      <p className="text-[11px] text-[#b9adb6]">{cityAddress}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs font-semibold text-[#e59bc9] hover:underline"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <span className="text-[#8f7d8c] block text-[11px]">
                        Identity Document
                      </span>
                      <p className="font-bold text-[#fffafa] text-sm mt-0.5">
                        {idType}
                      </p>
                      <p className="text-[11px] text-emerald-400">
                        Front & Back Photos Attached ✓
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="text-xs font-semibold text-[#e59bc9] hover:underline"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <span className="text-[#8f7d8c] block text-[11px]">
                        Biometric Face Match
                      </span>
                      <p className="font-bold text-emerald-400 text-sm mt-0.5">
                        Live Facial Selfie Ready ✓
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="text-xs font-semibold text-[#e59bc9] hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {/* Confirmation Checkbox */}
                <label className="flex items-start gap-3 p-4 rounded-xl bg-[#281827]/70 border border-white/10 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={termsAgreed}
                    onChange={(e) => setTermsAgreed(e.target.checked)}
                    className="size-4 mt-0.5 rounded-md accent-[#e59bc9] cursor-pointer"
                  />
                  <span className="text-xs text-[#d6cbd5] leading-relaxed">
                    I confirm that all information and identity documents provided are authentic, accurate, and belong to me. I understand that fraudulent submissions will lead to immediate ban and suspension.
                  </span>
                </label>

                <div className="flex items-center justify-between pt-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="px-4 py-2 text-xs font-semibold text-[#b9adb6] hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitReview}
                    disabled={isSubmitting || !termsAgreed}
                    className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center gap-2 ${
                      termsAgreed && !isSubmitting
                        ? "bg-[#65486f] hover:bg-[#7a5985] text-white cursor-pointer"
                        : "bg-white/10 text-[#8f7d8c] cursor-not-allowed"
                    }`}
                  >
                    <ShieldCheck className="size-4 text-[#e59bc9]" />
                    <span>{isSubmitting ? "Submitting..." : "Submit for Verification"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* If Under Review, display return to dashboard button */}
        {verification.status === "Under Review" && (
          <div className="flex justify-center pt-2">
            <Link
              href="/seller"
              className="px-6 py-3 rounded-xl bg-[#65486f] text-white hover:bg-[#7a5985] text-xs sm:text-sm font-bold shadow-lg transition-all"
            >
              Return to Seller Dashboard
            </Link>
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
