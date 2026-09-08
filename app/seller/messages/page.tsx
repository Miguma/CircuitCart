"use client";

import { MessagesWorkspace } from "@/components/messages/messages-workspace";
import { SellerLayout } from "@/components/seller/seller-layout";

export default function SellerMessagesPage() {
  return (
    <SellerLayout showAddProduct={false}>
      <MessagesWorkspace />
    </SellerLayout>
  );
}
