"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
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
  getAdminVerificationById,
} from "@/lib/supabase/admin";
import {
  reviewSellerVerification,
  getVerificationDocumentSignedUrl,
} from "@/lib/supabase/verification";
import type { SellerVerificationWithProfile } from "@/lib/supabase/types";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { toast } from "sonner";

export default function AdminVerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [request, setRequest] = useState<SellerVerificationWithProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rejection modal
  const [rejectingOpen, setRejectingOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Document preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const fetchDetail = async (requestId: string) => {
    const data = await getAdminVerificationById(requestId);
    setRequest(data);
  };

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const data = await getAdminVerificationById(id);
        if (isMounted) {
          setRequest(data);
        }
      } catch (err) {
        console.error("Failed to load verification detail:", err);
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
  }, [id]);

  const handleApprove = async () => {
    if (!request) return;
    if (
      !confirm(
        `Are you sure you want to approve seller verification for ${request.full_name}? The user role will immediately become 'seller'.`
      )
    ) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await reviewSellerVerification(request.id, "approved");
      if (!res.success) {
        throw new Error(res.error || "Failed to approve request.");
      }
      toast.success(
        "Seller verification approved successfully! User is now a seller."
      );
      await fetchDetail(request.id);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Approval failed.";
      toast.error(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!request) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejecting the request.");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await reviewSellerVerification(
        request.id,
        "rejected",
        rejectionReason.trim()
      );
      if (!res.success) {
        throw new Error(res.error || "Failed to reject request.");
      }
      toast.success("Seller verification request rejected.");
      setRejectingOpen(false);
      setRejectionReason("");
      await fetchDetail(request.id);
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

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#b9adb6]">
        <Loader2 className="size-8 text-[#e59bc9] animate-spin" />
        <p className="text-xs">Loading application details...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Verification Request"
          backHref="/admin/verifications"
        />
        <AdminEmptyState
          title="Application Not Found"
          description={`No seller verification request exists with ID ${id}.`}
          action={
            <Link
              href="/admin/verifications"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#65486f] text-white text-xs font-bold"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Verification Queue</span>
            </Link>
          }
        />
      </div>
    );
  }

  const isPending = request.status === "pending";
  const isApproved = request.status === "approved";
  const isRejected = request.status === "rejected";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`Verification: ${request.full_name}`}
        subtitle={`Application ID: ${request.id}`}
        backHref="/admin/verifications"
        actions={
          isPending ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setRejectingOpen(true)}
                className="px-4 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleApprove}
                className="px-4 py-2 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="size-3.5" />
                <span>Approve Access</span>
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Main Card */}
      <div className="p-6 rounded-2xl bg-[#342339]/50 border border-white/10 space-y-6">
        {/* Top Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-[#1e1322] border border-white/10 flex items-center justify-center text-[#e59bc9]">
              {request.seller_type === "business" ? (
                <Building className="size-6" />
              ) : (
                <User className="size-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-[#fffafa]">
                  {request.full_name}
                </h2>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md ${
                    isApproved
                      ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30"
                      : isPending
                      ? "bg-amber-950/80 text-amber-300 border border-amber-500/30"
                      : "bg-rose-950/80 text-rose-300 border border-rose-500/30"
                  }`}
                >
                  {request.status}
                </span>
              </div>
              <p className="text-xs text-[#b9adb6] capitalize mt-0.5">
                {request.seller_type} Seller Account{" "}
                {request.business_name
                  ? `· Business Entity: ${request.business_name}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="text-right text-xs text-[#b9adb6]">
            <p>
              Submitted:{" "}
              <span className="text-[#fffafa] font-semibold">
                {new Date(request.submitted_at).toLocaleString()}
              </span>
            </p>
            {request.reviewed_at && (
              <p className="text-[11px] text-[#8f7d8c] mt-0.5">
                Reviewed: {new Date(request.reviewed_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* 3 Column Data */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-2">
            <span className="text-[10px] font-bold text-[#b9adb6] uppercase tracking-wider block">
              Government Identity
            </span>
            <div className="space-y-1.5 pt-1">
              <p className="text-[#fffafa] font-semibold flex items-center gap-2">
                <FileCheck className="size-3.5 text-[#e59bc9]" />
                <span>{request.id_type}</span>
              </p>
              <p className="text-[#b9adb6] flex items-center gap-2">
                <Calendar className="size-3.5 text-[#8f7d8c]" />
                <span>DOB: {request.date_of_birth}</span>
              </p>
              <p className="text-[#b9adb6] flex items-center gap-2">
                <MapPin className="size-3.5 text-[#8f7d8c]" />
                <span>{request.city_address}</span>
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-2">
            <span className="text-[10px] font-bold text-[#b9adb6] uppercase tracking-wider block">
              Contact & Profile
            </span>
            <div className="space-y-1.5 pt-1">
              <p className="text-[#fffafa] flex items-center gap-2">
                <Mail className="size-3.5 text-[#8f7d8c]" />
                <span>{request.contact_email}</span>
              </p>
              <p className="text-[#fffafa] flex items-center gap-2">
                <Phone className="size-3.5 text-[#8f7d8c]" />
                <span>{request.contact_phone}</span>
              </p>
              <p className="text-[11px] text-[#8f7d8c] pt-1">
                Account ID: {request.user_id}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-2">
            <span className="text-[10px] font-bold text-[#b9adb6] uppercase tracking-wider block">
              Uploaded Credentials
            </span>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  handleViewDocument(
                    request.id_front_path,
                    `Front ID - ${request.full_name}`
                  )
                }
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <FileCheck className="size-3.5 text-[#e59bc9]" />
                <span>View Front ID</span>
                <ExternalLink className="size-3 text-[#b9adb6]" />
              </button>

              {request.id_back_path && (
                <button
                  type="button"
                  onClick={() =>
                    handleViewDocument(
                      request.id_back_path!,
                      `Back ID - ${request.full_name}`
                    )
                  }
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FileCheck className="size-3.5 text-[#e59bc9]" />
                  <span>View Back ID</span>
                  <ExternalLink className="size-3 text-[#b9adb6]" />
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  handleViewDocument(
                    request.selfie_path,
                    `Selfie - ${request.full_name}`
                  )
                }
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Camera className="size-3.5 text-[#e59bc9]" />
                <span>View Selfie</span>
                <ExternalLink className="size-3 text-[#b9adb6]" />
              </button>
            </div>
          </div>
        </div>

        {/* OCR & Automated Review Telemetry */}
        <div className="p-5 rounded-xl bg-black/30 border border-white/5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#b9adb6] uppercase tracking-wider">
                Automated Review Telemetry
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                  request.automated_review_status === "passed"
                    ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/40"
                    : request.automated_review_status === "manual_review"
                    ? "bg-amber-950/90 text-amber-300 border border-amber-500/40"
                    : request.automated_review_status === "failed"
                    ? "bg-rose-950/90 text-rose-300 border border-rose-500/40"
                    : "bg-white/10 text-[#b9adb6] border border-white/10"
                }`}
              >
                {request.automated_review_status || "queued"}
              </span>
            </div>

            {request.automated_score !== null &&
              request.automated_score !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#b9adb6]">Confidence Score:</span>
                  <span className="text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-md bg-black/50 border border-white/10 text-[#fffafa]">
                    {request.automated_score}/100
                  </span>
                </div>
              )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#b9adb6]">
            <div className="p-2.5 rounded-lg bg-white/[0.02]">
              <span className="text-[10px] text-[#8f7d8c] block uppercase">
                OCR Name Extracted
              </span>
              <span className="font-semibold text-white">
                {request.extracted_full_name || "—"}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.02]">
              <span className="text-[10px] text-[#8f7d8c] block uppercase">
                OCR Date of Birth
              </span>
              <span className="font-semibold text-white">
                {request.extracted_date_of_birth || "—"}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.02]">
              <span className="text-[10px] text-[#8f7d8c] block uppercase">
                OCR ID Classification
              </span>
              <span className="font-semibold text-white">
                {request.extracted_id_type || "—"}
              </span>
            </div>
          </div>

          {Array.isArray(request.automated_flags) &&
            request.automated_flags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-[#8f7d8c] font-bold uppercase">
                  Telemetry Flags:
                </span>
                {request.automated_flags.map((flag) => (
                  <span
                    key={flag}
                    className="px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-500/30 text-amber-300 text-[10px] font-bold"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            )}

          {request.automated_review_summary && (
            <p className="text-xs text-[#b9adb6] pt-2 border-t border-white/5 italic">
              &ldquo;{request.automated_review_summary}&rdquo;
            </p>
          )}
        </div>

        {/* Rejection notice if rejected */}
        {isRejected && request.rejection_reason && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/20 text-xs text-rose-300 space-y-1">
            <span className="font-bold block">Rejection Reason:</span>
            <p>{request.rejection_reason}</p>
          </div>
        )}
      </div>

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
      {rejectingOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#1e1322] border border-white/20 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                <AlertTriangle className="size-4" />
                <span>Reject Seller Verification</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectingOpen(false)}
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
                placeholder="e.g. Document image is illegible or obstructed. Please re-upload a clear copy."
                className="w-full p-3 rounded-xl bg-[#342339]/60 border border-white/10 text-xs text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setRejectingOpen(false)}
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
