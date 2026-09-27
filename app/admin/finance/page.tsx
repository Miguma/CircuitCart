import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { FinanceDashboard } from "@/components/finance/finance-dashboard";

export default function AdminFinancePage() {
  return <div className="space-y-6"><AdminPageHeader title="Finance" subtitle="Commission, seller earnings, and simulated payout management." /><FinanceDashboard admin /></div>;
}
