"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUser, getCurrentUserProfile, type UserProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/client";

interface MarketplaceAccount {
  userId: string | null;
  profile: UserProfile | null;
  email: string | null;
  isSeller: boolean;
  isLoading: boolean;
  refreshAccount: () => Promise<void>;
}

const AccountContext = createContext<MarketplaceAccount>({
  userId: null,
  profile: null,
  email: null,
  isSeller: false,
  isLoading: true,
  refreshAccount: async () => {},
});

// Read-only presentation state. Authorization remains in the existing backend.
export function MarketplaceAccountProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<MarketplaceAccount>({
    userId: null,
    profile: null,
    email: null,
    isSeller: false,
    isLoading: true,
    refreshAccount: async () => {},
  });

  useEffect(() => {
    let active = true;
    let revision = 0;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const supabase = createClient();

    async function loadAccount() {
      const request = ++revision;
      const [user, profile] = await Promise.all([getCurrentUser(), getCurrentUserProfile()]);
      if (!active || request !== revision) return;
      const verifiedProfile = user && profile?.id === user.id ? profile : null;
      setAccount({
        userId: user?.id ?? null,
        profile: verifiedProfile,
        email: user?.email ?? null,
        isSeller: verifiedProfile?.role === "seller" || verifiedProfile?.role === "admin",
        isLoading: false,
        refreshAccount: loadAccount,
      });
    }

    void loadAccount();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      ++revision;
      clearTimeout(pending);
      if (!session) {
        setAccount({
          userId: null,
          profile: null,
          email: null,
          isSeller: false,
          isLoading: false,
          refreshAccount: loadAccount,
        });
      } else {
        setAccount({
          userId: session.user.id,
          profile: null,
          email: session.user.email ?? null,
          isSeller: false,
          isLoading: true,
          refreshAccount: loadAccount,
        });
        // Keep async profile reads outside the auth callback's lock.
        pending = setTimeout(() => void loadAccount(), 0);
      }
    });

    return () => { active = false; clearTimeout(pending); subscription.unsubscribe(); };
  }, []);

  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>;
}

export function useMarketplaceAccount() { return useContext(AccountContext); }
