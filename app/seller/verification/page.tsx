"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  FileCheck,
  Clock,
  Camera,
  Upload,
  ChevronRight,
  Info,
  Smartphone,
  Mail,
  User,
  X,
  Loader2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { SellerLayout } from "@/components/seller/seller-layout";
import { getCurrentUserProfile, UserProfile } from "@/lib/supabase/auth";
import {
  getMyVerificationRequest,
  uploadVerificationDocument,
  submitSellerVerification,
  validateVerificationFile,
} from "@/lib/supabase/verification";
import type { DbSellerVerificationRequest, DbSellerType } from "@/lib/supabase/types";
import { toast } from "sonner";

export default function SellerVerificationPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [verification, setVerification] = useState<DbSellerVerificationRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResubmitting, setIsResubmitting] = useState(false);

  // Stepper state
  const [currentStep, setCurrentStep] = useState(1);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [sellerType, setSellerType] = useState<DbSellerType>("individual");
  const [cityAddress, setCityAddress] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [idType, setIdType] = useState("Philippine National ID (PhilID)");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Document Files
  const [frontIdFile, setFrontIdFile] = useState<File | null>(null);
  const [backIdFile, setBackIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const steps = [
    { number: 1, title: "Basic Information", icon: User },
    { number: 2, title: "Government ID", icon: FileCheck },
    { number: 3, title: "Selfie Review", icon: Camera },
    { number: 4, title: "Contact Details", icon: Smartphone },
    { number: 5, title: "Review & Submit", icon: ShieldCheck },
  ];

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      try {
        const [userProfile, req] = await Promise.all([
          getCurrentUserProfile(),
          getMyVerificationRequest(),
        ]);

        if (!isMounted) return;
        setProfile(userProfile);
        setVerification(req);

        if (userProfile) {
          if (userProfile.full_name) {
            setFullName((prev) => prev || userProfile.full_name || "");
          }
          if (userProfile.location) {
            setCityAddress((prev) => prev || userProfile.location || "");
          }
        }
      } catch (err) {
        console.error("Failed to load verification status:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [userProfile, req] = await Promise.all([
        getCurrentUserProfile(),
        getMyVerificationRequest(),
      ]);

      setProfile(userProfile);
      setVerification(req);

      if (userProfile) {
        if (userProfile.full_name) {
          setFullName((prev) => prev || userProfile.full_name || "");
        }
        if (userProfile.location) {
          setCityAddress((prev) => prev || userProfile.location || "");
        }
      }
    } catch (err) {
      console.error("Failed to load verification status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "front" | "back" | "selfie"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const check = validateVerificationFile(file);
    if (!check.valid) {
      toast.error(check.error || "Invalid file");
      return;
    }

    if (type === "front") setFrontIdFile(file);
    if (type === "back") setBackIdFile(file);
    if (type === "selfie") setSelfieFile(file);

    toast.success(`Attached ${file.name}`);
  };

  const handleNextFromStep1 = () => {
    if (!fullName.trim()) {
      toast.error("Please enter your full legal name.");
      return;
    }
    if (!dob) {
      toast.error("Please provide your date of birth.");
      return;
    }
    if (sellerType === "business" && !businessName.trim()) {
      toast.error("Please provide your registered business name.");
      return;
    }
    if (!cityAddress.trim()) {
      toast.error("Please provide your permanent or residential address.");
      return;
    }
    setCurrentStep(2);
  };

  const handleNextFromStep2 = () => {
    if (!frontIdFile) {
      toast.error("Please attach a clear photo of the front of your ID.");
      return;
    }
    setCurrentStep(3);
  };

  const handleNextFromStep3 = () => {
    if (!selfieFile) {
      toast.error("Please attach your selfie document photo.");
      return;
    }
    setCurrentStep(4);
  };

  const handleNextFromStep4 = () => {
    if (!contactEmail.trim()) {
      toast.error("Please provide a contact email address.");
      return;
    }
    if (!contactPhone.trim()) {
      toast.error("Please provide a contact phone number.");
      return;
    }
    setCurrentStep(5);
  };

  const handleSubmitReview = async () => {
    if (!termsAgreed) {
      toast.error("Please confirm the information accuracy before submitting.");
      return;
    }
    if (!frontIdFile || !selfieFile) {
      toast.error("Required identity documents are missing.");
      return;
    }

    setIsSubmitting(true);
    setUploadProgressText("Uploading front of ID...");

    try {
      const groupId = crypto.randomUUID();

      // 1. Upload front ID
      const frontRes = await uploadVerificationDocument(frontIdFile, "id-front", groupId);
      if (!frontRes.path || frontRes.error) {
        throw new Error(frontRes.error || "Failed to upload Front ID photo.");
      }

      // 2. Upload back ID if provided
      let backPath: string | null = null;
      if (backIdFile) {
        setUploadProgressText("Uploading back of ID...");
        const backRes = await uploadVerificationDocument(backIdFile, "id-back", groupId);
        if (!backRes.path || backRes.error) {
          throw new Error(backRes.error || "Failed to upload Back ID photo.");
        }
        backPath = backRes.path;
      }

      // 3. Upload selfie
      setUploadProgressText("Uploading selfie image...");
      const selfieRes = await uploadVerificationDocument(selfieFile, "selfie", groupId);
      if (!selfieRes.path || selfieRes.error) {
        throw new Error(selfieRes.error || "Failed to upload selfie photo.");
      }

      // 4. Submit verification RPC
      setUploadProgressText("Finalizing verification request...");
      const submitRes = await submitSellerVerification({
        seller_type: sellerType,
        full_name: fullName.trim(),
        date_of_birth: dob,
        city_address: cityAddress.trim(),
        business_name: sellerType === "business" ? businessName.trim() : null,
        id_type: idType,
        id_front_path: frontRes.path,
        id_back_path: backPath,
        selfie_path: selfieRes.path,
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim(),
      });

      if (!submitRes.success || !submitRes.data) {
        throw new Error(submitRes.error || "Failed to submit verification request.");
      }

      toast.success("Seller verification submitted successfully!");
      setVerification(submitRes.data);
      setIsResubmitting(false);
      await loadData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to submit verification.";
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
      setUploadProgressText("");
    }
  };

  const handleStartResubmission = () => {
    setIsResubmitting(true);
    setCurrentStep(1);
    setTermsAgreed(false);
    setFrontIdFile(null);
    setBackIdFile(null);
    setSelfieFile(null);
  };

  const displayStatus = isResubmitting
    ? "In Progress"
    : verification?.status === "approved" || profile?.role === "seller"
    ? "Verified"
    : verification?.status === "pending"
    ? "Under Review"
    : verification?.status === "rejected"
    ? "Rejected"
    : "Not Started";

  if (isLoading) {
    return (
      <SellerLayout
        title="Seller Verification"
        subtitle="Verify your identity to build trust and unlock seller privileges."
        showAddProduct={profile?.role === "seller" || profile?.role === "admin"}
      >
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#b9adb6]">
          <Loader2 className="size-8 animate-spin text-[#e59bc9]" />
          <p className="text-xs font-semibold">Loading verification status…</p>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout
      title="Seller Verification"
      subtitle="Verify your identity to build trust and unlock verified seller features."
      showAddProduct={profile?.role === "seller" || profile?.role === "admin"}
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
                  displayStatus === "Verified"
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                    : displayStatus === "Under Review"
                    ? "bg-amber-950/80 text-amber-300 border border-amber-500/40"
                    : displayStatus === "Rejected"
                    ? "bg-rose-950/80 text-rose-300 border border-rose-500/40"
                    : "bg-[#3d2743] text-[#e59bc9] border border-[#e59bc9]/30"
                }`}
              >
                {displayStatus === "Verified" ? (
                  <CheckCircle2 className="size-6" />
                ) : displayStatus === "Under Review" ? (
                  <Clock className="size-6 animate-pulse" />
                ) : displayStatus === "Rejected" ? (
                  <AlertTriangle className="size-6" />
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
                      displayStatus === "Verified"
                        ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30"
                        : displayStatus === "Under Review"
                        ? "bg-amber-950/80 text-amber-300 border border-amber-500/30"
                        : displayStatus === "Rejected"
                        ? "bg-rose-950/80 text-rose-300 border border-rose-500/30"
                        : "bg-[#45284f] text-[#e59bc9] border border-[#e59bc9]/30"
                    }`}
                  >
                    {displayStatus}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#fffafa] tracking-tight mt-0.5">
                  {displayStatus === "Verified"
                    ? "You are a Verified CircuitCart Seller"
                    : displayStatus === "Under Review"
                    ? "Your Verification is Under Review"
                    : displayStatus === "Rejected"
                    ? "Seller Verification Not Approved"
                    : "Complete Verification to Start Selling"}
                </h2>
              </div>
            </div>

            {displayStatus === "Rejected" && !isResubmitting && (
              <button
                type="button"
                onClick={handleStartResubmission}
                className="text-xs font-semibold text-[#e59bc9] hover:text-white px-4 py-2 rounded-xl border border-[#e59bc9]/40 hover:bg-[#65486f]/40 transition-colors flex items-center gap-2 self-start sm:self-auto"
              >
                <RotateCcw className="size-3.5" />
                <span>Submit New Application</span>
              </button>
            )}
          </div>

          {/* Contextual Description */}
          {displayStatus === "Verified" && (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-xs text-emerald-300 space-y-1 leading-relaxed">
              <p className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <span>
                  Verified{" "}
                  {verification?.reviewed_at
                    ? `on ${new Date(verification.reviewed_at).toLocaleDateString()}`
                    : ""}
                </span>
              </p>
              <p className="text-emerald-300/80">
                Your account is verified with approved identity documentation. You have full access to create shops and publish hardware product listings.
              </p>
            </div>
          )}

          {displayStatus === "Under Review" && (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/20 text-xs text-amber-300 space-y-1 leading-relaxed">
              <p className="font-bold flex items-center gap-1.5">
                <Clock className="size-4 text-amber-400" />
                <span>
                  Submitted{" "}
                  {verification?.submitted_at
                    ? `on ${new Date(verification.submitted_at).toLocaleDateString()}`
                    : ""}
                </span>
              </p>
              <p className="text-amber-300/80">
                Our verification compliance team is reviewing your Philippine ID and selfie document. Review usually takes 1–3 business days. You will gain seller access as soon as approved.
              </p>
            </div>
          )}

          {displayStatus === "Rejected" && !isResubmitting && (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/20 text-xs text-rose-300 space-y-2 leading-relaxed">
              <p className="font-bold flex items-center gap-1.5 text-rose-200">
                <AlertTriangle className="size-4 text-rose-400" />
                <span>Reason for Rejection</span>
              </p>
              <p className="text-rose-300/90 font-medium">
                {verification?.rejection_reason || "Document details did not match required Philippine verification standards."}
              </p>
              <p className="text-[11px] text-rose-300/70 pt-1">
                Please review the feedback above and click &ldquo;Submit New Application&rdquo; to provide updated documentation.
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
                Verified status badge displayed across your shop and listings.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
              <p className="text-xs font-bold text-[#fffafa] flex items-center gap-1.5">
                <Upload className="size-3.5 text-[#e59bc9]" />
                <span>Hardware Publishing</span>
              </p>
              <p className="text-[11px] text-[#b9adb6] leading-snug">
                Unlock real listing creation for laptops, GPUs, components, and electronics.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
              <p className="text-xs font-bold text-[#fffafa] flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-amber-300" />
                <span>Buyer Confidence</span>
              </p>
              <p className="text-[11px] text-[#b9adb6] leading-snug">
                Verified identity provides authentic assurance for local buyers.
              </p>
            </div>
          </div>
        </div>

        {/* ======================================================= */}
        {/* 2. 5-STEP VERIFICATION FLOW                             */}
        {/* ======================================================= */}
        {(displayStatus === "Not Started" || isResubmitting) && (
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
                        onClick={() => {
                          if (st.number < currentStep) {
                            setCurrentStep(st.number);
                          }
                        }}
                        className={`flex items-center gap-2 group transition-all shrink-0 ${
                          isCurrent
                            ? "text-[#fffafa]"
                            : isDone
                            ? "text-emerald-400 cursor-pointer"
                            : "text-[#8f7d8c] cursor-default"
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
                          {isDone ? <CheckCircle2 className="size-3.5" /> : st.number}
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
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Juan Dela Cruz"
                      className="w-full h-10 px-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                      Date of Birth <span className="text-[#e59bc9]">*</span>
                    </label>
                    <input
                      type="date"
                      required
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
                        setSellerType(e.target.value as DbSellerType)
                      }
                      className="w-full h-10 px-3 rounded-xl bg-[#342339] border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9]"
                    >
                      <option value="individual">Individual Hardware Seller</option>
                      <option value="business">Registered Business / Store</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                      Business / Shop Trade Name {sellerType === "business" && <span className="text-[#e59bc9]">*</span>}
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder={sellerType === "business" ? "e.g. TechVault Cebu Hardware" : "Optional for individual sellers"}
                      className="w-full h-10 px-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                    Permanent / Residential Address <span className="text-[#e59bc9]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={cityAddress}
                    onChange={(e) => setCityAddress(e.target.value)}
                    placeholder="e.g. Banilad, Cebu City 6000"
                    className="w-full h-10 px-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9]"
                  />
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    type="button"
                    onClick={handleNextFromStep1}
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
                    Select your Philippine ID type and attach clear photos.
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

                {/* Hidden File Inputs */}
                <input
                  ref={frontInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, "front")}
                />
                <input
                  ref={backInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, "back")}
                />

                {/* Front & Back Upload Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/20 text-center space-y-3">
                    <div className="size-10 rounded-xl bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#e59bc9]">
                      <FileCheck className="size-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#fffafa]">
                        Front of ID Card <span className="text-[#e59bc9]">*</span>
                      </p>
                      <p className="text-[11px] text-[#b9adb6] truncate px-2">
                        {frontIdFile ? `${frontIdFile.name} (${(frontIdFile.size / 1024 / 1024).toFixed(2)} MB)` : "JPG, PNG, or WebP up to 5MB"}
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => frontInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Upload className="size-3.5" />
                        <span>{frontIdFile ? "Replace File" : "Upload Front Photo"}</span>
                      </button>
                      {frontIdFile && (
                        <button
                          type="button"
                          onClick={() => setFrontIdFile(null)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-950/60 text-rose-300"
                          title="Remove file"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/20 text-center space-y-3">
                    <div className="size-10 rounded-xl bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#e59bc9]">
                      <FileCheck className="size-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#fffafa]">
                        Back of ID Card (Optional for Passports)
                      </p>
                      <p className="text-[11px] text-[#b9adb6] truncate px-2">
                        {backIdFile ? `${backIdFile.name} (${(backIdFile.size / 1024 / 1024).toFixed(2)} MB)` : "JPG, PNG, or WebP up to 5MB"}
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => backInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Upload className="size-3.5" />
                        <span>{backIdFile ? "Replace File" : "Upload Back Photo"}</span>
                      </button>
                      {backIdFile && (
                        <button
                          type="button"
                          onClick={() => setBackIdFile(null)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-950/60 text-rose-300"
                          title="Remove file"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ID Guidance */}
                <div className="p-3.5 rounded-xl bg-[#281827]/60 border border-white/[0.06] text-xs text-[#b9adb6] space-y-1">
                  <p className="font-bold text-[#fffafa] flex items-center gap-1.5">
                    <Info className="size-3.5 text-[#e59bc9]" />
                    <span>Upload Requirements</span>
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Ensure all four corners are visible, text is legible without glare or flash reflection, and the document is valid and unexpired.
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
                    onClick={handleNextFromStep2}
                    className="px-6 py-2.5 rounded-xl bg-[#65486f] text-white hover:bg-[#7a5985] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Continue to Selfie Review</span>
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Selfie Verification */}
            {currentStep === 3 && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="border-b border-white/[0.08] pb-3">
                  <h3 className="text-base font-bold text-[#fffafa]">
                    Step 3: Selfie Photo Review
                  </h3>
                  <p className="text-xs text-[#b9adb6] mt-0.5">
                    Attach a clear selfie photo to verify document ownership.
                  </p>
                </div>

                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, "selfie")}
                />

                <div className="max-w-md mx-auto p-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/20 text-center space-y-4">
                  <div className="size-16 rounded-full bg-[#342339] border border-[#e59bc9]/30 flex items-center justify-center mx-auto text-[#e59bc9]">
                    <Camera className="size-8" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#fffafa]">
                      Selfie Document Photo
                    </h4>
                    <p className="text-xs text-[#b9adb6] mt-1 leading-relaxed">
                      Position your face inside clear neutral lighting without hats, sunglasses, or face masks.
                    </p>
                    {selfieFile && (
                      <p className="text-xs text-emerald-400 font-semibold mt-2">
                        Attached: {selfieFile.name} ({(selfieFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => selfieInputRef.current?.click()}
                      className="px-5 py-2.5 rounded-xl bg-[#65486f] hover:bg-[#7a5985] text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Upload className="size-3.5" />
                      <span>{selfieFile ? "Replace Selfie Photo" : "Upload Selfie Photo"}</span>
                    </button>
                    {selfieFile && (
                      <button
                        type="button"
                        onClick={() => setSelfieFile(null)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-rose-950/60 text-rose-300"
                        title="Remove selfie"
                      >
                        <X className="size-4" />
                      </button>
                    )}
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
                    onClick={handleNextFromStep3}
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
                    Step 4: Contact Details
                  </h3>
                  <p className="text-xs text-[#b9adb6] mt-0.5">
                    Provide active contact information for verification notifications and order inquiries.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                      Contact Email <span className="text-[#e59bc9]">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="size-4 text-[#b9adb6] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="seller@example.com"
                        className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#fffafa] block mb-1.5">
                      Contact Phone Number (Philippine Mobile) <span className="text-[#e59bc9]">*</span>
                    </label>
                    <div className="relative">
                      <Smartphone className="size-4 text-[#b9adb6] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="0917 123 4567 or +63 917 123 4567"
                        className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] outline-hidden focus:border-[#e59bc9]"
                      />
                    </div>
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
                    onClick={handleNextFromStep4}
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
                    Review your details before submitting to compliance.
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
                      <p className="text-[11px] text-[#b9adb6]">
                        {sellerType === "business" ? `Business: ${businessName} · ` : ""}
                        {cityAddress}
                      </p>
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
                        Front Photo Attached {backIdFile ? "· Back Photo Attached" : ""}
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
                        Selfie Document
                      </span>
                      <p className="font-bold text-emerald-400 text-sm mt-0.5">
                        Selfie Photo Attached: {selfieFile?.name}
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

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <span className="text-[#8f7d8c] block text-[11px]">
                        Contact Information
                      </span>
                      <p className="font-bold text-[#fffafa] text-sm mt-0.5">
                        {contactEmail} · {contactPhone}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(4)}
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
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin text-white" />
                        <span>{uploadProgressText || "Submitting..."}</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="size-4 text-[#e59bc9]" />
                        <span>Submit for Verification</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* If Under Review or Verified, provide return navigation */}
        {displayStatus === "Under Review" && (
          <div className="flex justify-center pt-2">
            <Link
              href="/marketplace"
              className="px-6 py-3 rounded-xl bg-[#65486f] text-white hover:bg-[#7a5985] text-xs sm:text-sm font-bold shadow-lg transition-all"
            >
              Browse Marketplace
            </Link>
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
