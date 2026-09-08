"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUser, getCurrentUserProfile, type UserProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/client";

interface MarketplaceAccount {
  userId: string | null;
  profile: UserProfile | null;
  isSeller: boolean;
  isLoading: boolean;
}

const AccountContext = createContext<MarketplaceAccount>({
  userId: null, profile: null, isSeller: false, isLoading: true,
});

// Read-only presentation state. Authorization remains in the existing backend.
export function MarketplaceAccountProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<MarketplaceAccount>({
    userId: null, profile: null, isSeller: false, isLoading: true,
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
        isSeller: verifiedProfile?.role === "seller" || verifiedProfile?.role === "admin",
        isLoading: false,
      });
    }

    void loadAccount();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      ++revision;
      clearTimeout(pending);
      setAccount({ userId: session?.user.id ?? null, profile: null, isSeller: false, isLoading: !!session });
      // Keep async profile reads outside the auth callback's lock.
      if (session) pending = setTimeout(() => void loadAccount(), 0);
    });

    return () => { active = false; clearTimeout(pending); subscription.unsubscribe(); };
  }, []);

  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>;
}

export function useMarketplaceAccount() { return useContext(AccountContext); }
