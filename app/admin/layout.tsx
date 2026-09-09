import React from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Console | CircuitCart",
  description: "CircuitCart Platform Administration and Operations",
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
