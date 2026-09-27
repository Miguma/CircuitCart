import { SellerLayout } from "@/components/seller/seller-layout";
import { FinanceDashboard } from "@/components/finance/finance-dashboard";
import { PayoutAccount } from "@/components/finance/payout-account";

export default function SellerPayoutsPage() {
  return <SellerLayout title="Payouts" subtitle="Your saved payout destination and marketplace earnings." showAddProduct={false}>
    <PayoutAccount /><FinanceDashboard />
  </SellerLayout>;
}
