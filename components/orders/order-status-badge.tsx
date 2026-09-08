import { CheckCircle2, Clock, MapPin, Package, Truck } from "lucide-react";

type OrderStatusBadgeProps = {
  status: string;
};

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const appearance = (() => {
    switch (normalizedStatus) {
      case "pending":
        return { label: "Pending confirmation", icon: Clock, className: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
      case "confirmed":
        return { label: "Confirmed", icon: CheckCircle2, className: "bg-sky-500/20 text-sky-300 border-sky-500/30" };
      case "preparing":
      case "packed":
        return { label: normalizedStatus === "packed" ? "Packed" : "Preparing package", icon: Package, className: "bg-[#45284f] text-[#e59bc9] border-[#e59bc9]/30" };
      case "ready":
      case "ready for dispatch":
        return { label: normalizedStatus === "ready" ? "Ready for pickup / delivery" : "Ready for dispatch", icon: Truck, className: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" };
      case "ready for meetup":
        return { label: "Ready for meetup", icon: MapPin, className: "bg-purple-500/20 text-purple-300 border-purple-500/30" };
      case "shipped":
        return { label: "Shipped", icon: Truck, className: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
      case "delivered":
      case "completed":
        return { label: normalizedStatus === "delivered" ? "Delivered" : "Completed", icon: CheckCircle2, className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
      case "cancelled":
        return { label: "Cancelled", icon: null, className: "bg-rose-500/20 text-rose-300 border-rose-500/30" };
      default:
        return { label: status, icon: null, className: "bg-white/10 text-white/80 border-white/20" };
    }
  })();
  const Icon = appearance.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${appearance.className}`}>
      {Icon && <Icon className="size-3 shrink-0" />}
      {appearance.label}
    </span>
  );
}
