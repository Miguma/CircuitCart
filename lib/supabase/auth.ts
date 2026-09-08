import { createClient } from "./client";
import type { User } from "@supabase/supabase-js";

export type UserRole = "buyer" | "seller" | "admin";

export interface UserProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  location: string | null;
  bio: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Sign in with email and password using Supabase Auth
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResponse<User>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to sign in. Please check your credentials.",
      };
    }

    return {
      success: true,
      data: data.user,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred.";
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Register a new user account with Supabase Auth and initialize profile
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string
): Promise<AuthResponse<{ user: User | null; sessionExists: boolean; confirmationRequired: boolean }>> {
  try {
    const supabase = createClient();
    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = fullName.trim();
    const generatedUsername = cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanFullName,
          username: generatedUsername,
          role: "buyer",
        },
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Registration failed. Please try again.",
      };
    }

    // Check if email confirmation is required (user created but no session)
    const confirmationRequired = !data.session && !!data.user;

    return {
      success: true,
      data: {
        user: data.user,
        sessionExists: !!data.session,
        confirmationRequired,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred.";
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Sign out the current user session
 */
export async function signOut(): Promise<AuthResponse> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "An error occurred during logout.";
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Retrieve current authenticated user
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/**
 * Retrieve profile of the currently logged in user
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return profile as UserProfile | null;
  } catch {
    return null;
  }
}

/**
 * Update profile of the currently logged in user
 */
export async function updateCurrentUserProfile(
  updates: Partial<Pick<UserProfile, "full_name" | "username" | "location" | "bio" | "avatar_url">>
): Promise<AuthResponse<UserProfile>> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: profile as UserProfile };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update profile.";
    return { success: false, error: errorMsg };
  }
}

