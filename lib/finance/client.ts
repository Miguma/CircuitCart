import { createClient } from "@/lib/supabase/client";
import { payoutAccountInput } from "./contracts";

export interface FinanceSummary {
  totals: { gross: number; fees: number; net: number; collected: number; receivable: number;
    sandbox_gross: number; sandbox_fees: number; sales: number; transactions: number };
  payouts: { pending: number; eligible: number; processing: number; held: number; released: number };
  months: { month: string; net: number; sales: number }[];
  commissionRateBps: number;
}
export interface PayoutRow {
  id: string; order_id: string; gross_amount: number; platform_fee: number; net_amount: number;
  status: string; order_status: string; payment_method: string; commission_rate_bps: number | null;
  seller_name: string | null; shop_name: string; bank_name: string | null; account_name: string | null;
  account_last4: string | null; created_at: string; eligible_at: string | null; released_at: string | null;
}
export interface SavedAccount { id: string; bank_name: string; account_name: string; account_last4: string }

export const financeUnavailable = "Finance data could not be loaded. Verify your access and that the marketplace finance migration is installed.";
export const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);

export async function loadFinanceSummary(): Promise<FinanceSummary> {
  const { data, error } = await createClient().rpc("finance_summary");
  if (error || !data) throw new Error(financeUnavailable);
  return data;
}
export async function loadPayouts(offset = 0): Promise<PayoutRow[]> {
  const { data, error } = await createClient().rpc("finance_payout_history", { p_offset: offset });
  if (error || !Array.isArray(data)) throw new Error(financeUnavailable);
  return data;
}
export async function loadPayoutAccount(): Promise<SavedAccount | null> {
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("Sign in as a seller to manage payouts.");
  const { data, error } = await client.from("seller_payout_accounts")
    .select("id, bank_name, account_name, account_last4").eq("seller_id", user.id).maybeSingle();
  if (error) throw new Error(financeUnavailable);
  return data;
}
export async function savePayoutAccount(input: unknown): Promise<void> {
  const parsed = payoutAccountInput.safeParse(input);
  if (!parsed.success) throw new Error("Enter a bank name, account holder name, and 6–34 digit account number.");
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("Sign in as a seller to save your payout account.");
  const { data: shop, error: shopError } = await client.from("shops").select("id").eq("owner_id", user.id).single();
  if (shopError || !shop) throw new Error("An owned shop is required to save a payout account.");
  const { error } = await client.from("seller_payout_accounts").upsert({
    seller_id: user.id, shop_id: shop.id, method: "bank", bank_name: parsed.data.bankName,
    account_name: parsed.data.accountName, account_number: parsed.data.accountNumber,
    is_default: true, is_active: true,
  }, { onConflict: "shop_id" });
  // Never display raw Postgres errors: a constraint failure can contain full account details.
  if (error) throw new Error("Unable to save payout account. Check your details and seller access.");
}
