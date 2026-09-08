"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
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
import { getCurrentUserProfile, UserProfile } from "@/lib/supabase/auth";
import {
  getPendingVerificationRequests,
  reviewSellerVerification,
  getVerificationDocumentSignedUrl,
} from "@/lib/supabase/verification";
import type { SellerVerificationWithProfile } from "@/lib/supabase/types";
import { toast } from "sonner";

export default function AdminVerificationsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [requests, setRequests] = useState<SellerVerificationWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  // Rejection modal
  const [rejectingReqId, setRejectingReqId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Document preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      try {
        const userProfile = await getCurrentUserProfile();
        if (!isMounted) return;
        setProfile(userProfile);

        if (userProfile?.role === "admin") {
          const data = await getPendingVerificationRequests();
          if (isMounted) setRequests(data);
        }
      } catch (err) {
        console.error("Failed to load admin verification data:", err);
        toast.error("Failed to load verification requests.");
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
      const userProfile = await getCurrentUserProfile();
      setProfile(userProfile);

      if (userProfile?.role === "admin") {
        const data = await getPendingVerificationRequests();
        setRequests(data);
      }
    } catch (err) {
      console.error("Failed to load admin verification data:", err);
      toast.error("Failed to load verification requests.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    if (!confirm("Are you sure you want to approve this seller verification request? The user role will immediately become 'seller'.")) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await reviewSellerVerification(requestId, "approved");
      if (!res.success) {
        throw new Error(res.error || "Failed to approve request.");
      }
      toast.success("Seller verification approved successfully! User is now a seller.");
      await loadData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Approval failed.";
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
      toast.error("Please provide a reason for rejecting the verification request.");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await reviewSellerVerification(rejectingReqId, "rejected", rejectionReason.trim());
      if (!res.success) {
        throw new Error(res.error || "Failed to reject request.");
      }
      toast.success("Seller verification request rejected.");
      setRejectingReqId(null);
      setRejectionReason("");
      await loadData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Rejection failed.";
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
      const errorMsg = err instanceof Error ? err.message : "Failed to load document preview.";
      toast.error(errorMsg);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (selectedFilter === "all") return true;
    return r.status === selectedFilter;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#19131b] text-[#fffafa] flex flex-col items-center justify-center p-6">
        <Loader2 className="size-8 animate-spin text-[#e59bc9] mb-3" />
        <p className="text-xs font-semibold text-[#b9adb6]">Loading compliance dashboard…</p>
      </div>
    );
  }

  // Admin access guard
  if (!profile || profile.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#19131b] text-[#fffafa] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-3xl bg-[#241c27] border border-white/10 text-center space-y-4">
          <div className="size-14 rounded-2xl bg-rose-950/80 text-rose-300 border border-rose-500/40 flex items-center justify-center mx-auto">
            <AlertTriangle className="size-7" />
          </div>
          <h1 className="text-xl font-bold text-[#fffafa]">Administrator Access Required</h1>
          <p className="text-xs text-[#b9adb6] leading-relaxed">
            Only users with administrative privileges derived from database profiles can access the verification compliance panel.
          </p>
          <Link
            href="/marketplace"
            className="inline-block px-5 py-2.5 rounded-xl bg-[#65486f] text-white text-xs font-bold hover:bg-[#7a5985] transition-colors"
          >
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#2a1d2d] via-[#1c141f] to-[#120c14] text-[#fffafa] py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#b9adb6] hover:text-[#fffafa] transition-colors mb-2"
            >
              <ArrowLeft className="size-3.5 text-[#e59bc9]" />
              <span>Back to Marketplace</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#fffafa] tracking-tight flex items-center gap-2.5">
              <ShieldCheck className="size-7 text-[#e59bc9]" />
              <span>Seller Verification Compliance</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#b9adb6] mt-1">
              Review Philippine identity documents and authorize trusted sellers.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#281827] p-1.5 rounded-xl border border-white/10 self-start sm:self-auto">
            {(["pending", "approved", "rejected", "all"] as const).map((filter) => (
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
                {filter} {filter === "pending" ? `(${requests.filter((r) => r.status === "pending").length})` : ""}
              </button>
            ))}
          </div>
        </div>

        {/* List of Applications */}
        {filteredRequests.length === 0 ? (
          <div className="p-12 rounded-3xl bg-[#1e1322]/80 border border-white/10 text-center space-y-3">
            <CheckCircle2 className="size-10 text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-[#fffafa]">No verification requests found</h3>
            <p className="text-xs text-[#b9adb6]">
              {selectedFilter === "pending"
                ? "All pending seller verification applications have been reviewed."
                : `No verification records matching "${selectedFilter}".`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((req) => {
              const isPending = req.status === "pending";
              const isApproved = req.status === "approved";
              const isRejected = req.status === "rejected";

              return (
                <div
                  key={req.id}
                  className="p-6 rounded-2xl bg-[#1e1322]/90 border border-white/10 shadow-xl space-y-5"
                >
                  {/* Top info row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-[#342339] border border-white/10 flex items-center justify-center text-[#e59bc9]">
                        {req.seller_type === "business" ? (
                          <Building className="size-5" />
                        ) : (
                          <User className="size-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-[#fffafa]">{req.full_name}</h3>
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
                          {req.seller_type} Seller {req.business_name ? `· Business: ${req.business_name}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-xs text-[#b9adb6]">
                      <span className="block font-medium">
                        Submitted {new Date(req.submitted_at).toLocaleDateString()} at{" "}
                        {new Date(req.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {req.reviewed_at && (
                        <span className="text-[11px] text-[#8f7d8c]">
                          Reviewed {new Date(req.reviewed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1.5 bg-white/[0.02] p-3.5 rounded-xl border border-white/5">
                      <span className="text-[11px] font-bold text-[#b9adb6] uppercase tracking-wider block">
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

                    <div className="space-y-1.5 bg-white/[0.02] p-3.5 rounded-xl border border-white/5">
                      <span className="text-[11px] font-bold text-[#b9adb6] uppercase tracking-wider block">
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

                    <div className="space-y-2 bg-white/[0.02] p-3.5 rounded-xl border border-white/5">
                      <span className="text-[11px] font-bold text-[#b9adb6] uppercase tracking-wider block">
                        Secure Documents
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleViewDocument(req.id_front_path, `Front ID - ${req.full_name}`)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-white transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <FileCheck className="size-3 text-[#e59bc9]" />
                          <span>Front ID</span>
                          <ExternalLink className="size-2.5 ml-0.5 text-[#b9adb6]" />
                        </button>

                        {req.id_back_path && (
                          <button
                            type="button"
                            onClick={() => handleViewDocument(req.id_back_path!, `Back ID - ${req.full_name}`)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-white transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <FileCheck className="size-3 text-[#e59bc9]" />
                            <span>Back ID</span>
                            <ExternalLink className="size-2.5 ml-0.5 text-[#b9adb6]" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleViewDocument(req.selfie_path, `Selfie - ${req.full_name}`)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-white transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Camera className="size-3 text-[#e59bc9]" />
                          <span>Selfie</span>
                          <ExternalLink className="size-2.5 ml-0.5 text-[#b9adb6]" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Rejection reason callout if rejected */}
                  {isRejected && req.rejection_reason && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/20 text-xs text-rose-300 space-y-0.5">
                      <span className="font-bold block">Rejection Reason:</span>
                      <p>{req.rejection_reason}</p>
                    </div>
                  )}

                  {/* Action row (only if pending) */}
                  {isPending && (
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleOpenRejectModal(req.id)}
                        className="px-4 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Reject
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
      </div>

      {/* Document Preview Modal */}
      {(previewUrl || isLoadingPreview) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-[#1e1322] border border-white/20 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-[#fffafa]">{previewTitle || "Document Preview"}</h3>
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
                Reason for Rejection (Visible to Applicant) <span className="text-rose-400">*</span>
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
                {isProcessing && <Loader2 className="size-3.5 animate-spin text-white" />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
