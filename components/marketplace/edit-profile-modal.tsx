"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, User, MapPin, AtSign, FileText } from "lucide-react";
import { useMarketplace } from "./marketplace-provider";
import { toast } from "sonner";
import { updateCurrentUserProfile } from "@/lib/supabase/auth";
import { useMarketplaceAccount } from "./marketplace-account";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  onProfileUpdated?: () => void;
}

function EditProfileForm({
  onClose,
  triggerRef,
  onProfileUpdated,
}: {
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  onProfileUpdated?: () => void;
}) {
  const { demoProfile, updateProfile } = useMarketplace();
  const { profile } = useMarketplaceAccount();

  const [name, setName] = useState(profile?.full_name || demoProfile.name);
  const [username, setUsername] = useState(profile?.username || demoProfile.username);
  const [location, setLocation] = useState(profile?.location || demoProfile.location);
  const [bio, setBio] = useState(profile?.bio || demoProfile.bio);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => triggerRef?.current?.focus(), 50);
  }, [onClose, triggerRef]);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!username.trim()) {
      setError("Username is required.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const cleanUsername = username.trim().replace(/^@/, "");

    // Update in Supabase if logged in
    const res = await updateCurrentUserProfile({
      full_name: name.trim(),
      username: cleanUsername,
      location: location.trim(),
      bio: bio.trim(),
    });

    setIsSaving(false);

    if (!res.success && res.error) {
      setError(res.error);
      return;
    }

    // Update local state
    updateProfile({
      name: name.trim(),
      username: `@${cleanUsername}`,
      location: location.trim(),
      bio: bio.trim(),
    });

    toast.success("Profile updated successfully.");
    onProfileUpdated?.();
    handleClose();
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 glass-dialog-overlay animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={handleClose} />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="bg-[#241c27] text-[#fffafa] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative z-10 animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div>
            <h2 id="edit-profile-title" className="text-lg font-bold text-white">
              Edit Profile
            </h2>
            <p className="text-xs text-[#b9adb6] mt-0.5">
              Update your demo profile details for this browser session.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close edit profile modal"
            className="p-1.5 text-[#b9adb6] hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#b9adb6] flex items-center gap-1.5">
              <User className="size-3.5 text-[#e59bc9]" />
              <span>Full Name</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              required
              className="w-full h-10 px-3.5 bg-[#342339] border border-white/10 rounded-xl text-xs text-white placeholder-[#b9adb6] focus:border-[#e59bc9] focus:outline-none focus:ring-2 focus:ring-[#e59bc9]/30 transition-all"
              placeholder="e.g. Demo User"
            />
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#b9adb6] flex items-center gap-1.5">
              <AtSign className="size-3.5 text-[#e59bc9]" />
              <span>Username</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              required
              className="w-full h-10 px-3.5 bg-[#342339] border border-white/10 rounded-xl text-xs text-white placeholder-[#b9adb6] focus:border-[#e59bc9] focus:outline-none focus:ring-2 focus:ring-[#e59bc9]/30 transition-all"
              placeholder="e.g. @demouser"
            />
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#b9adb6] flex items-center gap-1.5">
              <MapPin className="size-3.5 text-[#e59bc9]" />
              <span>Location</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setError(null);
              }}
              required
              className="w-full h-10 px-3.5 bg-[#342339] border border-white/10 rounded-xl text-xs text-white placeholder-[#b9adb6] focus:border-[#e59bc9] focus:outline-none focus:ring-2 focus:ring-[#e59bc9]/30 transition-all"
              placeholder="e.g. Cebu City, Central Visayas"
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#b9adb6] flex items-center gap-1.5">
                <FileText className="size-3.5 text-[#e59bc9]" />
                <span>Biography</span>
              </label>
              <span className="text-[11px] text-[#b9adb6]">
                {bio.length}/160
              </span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => {
                if (e.target.value.length <= 160) {
                  setBio(e.target.value);
                }
              }}
              rows={3}
              className="w-full p-3 bg-[#342339] border border-white/10 rounded-xl text-xs text-white placeholder-[#b9adb6] focus:border-[#e59bc9] focus:outline-none focus:ring-2 focus:ring-[#e59bc9]/30 transition-all resize-none"
              placeholder="Tell buyers and sellers a little about your tech interests..."
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-[#b9adb6] hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-semibold bg-[#65486f] hover:bg-[#7a5985] text-white rounded-xl shadow-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#e59bc9] disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EditProfileModal({
  isOpen,
  onClose,
  triggerRef,
  onProfileUpdated,
}: EditProfileModalProps) {
  if (!isOpen) return null;
  return (
    <EditProfileForm
      onClose={onClose}
      triggerRef={triggerRef}
      onProfileUpdated={onProfileUpdated}
    />
  );
}

