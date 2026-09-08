"use client";

import React, { useState, useRef, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Send,
  Search,
  CheckCheck,
  ShoppingBag,
  Package,
  Sparkles,
  ArrowLeft,
  Info,
  X,
  Paperclip,
  CheckCircle2,
  Tag,
  Eye,
  Store,
  Loader2,
} from "lucide-react";
import { useMarketplace } from "@/components/marketplace/marketplace-provider";
import { useMarketplaceAccount } from "@/components/marketplace/marketplace-account";
import {
  ConversationWithDetails,
  MessageWithSender,
  DbOrderStatus,
  DbProductStatus,
} from "@/lib/supabase/types";
import {
  getConversations,
  getConversationMessages,
  sendMessage,
  markConversationRead,
  subscribeToConversation,
  formatMessageDateGroup,
  formatMessageTime,
} from "@/lib/supabase/messages";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { formatOrderReference } from "@/lib/supabase/orders";
import { mapDbProductToMarketplaceProduct } from "@/lib/marketplace/product-adapter";
import { toast } from "sonner";

function MessagesContent() {
  const searchParams = useSearchParams();
  const initialConvId = searchParams.get("conversationId");

  const { setQuickViewProduct } = useMarketplace();
  const { userId, isLoading: isLoadingAccount } = useMarketplaceAccount();

  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(initialConvId);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [activeTab, setActiveTab] = useState<"All" | "Unread" | "Buying" | "Selling">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showMobileContext, setShowMobileContext] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Both routes use the same participant-scoped conversation list.
  useEffect(() => {
    if (isLoadingAccount) return;
    let active = true;

    getConversations()
      .then((data) => {
        if (!active) return;
        setConversations(data);
        setIsLoadingList(false);

        // Preserve deep links while keeping an unavailable conversation from
        // hiding the inbox on mobile.
        setSelectedChatId((previous) => {
          if (initialConvId && data.some((c) => c.id === initialConvId)) {
            return initialConvId;
          }
          return data.some((c) => c.id === previous) ? previous : data[0]?.id ?? null;
        });
      })
      .catch((err) => {
        console.warn("Failed to load conversations:", err);
        if (active) setIsLoadingList(false);
      });

    return () => {
      active = false;
    };
  }, [initialConvId, userId, isLoadingAccount]);

  // Active selected conversation
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedChatId) || null;
  }, [conversations, selectedChatId]);
  const isSelling = !!userId && activeConversation?.seller_id === userId;

  // 2. Load messages and subscribe to Realtime whenever selectedChatId changes
  useEffect(() => {
    if (!selectedChatId) {
      return;
    }

    let active = true;

    // Fetch initial history
    getConversationMessages(selectedChatId)
      .then((data) => {
        if (!active) return;
        setMessages(data);
        setIsLoadingMessages(false);
        markConversationRead(selectedChatId);
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedChatId ? { ...c, unread_count: 0 } : c))
        );
      })
      .catch((err) => {
        console.warn("Failed to fetch messages:", err);
        if (active) setIsLoadingMessages(false);
      });

    // Realtime channel subscription
    const unsubscribe = subscribeToConversation(selectedChatId, (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) {
          return prev;
        }
        return [...prev, newMsg as MessageWithSender];
      });

      // Update conversation list item
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== selectedChatId) return c;
          return {
            ...c,
            last_message_at: newMsg.created_at,
            messages: [...(c.messages || []), newMsg],
          };
        })
      );

      // Auto mark read if conversation is active
      markConversationRead(selectedChatId);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [selectedChatId]);

  // Scroll to bottom on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Select conversation handler
  const handleSelectConversation = (convId: string) => {
    if (convId === selectedChatId) return;
    setSelectedChatId(convId);
    setIsLoadingMessages(true);
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
    );
  };

  // Suggestions follow the user's part in this conversation, not their account role.
  const quickReplies = isSelling ? [
    { label: "Still available", text: "Yes, this item is still available and ready for purchase!" },
    { label: "Yes, negotiable", text: "Yes, the price is slightly negotiable for fast pickup/checkout." },
    { label: "Meetup available", text: "I'm available for in-person meetup and testing in Cebu City / IT Park." },
    { label: "Delivery available", text: "We can arrange fast delivery with safe bubble wrap packaging." },
    { label: "Can ship today", text: "I can pack and dispatch this order today with fragile handling." },
  ] : [
    { label: "Is this available?", text: "Hi! Is this item still available?" },
    { label: "Meetup location", text: "Can we arrange a meetup in Cebu City / IT Park?" },
    { label: "Shipping options", text: "Do you offer delivery/shipping for this item?" },
    { label: "Best price?", text: "What is your best price for fast cash/GCash checkout?" },
    { label: "Condition check", text: "Does this come with original box, accessories, and receipt?" },
  ];

  // Send a message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !selectedChatId || !userId || isSending) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: MessageWithSender = {
      id: tempId,
      conversation_id: selectedChatId,
      sender_id: userId,
      body: text,
      created_at: new Date().toISOString(),
      read_at: null,
    };

    // Optimistic UI update
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    setIsSending(true);

    try {
      const realMsg = await sendMessage(selectedChatId, text);

      // Replace optimistic entry
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...realMsg } : m))
      );

      // Update conversation in list
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== selectedChatId) return c;
          return {
            ...c,
            last_message_at: realMsg.created_at,
            messages: [...(c.messages || []).filter((m) => m.id !== tempId), realMsg],
          };
        })
      );
    } catch (err: unknown) {
      // Rollback on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      const msg = err instanceof Error ? err.message : "Failed to send message.";
      toast.error(msg);
    } finally {
      setIsSending(false);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filtered conversation list
  const filteredConversations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return conversations.filter((c) => {
      const shopName = c.shops?.name || "";
      const sellerName = c.seller?.full_name || c.seller?.username || "Seller";
      const buyerName = c.buyer?.full_name || c.buyer?.username || "Buyer";
      const prodName = c.products?.title || "";
      const lastMsg = c.messages?.[c.messages.length - 1]?.body || "";

      const matchesSearch =
        !q ||
        shopName.toLowerCase().includes(q) ||
        sellerName.toLowerCase().includes(q) ||
        buyerName.toLowerCase().includes(q) ||
        prodName.toLowerCase().includes(q) ||
        lastMsg.toLowerCase().includes(q);

      const matchesTab = activeTab === "All" ||
        (activeTab === "Unread" && (c.unread_count || 0) > 0) ||
        (activeTab === "Buying" && c.buyer_id === userId) ||
        (activeTab === "Selling" && c.seller_id === userId);

      return matchesSearch && matchesTab;
    });
  }, [conversations, searchQuery, activeTab, userId]);

  const totalUnread = useMemo(() => {
    return conversations.reduce((acc, c) => acc + ((c.unread_count || 0) > 0 ? 1 : 0), 0);
  }, [conversations]);

  // Product helper for QuickView
  const handleOpenProductModal = (productDb: ConversationWithDetails["products"]) => {
    if (!productDb) return;
    const mapped = mapDbProductToMarketplaceProduct({
      ...productDb,
      seller_id: activeConversation?.seller_id ?? productDb.seller_id,
      shops: activeConversation?.shops,
    });
    setQuickViewProduct(mapped);
  };

  const getListingStatusBadge = (status?: DbProductStatus) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30">
            <span className="size-1 rounded-full bg-emerald-400" />
            Active
          </span>
        );
      case "sold_out":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/70 text-amber-300 border border-amber-500/30">
            Sold Out
          </span>
        );
      case "archived":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-[#b9adb6]">
            Archived
          </span>
        );
      default:
        return null;
    }
  };

  const getOrderStatusBadge = (status?: DbOrderStatus) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/70 text-amber-300 border border-amber-500/30">
            Pending
          </span>
        );
      case "confirmed":
      case "preparing":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#45284f] text-[#e59bc9] border border-[#e59bc9]/30">
            Processing
          </span>
        );
      case "ready":
      case "shipped":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-950/70 text-sky-300 border border-sky-500/30">
            Shipped / Ready
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30">
            Completed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-950/70 text-rose-300 border border-rose-500/30">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const activeParticipant = isSelling ? activeConversation?.buyer : activeConversation?.seller;
  const activeParticipantName = isSelling
    ? activeParticipant?.full_name || activeParticipant?.username || "Buyer"
    : activeConversation?.shops?.name || activeParticipant?.full_name || activeParticipant?.username || "Seller";
  const ordersHref = isSelling ? "/seller/orders" : "/marketplace/orders";

  const activeProductImage =
    activeConversation?.products?.product_images?.[0]?.storage_path
      ? getProductImageUrl(activeConversation.products.product_images[0].storage_path)
      : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Header Bar */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <MessageSquare className="size-6 text-[#e59bc9]" />
            <span>Messages</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#d6cbd5] mt-0.5">
            Your buying and selling conversations, together in one place.
          </p>
        </div>
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-[#d6cbd5] hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Marketplace</span>
        </Link>
      </div>

      {/* PRIMARY MESSAGING WORKSPACE */}
      <div className="h-[calc(100vh-14rem)] min-h-[580px] max-h-[820px] bg-[#1a0f1d]/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl flex relative">
        {/* ========================================================= */}
        {/* COLUMN 1: CONVERSATION LIST (~290px)                      */}
        {/* ========================================================= */}
        <div
          className={`w-full md:w-[290px] shrink-0 border-r border-white/[0.06] flex flex-col bg-[#170c1a]/95 ${
            selectedChatId ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Top Header & Search */}
          <div className="p-3.5 border-b border-white/[0.06] space-y-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#d6cbd5] flex items-center gap-1.5">
                <MessageSquare className="size-3.5 text-[#e59bc9]" />
                <span>Conversations</span>
              </h2>
              <span className="text-[11px] px-2 py-0.2 rounded-full bg-white/[0.06] text-[#b9adb6] font-medium">
                {conversations.length}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-[#8f7d8c] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people, shops, or items..."
                aria-label="Search conversations"
                className="w-full h-8 pl-7.5 pr-7 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear conversation search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8f7d8c] hover:text-white cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Buying and selling are conversation contexts, not separate inboxes. */}
            <div className="flex items-center p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
              <button
                type="button"
                onClick={() => setActiveTab("All")}
                aria-pressed={activeTab === "All"}
                className={`flex-1 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  activeTab === "All"
                    ? "bg-[#54385c] text-white shadow-xs"
                    : "text-[#8f7d8c] hover:text-[#fffafa]"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("Unread")}
                aria-pressed={activeTab === "Unread"}
                className={`flex-1 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  activeTab === "Unread"
                    ? "bg-[#54385c] text-white shadow-xs"
                    : "text-[#8f7d8c] hover:text-[#fffafa]"
                }`}
              >
                <span>Unread</span>
                {totalUnread > 0 && (
                  <span className="size-3.5 rounded-full bg-[#e59bc9] text-[#19131b] font-black text-[9px] flex items-center justify-center">
                    {totalUnread}
                  </span>
                )}
              </button>
              {(["Buying", "Selling"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  aria-pressed={activeTab === tab}
                  className={`flex-1 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${activeTab === tab ? "bg-[#54385c] text-white shadow-xs" : "text-[#8f7d8c] hover:text-[#fffafa]"}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03]">
            {isLoadingList || isLoadingAccount ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                <Loader2 className="size-5 text-[#e59bc9] animate-spin" />
                <span className="text-xs text-[#b9adb6]">Loading chats...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center space-y-1.5">
                <p className="text-xs font-semibold text-[#b9adb6]">No conversations found</p>
                <p className="text-[11px] text-[#8f7d8c]">
                  {searchQuery
                    ? "Try a different search query."
                    : activeTab === "Selling"
                      ? "Inquiries about your listings will appear here."
                      : activeTab === "Unread"
                        ? "You're all caught up."
                        : "Message a seller from a product or shop page to start a conversation."}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = selectedChatId === conv.id;
                const hasUnread = (conv.unread_count || 0) > 0;
                const selling = conv.seller_id === userId;
                const participantName = selling
                  ? conv.buyer?.full_name || conv.buyer?.username || "Buyer"
                  : conv.shops?.name || conv.seller?.full_name || conv.seller?.username || "Seller";
                const lastMsg =
                  conv.messages?.[conv.messages.length - 1]?.body || "No messages yet";
                const timeStr = conv.last_message_at
                  ? formatMessageDateGroup(conv.last_message_at)
                  : "New";

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`w-full p-3 text-left transition-all cursor-pointer flex items-start gap-2.5 select-none relative ${
                      isSelected
                        ? "bg-[#2d192f]/70 border-l-2 border-[#e59bc9]"
                        : "hover:bg-white/[0.02] border-l-2 border-transparent"
                    }`}
                  >
                    {/* Conversation participant */}
                    <div className="relative shrink-0 mt-0.5">
                      <div className="size-8 rounded-full bg-[#3d2743] border border-white/10 flex items-center justify-center text-[#e59bc9] font-bold text-[11px]">
                        {!selling && conv.shops?.name ? (
                          <Store className="size-4" />
                        ) : (
                          participantName
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .substring(0, 2)
                            .toUpperCase()
                        )}
                      </div>
                      {hasUnread && (
                        <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[#e59bc9] ring-2 ring-[#1e1322]" />
                      )}
                    </div>

                    {/* Row Text Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4
                          className={`text-xs truncate ${
                            hasUnread || isSelected
                              ? "font-bold text-[#fffafa]"
                              : "font-medium text-[#d6cbd5]"
                          }`}
                        >
                          {participantName}
                        </h4>
                        <span className="text-[10px] text-[#8f7d8c] shrink-0">
                          {timeStr}
                        </span>
                      </div>

                      <span className="inline-flex mt-1 rounded bg-[#54385c]/50 px-1.5 py-0.5 text-[9px] font-bold text-[#e59bc9]">
                        {selling ? "Selling" : "Buying"}
                      </span>

                      {/* Product Name reference */}
                      {conv.products && (
                        <p className="text-[11px] text-[#e59bc9]/90 font-medium truncate mt-0.5">
                          {conv.products.title}
                        </p>
                      )}

                      {/* Message preview */}
                      <p
                        className={`text-xs truncate mt-0.5 ${
                          hasUnread
                            ? "text-[#fffafa] font-semibold"
                            : "text-[#8f7d8c]"
                        }`}
                      >
                        {lastMsg}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* COLUMN 2: CHAT AREA (FOCAL AREA · minmax(500px, 1fr))     */}
        {/* ========================================================= */}
        {activeConversation ? (
          <div
            className={`flex-1 flex flex-col min-w-0 bg-[#140a17]/50 ${
              !selectedChatId ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Clean Chat Header (~64px height) */}
            <div className="h-16 px-4 sm:px-5 border-b border-white/[0.06] flex items-center justify-between gap-3 shrink-0 bg-[#1a0f1d]/80">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile Back button */}
                <button
                  type="button"
                  onClick={() => setSelectedChatId(null)}
                  aria-label="Back to conversations"
                  className="md:hidden p-1 -ml-1 text-[#b9adb6] hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                >
                  <ArrowLeft className="size-4" />
                </button>

                {/* Conversation participant */}
                <div className="size-9 rounded-full bg-[#3d2743] border border-white/10 flex items-center justify-center text-[#e59bc9] font-bold text-xs shrink-0">
                  {!isSelling && activeConversation.shops?.name ? (
                    <Store className="size-4" />
                  ) : (
                    activeParticipantName
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .substring(0, 2)
                      .toUpperCase()
                  )}
                </div>

                {/* Participant and listing context */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-[#fffafa] truncate">
                      {activeParticipantName}
                    </h3>
                    {!isSelling && activeConversation.shops && (
                      <Link
                        href={`/shop/${activeConversation.shops.slug}`}
                        className="text-[11px] text-[#e59bc9] hover:underline flex items-center gap-1 font-medium"
                      >
                        <span>Visit Shop</span>
                      </Link>
                    )}
                  </div>
                  {activeConversation.products && (
                    <p className="text-[11px] text-[#8f7d8c] truncate">
                      {isSelling ? "Selling" : "Buying"}:{" "}
                      <span className="text-[#e59bc9] font-medium">
                        {activeConversation.products.title}
                      </span>
                    </p>
                  )}
                  {!activeConversation.products && (
                    <p className="text-[11px] text-[#8f7d8c]">
                      {isSelling ? "Selling" : "Buying"} &bull; {activeConversation.orders ? "Order conversation" : "Shop inquiry"}
                    </p>
                  )}
                </div>
              </div>

              {/* Header Right Actions: Order badge + Details trigger */}
              <div className="flex items-center gap-2 shrink-0">
                {activeConversation.orders && (
                  <Link
                    href={ordersHref}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-[#e59bc9] transition-colors"
                  >
                    <ShoppingBag className="size-3" />
                    <span>{formatOrderReference(activeConversation.orders.id)}</span>
                  </Link>
                )}

                {/* Toggle Product Context (Tablet / Mobile) */}
                <button
                  type="button"
                  onClick={() => setShowMobileContext(!showMobileContext)}
                  className="xl:hidden p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/10 text-[#d6cbd5] hover:text-white border border-white/[0.08] transition-colors cursor-pointer"
                  title="View Item Details"
                >
                  <Info className="size-4 text-[#e59bc9]" />
                </button>
              </div>
            </div>

            {/* Chat Message Stream */}
            <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3">
              {isLoadingMessages ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="size-6 text-[#e59bc9] animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <div className="size-10 rounded-full bg-[#342339] border border-white/10 flex items-center justify-center text-[#e59bc9]">
                    <MessageSquare className="size-5" />
                  </div>
                  <h4 className="text-xs font-bold text-white">Start the conversation</h4>
                  <p className="text-[11px] text-[#8f7d8c] max-w-xs">
                  Discuss availability, specs, meetup details, or an order.
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isOwnMessage = msg.sender_id === userId;
                  const dateGroup = formatMessageDateGroup(msg.created_at);
                  const showDateSeparator =
                    idx === 0 ||
                    formatMessageDateGroup(messages[idx - 1].created_at) !== dateGroup;

                  return (
                    <React.Fragment key={msg.id || idx}>
                      {showDateSeparator && (
                        <div className="flex items-center justify-center my-3">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-[#8f7d8c] bg-white/[0.03]">
                            {dateGroup}
                          </span>
                        </div>
                      )}

                      <div
                        className={`flex flex-col ${
                          isOwnMessage ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`max-w-[72%] p-3 sm:px-4 sm:py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                            isOwnMessage
                              ? "bg-[#54385c] text-white rounded-tr-xs shadow-xs"
                              : "bg-[#231526] text-[#fffafa] border border-white/[0.06] rounded-tl-xs shadow-xs"
                          }`}
                        >
                          {msg.body}
                        </div>
                        <span className="text-[10px] text-[#8f7d8c] mt-1 px-1 flex items-center gap-1">
                          <span>{formatMessageTime(msg.created_at)}</span>
                          {isOwnMessage && (
                            <CheckCheck
                              className={`size-3 ${
                                msg.read_at ? "text-emerald-400" : "text-[#e59bc9]"
                              }`}
                            />
                          )}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies Row */}
            <div className="px-4 py-2 bg-[#1a0f1d]/80 border-t border-white/[0.04] overflow-x-auto scrollbar-none no-scrollbar flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] uppercase font-bold text-[#8f7d8c] shrink-0 flex items-center gap-1 mr-1">
                <Sparkles className="size-3 text-[#e59bc9]" />
                <span>Quick:</span>
              </span>
              {quickReplies.map((reply) => (
                <button
                  key={reply.label}
                  type="button"
                  onClick={() => {
                    setInputText(reply.text);
                    textareaRef.current?.focus();
                  }}
                  className="px-2.5 py-1 rounded-md bg-white/[0.03] hover:bg-[#3d2743] hover:text-[#fffafa] text-[11px] font-medium text-[#b9adb6] border border-white/[0.05] transition-all shrink-0 cursor-pointer whitespace-nowrap active:scale-95"
                  title={reply.text}
                >
                  {reply.label}
                </button>
              ))}
            </div>

            {/* Message Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 sm:p-3.5 border-t border-white/[0.06] bg-[#1a0f1d]/90 flex items-end gap-2 shrink-0"
            >
              <button
                type="button"
                onClick={() => toast.info("Attachments will be supported in upcoming release.")}
                className="size-9 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] text-[#8f7d8c] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 border border-white/[0.06]"
                title="Add attachment"
              >
                <Paperclip className="size-4" />
              </button>

              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${activeParticipantName}...`}
                  aria-label={`Message ${activeParticipantName}`}
                  rows={1}
                  className="w-full min-h-[38px] max-h-[90px] py-2 px-3 rounded-lg bg-[#281829]/70 border border-white/[0.08] text-xs sm:text-sm font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9] transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className={`size-9 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                  inputText.trim() && !isSending
                    ? "bg-[#54385c] text-white hover:bg-[#684771] shadow-xs cursor-pointer active:scale-95"
                    : "bg-white/5 text-[#8f7d8c] cursor-not-allowed opacity-40"
                }`}
                title="Send message"
              >
                {isSending ? (
                  <Loader2 className="size-4 animate-spin text-white" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Empty state when no conversation is selected */
          <div className="flex-1 hidden md:flex flex-col items-center justify-center p-8 text-center space-y-2.5 bg-[#140a17]/40">
            <div className="size-12 rounded-xl bg-[#281829] border border-white/[0.08] flex items-center justify-center text-[#e59bc9]">
              <MessageSquare className="size-6" />
            </div>
            <h3 className="text-sm font-bold text-[#fffafa]">Messages</h3>
            <p className="text-xs text-[#8f7d8c] max-w-xs">
              Select a conversation to view your messages about a listing or order.
            </p>
          </div>
        )}

        {/* ========================================================= */}
        {/* COLUMN 3: PRODUCT & SELLER CONTEXT PANEL (~270px)        */}
        {/* ========================================================= */}
        {activeConversation && (
          <div className="w-[270px] shrink-0 border-l border-white/[0.06] hidden xl:flex flex-col bg-[#170c1a]/90 p-4 overflow-y-auto space-y-4">
            {/* ABOUT THIS ITEM */}
            {activeConversation.products && (
              <div className="space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8f7d8c] flex items-center gap-1.5">
                  <Tag className="size-3 text-[#e59bc9]" />
                  <span>Product Listing</span>
                </span>

                {/* Thumbnail & Info */}
                <div className="relative aspect-[16/10] rounded-lg bg-gradient-to-br from-[#3d2743] to-[#201323] border border-white/[0.06] flex items-center justify-center overflow-hidden p-2">
                  {activeProductImage ? (
                    <Image
                      src={activeProductImage}
                      alt={activeConversation.products.title}
                      width={120}
                      height={80}
                      className="size-full object-contain"
                    />
                  ) : (
                    <Package className="size-8 text-[#e59bc9]/60" />
                  )}
                  <div className="absolute top-2 right-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-black/50 backdrop-blur-xs text-white/90 border border-white/10">
                      {activeConversation.products.condition}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-[#fffafa] leading-snug">
                    {activeConversation.products.title}
                  </h4>
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-extrabold text-[#fffafa]">
                        ₱{Number(activeConversation.products.price).toLocaleString()}
                      </span>
                      {activeConversation.products.original_price && (
                        <span className="text-[10px] text-[#8f7d8c] line-through">
                          ₱{Number(activeConversation.products.original_price).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div>
                      {getListingStatusBadge(activeConversation.products.status)}
                    </div>
                  </div>
                </div>

                {/* Specs snippet */}
                {activeConversation.products.specs && (
                  <p className="text-[11px] text-[#8f7d8c] leading-relaxed line-clamp-2">
                    {activeConversation.products.specs}
                  </p>
                )}

                {/* View Product action */}
                <button
                  type="button"
                  onClick={() => handleOpenProductModal(activeConversation.products)}
                  className="w-full py-1.5 rounded-lg bg-white/[0.03] hover:bg-[#54385c] text-xs font-semibold text-[#fffafa] border border-white/[0.06] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="size-3 text-[#e59bc9]" />
                  <span>View Product</span>
                </button>
                {isSelling && (
                  <Link
                    href="/seller/products"
                    className="w-full py-1.5 rounded-lg bg-[#54385c] hover:bg-[#684771] text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Package className="size-3" />
                    Manage Listing
                  </Link>
                )}
              </div>
            )}

            {/* ASSOCIATED ORDER SECTION (if exists) */}
            {activeConversation.orders && (
              <div className="pt-3 border-t border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8f7d8c]">
                    Order Reference
                  </span>
                  {getOrderStatusBadge(activeConversation.orders.status)}
                </div>

                <div className="space-y-0.5 text-xs">
                  <div className="text-[#fffafa] font-bold">
                    {formatOrderReference(activeConversation.orders.id)}
                  </div>
                  <div className="text-[#8f7d8c] text-[11px]">
                    ₱{Number(activeConversation.orders.total).toLocaleString()} &bull;{" "}
                    {activeConversation.orders.delivery_method === "delivery"
                      ? "Delivery"
                      : "Meetup"}
                  </div>
                </div>

                <Link
                  href={ordersHref}
                  className="w-full py-1.5 rounded-lg bg-[#54385c] hover:bg-[#684771] text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5"
                >
                  <ShoppingBag className="size-3" />
                  <span>{isSelling ? "View Sales" : "View Purchases"}</span>
                </Link>
              </div>
            )}

            {/* SELLER / SHOP PROFILE SECTION */}
            <div className="pt-3 border-t border-white/[0.06] space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8f7d8c]">
                {isSelling ? "Buyer Information" : "Seller Information"}
              </span>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#8f7d8c]">{isSelling ? "Buyer:" : "Seller:"}</span>
                  <span className="text-white font-semibold">{activeParticipantName}</span>
                </div>
                {!isSelling && activeConversation.shops && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#8f7d8c]">Shop:</span>
                    <Link
                      href={`/shop/${activeConversation.shops.slug}`}
                      className="text-[#e59bc9] hover:underline truncate max-w-[130px] font-medium"
                    >
                      {activeConversation.shops.name}
                    </Link>
                  </div>
                )}
                {activeParticipant?.location && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#8f7d8c]">Location:</span>
                    <span className="text-[#d6cbd5] truncate max-w-[130px]">
                      {activeParticipant.location}
                    </span>
                  </div>
                )}
                {!isSelling && activeConversation.shops?.is_verified && (
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400 pt-0.5">
                    <CheckCircle2 className="size-3" />
                    <span>Verified Shop</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MOBILE / TABLET PRODUCT CONTEXT DRAWER OVERLAY            */}
        {/* ========================================================= */}
        {showMobileContext && activeConversation && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end xl:hidden animate-in fade-in duration-200">
            <div className="w-full max-w-xs bg-[#1a0f1d] h-full p-4 overflow-y-auto space-y-4 border-l border-white/10 shadow-2xl animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-bold uppercase tracking-wider text-[#d6cbd5] flex items-center gap-1.5">
                  <Tag className="size-3.5 text-[#e59bc9]" />
                  <span>Item Context</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowMobileContext(false)}
                  aria-label="Close conversation details"
                  className="p-1 rounded-lg text-[#b9adb6] hover:text-white cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Product Info */}
              {activeConversation.products && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-[#fffafa]">
                    {activeConversation.products.title}
                  </h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-[#fffafa]">
                      ₱{Number(activeConversation.products.price).toLocaleString()}
                    </span>
                    <div>
                      {getListingStatusBadge(activeConversation.products.status)}
                    </div>
                  </div>

                  <p className="text-xs text-[#8f7d8c] leading-relaxed">
                    {activeConversation.products.specs}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileContext(false);
                      handleOpenProductModal(activeConversation.products);
                    }}
                    className="w-full py-2 rounded-lg bg-[#54385c] text-white hover:bg-[#684771] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="size-3.5" />
                    <span>View Product</span>
                  </button>
                  {isSelling && (
                    <Link
                      href="/seller/products"
                      className="block w-full py-2 text-center rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
                    >
                      Manage Listing
                    </Link>
                  )}
                </div>
              )}

              {/* Order Info */}
              {activeConversation.orders && (
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#fffafa]">
                      {formatOrderReference(activeConversation.orders.id)}
                    </span>
                    {getOrderStatusBadge(activeConversation.orders.status)}
                  </div>
                  <p className="text-xs text-[#8f7d8c]">
                    ₱{Number(activeConversation.orders.total).toLocaleString()} &bull;{" "}
                    {activeConversation.orders.delivery_method === "delivery"
                      ? "Delivery"
                      : "Meetup"}
                  </p>
                  <Link
                    href={ordersHref}
                    className="block w-full py-1.5 text-center rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
                  >
                    {isSelling ? "Go to Sales" : "Go to Purchases"}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MessagesWorkspace() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[500px] flex items-center justify-center text-sm font-semibold text-[#b9adb6]">
          Loading messages...
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}
