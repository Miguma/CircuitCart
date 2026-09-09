"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Camera,
  ExternalLink,
  Loader2,
  X,
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  Calendar,
} from "lucide-react";
import {
  getPendingVerificationRequests,
  reviewSellerVerification,
  getVerificationDocumentSignedUrl,
} from "@/lib/supabase/verification";
import type { SellerVerificationWithProfile } from "@/lib/supabase/types";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { toast } from "sonner";

export default function AdminVerificationsPage() {
  const searchParams = useSearchParams();
  const highlightedId = searchParams.get("id");

  const [requests, setRequests] = useState<SellerVerificationWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<
    "pending" | "approved" | "rejected" | "all"
  >("pending");

  // Rejection modal
  const [rejectingReqId, setRejectingReqId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Document preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const fetchVerifications = async () => {
    const data = await getPendingVerificationRequests();
    setRequests(data);
  };

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const data = await getPendingVerificationRequests();
        if (isMounted) {
          setRequests(data);
        }
      } catch (err) {
        console.error("Failed to load admin verification data:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleApprove = async (requestId: string) => {
    if (
      !confirm(
        "Are you sure you want to approve this seller verification request? The user role will immediately become 'seller'."
      )
    ) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await reviewSellerVerification(requestId, "approved");
      if (!res.success) {
        throw new Error(res.error || "Failed to approve request.");
      }
      toast.success(
        "Seller verification approved successfully! User is now a seller."
      );
      await fetchVerifications();
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Approval failed.";
      toast.error(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenRejectModal = (requestId: string) => {
    setRejectingReqId(requestId);
    setRejectionReason("");
  };

  const handleConfirmReject = async () => {
    if (!rejectingReqId) return;
    if (!rejectionReason.trim()) {
      toast.error(
        "Please provide a reason for rejecting the verification request."
      );
      return;
    }

    setIsProcessing(true);
    try {
      const res = await reviewSellerVerification(
        rejectingReqId,
        "rejected",
        rejectionReason.trim()
      );
      if (!res.success) {
        throw new Error(res.error || "Failed to reject request.");
      }
      toast.success("Seller verification request rejected.");
      setRejectingReqId(null);
      setRejectionReason("");
      await fetchVerifications();
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Rejection failed.";
      toast.error(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewDocument = async (path: string, title: string) => {
    setIsLoadingPreview(true);
    setPreviewTitle(title);
    try {
      const signedUrl = await getVerificationDocumentSignedUrl(path, 3600);
      if (!signedUrl) {
        throw new Error("Unable to generate signed URL for document.");
      }
      setPreviewUrl(signedUrl);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to load document preview.";
      toast.error(errorMsg);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (selectedFilter === "all") return true;
    return r.status === selectedFilter;
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Seller Verifications"
        subtitle="Review government IDs and business credentials for seller approval."
        actions={
          <div className="flex items-center gap-1.5 bg-[#342339] p-1 rounded-xl border border-white/10">
            {(["pending", "approved", "rejected", "all"] as const).map(
              (filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                    selectedFilter === filter
                      ? "bg-[#65486f] text-white shadow-xs"
                      : "text-[#b9adb6] hover:text-white"
                  }`}
                >
                  {filter}{" "}
                  {filter === "pending"
                    ? `(${requests.filter((r) => r.status === "pending").length})`
                    : ""}
                </button>
              )
            )}
          </div>
        }
      />

      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#b9adb6]">
          <Loader2 className="size-8 text-[#e59bc9] animate-spin" />
          <p className="text-xs">Loading verification requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <AdminEmptyState
          icon={CheckCircle2}
          title="No Requests in this Queue"
          description={
            selectedFilter === "pending"
              ? "All pending seller verification applications have been reviewed."
              : `No verification records matching status "${selectedFilter}".`
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => {
            const isPending = req.status === "pending";
            const isApproved = req.status === "approved";
            const isRejected = req.status === "rejected";
            const isHighlighted = highlightedId === req.id;

            return (
              <div
                key={req.id}
                id={`req-${req.id}`}
                className={`p-5 sm:p-6 rounded-2xl bg-[#342339]/50 border transition-all space-y-5 ${
                  isHighlighted
                    ? "border-[#e59bc9] ring-2 ring-[#e59bc9]/30"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                {/* Top info row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-[#1e1322] border border-white/10 flex items-center justify-center text-[#e59bc9]">
                      {req.seller_type === "business" ? (
                        <Building className="size-5" />
                      ) : (
                        <User className="size-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-[#fffafa]">
                          {req.full_name}
                        </h3>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                            isApproved
                              ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30"
                              : isPending
                              ? "bg-amber-950/80 text-amber-300 border border-amber-500/30"
                              : "bg-rose-950/80 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#b9adb6] capitalize">
                        {req.seller_type} Seller{" "}
                        {req.business_name
                          ? `· Business: ${req.business_name}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-xs text-[#b9adb6]">
                    <span className="block font-medium">
                      Submitted{" "}
                      {new Date(req.submitted_at).toLocaleDateString()} at{" "}
                      {new Date(req.submitted_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {req.reviewed_at && (
                      <span className="text-[11px] text-[#8f7d8c]">
                        Reviewed{" "}
                        {new Date(req.reviewed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1.5 bg-black/20 p-3.5 rounded-xl border border-white/5">
                    <span className="text-[10px] font-bold text-[#b9adb6] uppercase tracking-wider block">
                      Identity Details
                    </span>
                    <p className="text-[#fffafa] font-semibold flex items-center gap-1.5">
                      <FileCheck className="size-3.5 text-[#e59bc9]" />
                      <span>{req.id_type}</span>
                    </p>
                    <p className="text-[#b9adb6] flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-[#b9adb6]" />
                      <span>DOB: {req.date_of_birth}</span>
                    </p>
                    <p className="text-[#b9adb6] flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-[#b9adb6]" />
                      <span className="truncate">{req.city_address}</span>
                    </p>
                  </div>

                  <div className="space-y-1.5 bg-black/20 p-3.5 rounded-xl border border-white/5">
                    <span className="text-[10px] font-bold text-[#b9adb6] uppercase tracking-wider block">
                      Contact Info
                    </span>
                    <p className="text-[#fffafa] flex items-center gap-1.5">
                      <Mail className="size-3.5 text-[#b9adb6]" />
                      <span className="truncate">{req.contact_email}</span>
                    </p>
                    <p className="text-[#fffafa] flex items-center gap-1.5">
                      <Phone className="size-3.5 text-[#b9adb6]" />
                      <span>{req.contact_phone}</span>
                    </p>
                  </div>

                  <div className="space-y-2 bg-black/20 p-3.5 rounded-xl border border-white/5">
                    <span className="text-[10px] font-bold text-[#b9adb6] uppercase tracking-wider block">
                      Secure Documents
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleViewDocument(
                            req.id_front_path,
                            `Front ID - ${req.full_name}`
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-white transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <FileCheck className="size-3 text-[#e59bc9]" />
                        <span>Front ID</span>
                        <ExternalLink className="size-2.5 ml-0.5 text-[#b9adb6]" />
                      </button>

                      {req.id_back_path && (
                        <button
                          type="button"
                          onClick={() =>
                            handleViewDocument(
                              req.id_back_path!,
                              `Back ID - ${req.full_name}`
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-white transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <FileCheck className="size-3 text-[#e59bc9]" />
                          <span>Back ID</span>
                          <ExternalLink className="size-2.5 ml-0.5 text-[#b9adb6]" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          handleViewDocument(
                            req.selfie_path,
                            `Selfie - ${req.full_name}`
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-white transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Camera className="size-3 text-[#e59bc9]" />
                        <span>Selfie</span>
                        <ExternalLink className="size-2.5 ml-0.5 text-[#b9adb6]" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Automated Review Section */}
                <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#b9adb6] uppercase tracking-wider">
                        Automated Analysis:
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          req.automated_review_status === "passed"
                            ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/40"
                            : req.automated_review_status === "manual_review"
                            ? "bg-amber-950/90 text-amber-300 border border-amber-500/40"
                            : req.automated_review_status === "failed"
                            ? "bg-rose-950/90 text-rose-300 border border-rose-500/40"
                            : "bg-white/10 text-[#b9adb6] border border-white/10"
                        }`}
                      >
                        {req.automated_review_status || "queued"}
                      </span>
                    </div>

                    {req.automated_score !== undefined &&
                      req.automated_score !== null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-[#b9adb6]">
                            OCR Match Score:
                          </span>
                          <span
                            className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded-md ${
                              req.automated_score >= 90
                                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                                : req.automated_score >= 70
                                ? "bg-amber-950/80 text-amber-300 border border-amber-500/40"
                                : "bg-rose-950/80 text-rose-300 border border-rose-500/40"
                            }`}
                          >
                            {req.automated_score}/100
                          </span>
                        </div>
                      )}
                  </div>

                  {/* Extracted Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-[#b9adb6]">
                    <div>
                      <span className="text-[#8f7d8c] block">
                        Extracted Name:
                      </span>
                      <span className="font-semibold text-white">
                        {req.extracted_full_name || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8f7d8c] block">
                        Extracted DOB:
                      </span>
                      <span className="font-semibold text-white">
                        {req.extracted_date_of_birth || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8f7d8c] block">
                        Extracted ID:
                      </span>
                      <span className="font-semibold text-white">
                        {req.extracted_id_type || "—"}
                      </span>
                    </div>
                  </div>

                  {/* Flags */}
                  {Array.isArray(req.automated_flags) &&
                    req.automated_flags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-[#8f7d8c] font-bold uppercase">
                          Flags:
                        </span>
                        {req.automated_flags.map((flag) => (
                          <span
                            key={flag}
                            className="px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-500/30 text-amber-300 text-[10px] font-bold"
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    )}

                  {req.automated_review_summary && (
                    <p className="text-[11px] text-[#b9adb6] pt-1 border-t border-white/5 italic">
                      &ldquo;{req.automated_review_summary}&rdquo;
                    </p>
                  )}
                </div>

                {/* Rejection Reason */}
                {isRejected && req.rejection_reason && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/20 text-xs text-rose-300 space-y-0.5">
                    <span className="font-bold block">Rejection Reason:</span>
                    <p>{req.rejection_reason}</p>
                  </div>
                )}

                {/* Actions (if pending) */}
                {isPending && (
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleOpenRejectModal(req.id)}
                      className="px-4 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Reject Application
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleApprove(req.id)}
                      className="px-5 py-2 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>Approve Seller Access</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Document Preview Modal */}
      {(previewUrl || isLoadingPreview) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-[#1e1322] border border-white/20 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-[#fffafa]">
                {previewTitle || "Document Preview"}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {isLoadingPreview ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2 text-[#b9adb6]">
                <Loader2 className="size-8 animate-spin text-[#e59bc9]" />
                <p className="text-xs">Generating secure signed preview…</p>
              </div>
            ) : previewUrl ? (
              <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={previewTitle}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : null}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingReqId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#1e1322] border border-white/20 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                <AlertTriangle className="size-4" />
                <span>Reject Seller Verification</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectingReqId(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#fffafa] block">
                Reason for Rejection (Visible to Applicant){" "}
                <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. The ID photo is blurry and corners are cut off. Please provide a clear, full scan of your Philippine ID."
                className="w-full p-3 rounded-xl bg-[#342339]/60 border border-white/10 text-xs text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setRejectingReqId(null)}
                className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-semibold text-[#b9adb6] hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing || !rejectionReason.trim()}
                onClick={handleConfirmReject}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing && (
                  <Loader2 className="size-3.5 animate-spin text-white" />
                )}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
