"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Star, X, Loader2, Package, AlertCircle } from "lucide-react";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { submitProductReview } from "@/lib/supabase/reviews";
import type { DbOrderItem, DbReview } from "@/lib/supabase/types";
import { toast } from "sonner";

interface ReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderItem: DbOrderItem | null;
  existingReview?: DbReview | null;
  onSuccess: (orderItemId: string) => Promise<void> | void;
}

const RATING_DESCRIPTIONS: Record<number, string> = {
  1: "1 - Poor",
  2: "2 - Fair",
  3: "3 - Good",
  4: "4 - Very Good",
  5: "5 - Excellent",
};

export function ReviewDialog({
  isOpen,
  onClose,
  orderItem,
  existingReview,
  onSuccess,
}: ReviewDialogProps) {
  if (!isOpen || !orderItem) return null;

  return (
    <ReviewDialogModal
      key={`${orderItem.id}-${existingReview?.id ?? "new"}`}
      onClose={onClose}
      orderItem={orderItem}
      existingReview={existingReview}
      onSuccess={onSuccess}
    />
  );
}

function ReviewDialogModal({
  onClose,
  orderItem,
  existingReview,
  onSuccess,
}: Omit<ReviewDialogProps, "isOpen"> & { orderItem: DbOrderItem }) {
  const [rating, setRating] = useState<number>(existingReview?.rating ?? 0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState<string>(existingReview?.comment ?? "");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose]);

  const isEditing = Boolean(existingReview);
  const activeRating = hoveredRating || rating;
  const isCommentTooLong = comment.length > 1000;
  const canSubmit = rating >= 1 && rating <= 5 && !isCommentTooLong && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating < 1 || rating > 5) {
      setErrorMessage("Please select a rating between 1 and 5 stars.");
      return;
    }

    if (comment.length > 1000) {
      setErrorMessage("Review comment must not exceed 1000 characters.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await submitProductReview({
        orderItemId: orderItem.id,
        rating,
        comment: comment.trim() || null,
      });

      toast.success(
        isEditing
          ? "Review updated successfully!"
          : "Review submitted successfully!"
      );

      await onSuccess(orderItem.id);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to submit review. Please try again.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-[#241c27] border border-white/10 rounded-3xl p-5 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl relative animate-in zoom-in-95 duration-150">
        {/* Header with Close Button */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3
              id="review-dialog-title"
              className="text-lg sm:text-xl font-extrabold text-white tracking-tight"
            >
              {isEditing ? "Edit Your Review" : "Write a Review"}
            </h3>
            <p className="text-xs text-[#b9adb6] mt-0.5">
              Verified purchase feedback helps tech buyers across Cebu and the Visayas.
            </p>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-[#b9adb6] hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Product Snapshot Row */}
        <div className="flex items-center gap-3 p-3 bg-[#1e1322] border border-white/[0.06] rounded-2xl">
          <div className="size-12 rounded-xl overflow-hidden bg-[#ebe2e5] border border-[#ded0d5] flex items-center justify-center shrink-0 p-1">
            {orderItem.product_image_path ? (
              <Image
                src={getProductImageUrl(orderItem.product_image_path)}
                alt={orderItem.product_title}
                width={48}
                height={48}
                className="size-full object-contain"
              />
            ) : (
              <Package className="size-5 text-[#65486f]" />
            )}
          </div>

          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-white truncate">
              {orderItem.product_title}
            </h4>
            <span className="text-[11px] text-[#b9adb6]">
              Verified Purchase Line Item
            </span>
          </div>
        </div>

        {/* Error Alert Box (if any) */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-rose-300"
          >
            <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-400" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Review Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Star Rating Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#d6cbd5] uppercase tracking-wider block">
              Rating <span className="text-rose-400">*</span>
            </label>

            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((starValue) => {
                const isFilled = starValue <= activeRating;
                return (
                  <button
                    key={starValue}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setRating(starValue)}
                    onMouseEnter={() => setHoveredRating(starValue)}
                    onMouseLeave={() => setHoveredRating(0)}
                    aria-label={`Rate ${starValue} stars`}
                    className="p-1 rounded-lg hover:bg-white/[0.06] transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Star
                      className={`size-7 transition-colors ${
                        isFilled
                          ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]"
                          : "text-[#716872] fill-transparent hover:text-amber-300"
                      }`}
                    />
                  </button>
                );
              })}

              <span className="text-xs font-semibold text-white ml-2">
                {activeRating > 0
                  ? RATING_DESCRIPTIONS[activeRating]
                  : "Tap a star to rate"}
              </span>
            </div>
          </div>

          {/* Comment Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label
                htmlFor="review-comment-textarea"
                className="font-bold text-[#d6cbd5] uppercase tracking-wider"
              >
                Review Comment{" "}
                <span className="text-[#b9adb6] font-normal normal-case">
                  (Optional)
                </span>
              </label>

              <span
                className={`text-[11px] font-medium ${
                  isCommentTooLong ? "text-rose-400 font-bold" : "text-[#b9adb6]"
                }`}
              >
                {comment.length} / 1000
              </span>
            </div>

            <textarea
              id="review-comment-textarea"
              rows={4}
              maxLength={1050}
              disabled={isSubmitting}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell other buyers about condition, battery health, performance, seller packaging, or pickup experience..."
              className="w-full bg-[#1e1322] border border-white/10 rounded-2xl p-3 text-xs sm:text-sm text-white placeholder:text-[#8f7d8c] focus:outline-none focus:border-[#e59bc9] transition-colors resize-none disabled:opacity-50"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#d6cbd5] hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!canSubmit}
              className="px-5 py-2 text-xs font-bold text-white bg-[#65486f] hover:bg-[#7a5985] rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving Review…</span>
                </>
              ) : (
                <span>{isEditing ? "Save Changes" : "Submit Review"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
