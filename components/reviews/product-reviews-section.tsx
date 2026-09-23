"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Star, CheckCircle2, AlertCircle, MessageSquare } from "lucide-react";
import { getProductReviews } from "@/lib/supabase/reviews";
import type { ReviewWithAuthor } from "@/lib/supabase/types";

interface ProductReviewsSectionProps {
  productId: string;
  rating: number;
  reviewCount: number;
}

export function ProductReviewsSection({
  productId,
  rating,
  reviewCount,
}: ProductReviewsSectionProps) {
  const [reviews, setReviews] = useState<ReviewWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getProductReviews(productId)
      .then((data) => {
        if (isMounted) {
          setReviews(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Failed to load customer reviews:", err);
        if (isMounted) {
          setError("Reviews are temporarily unavailable.");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [productId]);

  const roundedRating = Math.round(rating);

  return (
    <section
      aria-labelledby="customer-reviews-heading"
      className="bg-[#241c27] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl"
    >
      {/* Section Header & Aggregate Rating */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <h2
            id="customer-reviews-heading"
            className="text-xl sm:text-2xl font-extrabold text-white tracking-tight"
          >
            Customer Reviews
          </h2>
          <p className="text-xs text-[#b9adb6] mt-1">
            Ratings and reviews submitted by verified buyers from completed orders.
          </p>
        </div>

        {/* Rating Aggregate Summary */}
        <div className="flex items-center gap-4 bg-[#1e1322] border border-white/[0.06] rounded-2xl px-4 py-3 shrink-0 self-start sm:self-auto">
          <div className="text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-2xl font-black text-white">
                {reviewCount > 0 ? rating.toFixed(1) : "0.0"}
              </span>
              <span className="text-xs text-amber-400 font-bold">★</span>
            </div>
            <span className="text-[11px] text-[#b9adb6] block">
              {reviewCount === 0
                ? "No reviews yet"
                : reviewCount === 1
                ? "Based on 1 review"
                : `Based on ${reviewCount} reviews`}
            </span>
          </div>

          <div className="border-l border-white/10 pl-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((starIndex) => (
                <Star
                  key={starIndex}
                  className={`size-4 ${
                    starIndex <= roundedRating && reviewCount > 0
                      ? "fill-amber-400 text-amber-400"
                      : "text-[#554b57] fill-transparent"
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] text-[#8a7f8b] block mt-0.5">
              Verified Marketplace Aggregate
            </span>
          </div>
        </div>
      </div>

      {/* Body: Loading vs Error vs Empty vs Reviews List */}
      {isLoading ? (
        <div
          role="status"
          aria-label="Loading customer reviews"
          className="space-y-4"
        >
          {[1, 2].map((idx) => (
            <div
              key={idx}
              className="bg-[#1e1322]/60 border border-white/[0.06] rounded-2xl p-4 sm:p-5 space-y-3 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-white/10" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-28 bg-white/10 rounded-md" />
                    <div className="h-2.5 w-16 bg-white/5 rounded-md" />
                  </div>
                </div>
                <div className="h-3 w-20 bg-white/10 rounded-md" />
              </div>
              <div className="h-3 w-3/4 bg-white/5 rounded-md" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 sm:p-5 text-xs text-rose-300 flex items-center gap-2.5"
        >
          <AlertCircle className="size-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-[#1e1322]/50 border border-white/[0.06] rounded-2xl p-8 sm:p-10 text-center space-y-2.5">
          <div className="size-11 rounded-full bg-[#342339] border border-white/10 flex items-center justify-center mx-auto text-[#e59bc9]">
            <MessageSquare className="size-5 stroke-[1.5]" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white">
            No customer reviews yet for this product.
          </h3>
          <p className="text-xs text-[#b9adb6] max-w-sm mx-auto leading-relaxed">
            Ratings and feedback from verified buyers will appear here once orders are completed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const authorName = review.profiles?.full_name?.trim() || "Verified Buyer";
            const initial = authorName.charAt(0).toUpperCase() || "B";
            const avatarUrl = review.profiles?.avatar_url;
            const dateStr = new Date(review.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            const hasComment = Boolean(review.comment && review.comment.trim().length > 0);

            return (
              <article
                key={review.id}
                className="bg-[#1e1322]/80 border border-white/[0.06] rounded-2xl p-4 sm:p-5 space-y-3 transition-colors hover:border-white/10"
              >
                {/* Author row & rating */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar with fallback */}
                    <div className="size-9 rounded-full bg-[#342339] border border-white/10 flex items-center justify-center text-xs font-bold text-[#fffafa] overflow-hidden shrink-0">
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt={authorName}
                          width={36}
                          height={36}
                          className="size-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <span>{initial}</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-white truncate">
                          {authorName}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-1.5 py-0.2 rounded-md shrink-0">
                          <CheckCircle2 className="size-3" />
                          Verified Purchase
                        </span>
                      </div>
                      <span className="text-[11px] text-[#8a7f8b] block">
                        Reviewed on {dateStr}
                      </span>
                    </div>
                  </div>

                  {/* Star Rating for this review */}
                  <div
                    className="flex items-center gap-1 shrink-0 self-start sm:self-center"
                    aria-label={`Rating: ${review.rating} out of 5 stars`}
                  >
                    {[1, 2, 3, 4, 5].map((starValue) => (
                      <Star
                        key={starValue}
                        className={`size-3.5 ${
                          starValue <= review.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-[#554b57] fill-transparent"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Comment (Rendered ONLY if comment is present and non-empty) */}
                {hasComment && (
                  <p className="text-xs sm:text-sm text-[#d6cbd5] leading-relaxed whitespace-pre-line pt-1 border-t border-white/[0.04]">
                    {review.comment}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
