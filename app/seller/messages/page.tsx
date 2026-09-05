"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
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
  ExternalLink,
} from "lucide-react";
import { SellerLayout } from "@/components/seller/seller-layout";
import {
  DEMO_CONVERSATIONS,
  type Conversation,
  type ChatMessage,
  type OrderStatus,
  type ListingStatus,
} from "@/lib/seller/seller-data";
import { DUMMY_PRODUCTS, type Product } from "@/components/marketplace/marketplace-data";
import { QuickViewDialog } from "@/components/marketplace/quick-view-dialog";
import { toast } from "sonner";

export default function SellerMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>(DEMO_CONVERSATIONS);
  const [selectedChatId, setSelectedChatId] = useState<string | null>("conv-1");
  const [activeTab, setActiveTab] = useState<"All" | "Unread">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [inputText, setInputText] = useState("");
  const [showMobileContext, setShowMobileContext] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Active selected conversation
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedChatId) || null;
  }, [conversations, selectedChatId]);

  // Scroll to bottom of message list on conversation change or new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages]);

  // When a conversation is opened, mark as read
  const handleSelectConversation = (convId: string) => {
    setSelectedChatId(convId);
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
    );
  };

  // Compact quick reply chips
  const quickReplies = [
    { label: "Still available", text: "Yes, this item is still available and in great condition!" },
    { label: "Yes, negotiable", text: "Yes, the price is slightly negotiable for fast pickup/purchase." },
    { label: "Meetup available", text: "I'm available for meetup and testing at Cebu IT Park." },
    { label: "Delivery available", text: "We can arrange fast delivery via Grab Express or Lalamove." },
    { label: "Can ship today", text: "I can pack and ship this item today with secure padding." },
  ];

  // Send a message
  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !selectedChatId || !activeConversation) return;

    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      conversationId: selectedChatId,
      senderRole: "seller",
      senderName: "TechVault Cebu",
      content: text,
      createdAt: now,
      dateGroup: "Today",
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== selectedChatId) return c;
        return {
          ...c,
          lastMessage: text,
          lastMessageAt: "Just now",
          unreadCount: 0,
          messages: [...c.messages, newMessage],
        };
      })
    );

    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.focus();
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
      const matchesSearch =
        !q ||
        c.buyer.name.toLowerCase().includes(q) ||
        c.product.name.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q);

      const matchesTab = activeTab === "All" || c.unreadCount > 0;

      return matchesSearch && matchesTab;
    });
  }, [conversations, searchQuery, activeTab]);

  const totalUnread = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unreadCount > 0 ? 1 : 0), 0);
  }, [conversations]);

  // Product helper for QuickView
  const handleOpenProductModal = (productId: string) => {
    const found = DUMMY_PRODUCTS.find((p) => p.id === productId);
    if (found) {
      setQuickViewProduct(found);
    } else if (activeConversation) {
      setQuickViewProduct({
        id: activeConversation.product.id,
        name: activeConversation.product.name,
        category: activeConversation.product.category,
        price: activeConversation.product.price,
        originalPrice: activeConversation.product.originalPrice,
        condition: activeConversation.product.condition,
        rating: 4.9,
        reviewCount: 38,
        sellerName: "TechVault Cebu",
        isVerifiedSeller: true,
        location: "Cebu City, Central Visayas",
        section: "Recommended for you",
        specs: activeConversation.product.specs,
        gradientFrom: "#432c45",
        gradientTo: "#281729",
        image: activeConversation.product.image,
      });
    }
  };

  const getListingStatusBadge = (status: ListingStatus) => {
    switch (status) {
      case "Active":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30">
            <span className="size-1 rounded-full bg-emerald-400" />
            Active
          </span>
        );
      case "Reserved":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-950/70 text-purple-300 border border-purple-500/30">
            Reserved
          </span>
        );
      case "Sold Out":
      case "Sold" as any:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/70 text-amber-300 border border-amber-500/30">
            Sold
          </span>
        );
      case "Archived":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-[#b9adb6]">
            Archived
          </span>
        );
      default:
        return null;
    }
  };

  const getOrderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "Pending":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/70 text-amber-300 border border-amber-500/30">
            Pending
          </span>
        );
      case "Packed":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#45284f] text-[#e59bc9] border border-[#e59bc9]/30">
            Packed
          </span>
        );
      case "Shipped":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-950/70 text-sky-300 border border-sky-500/30">
            Shipped
          </span>
        );
      case "Ready for Meetup":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-950/70 text-purple-300 border border-purple-500/30">
            Ready for Meetup
          </span>
        );
      case "Completed":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30">
            Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-white">
            {status}
          </span>
        );
    }
  };

  return (
    <SellerLayout
      title="Messages"
      subtitle="Direct buyer inquiries, meetup coordinates, and order support."
      showAddProduct={true}
    >
      {/* PRIMARY WORKSPACE: Single unified surface, subtle dividers, 3 balanced columns */}
      <div className="h-[calc(100vh-12.5rem)] min-h-[580px] max-h-[800px] bg-[#1a0f1d]/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl flex relative">
        {/* ========================================================= */}
        {/* COLUMN 1: CONVERSATION LIST (~280px)                      */}
        {/* ========================================================= */}
        <div
          className={`w-full md:w-[280px] shrink-0 border-r border-white/[0.06] flex flex-col bg-[#170c1a]/95 ${
            selectedChatId ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Top Header & Compact Controls */}
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

            {/* Compact Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-[#8f7d8c] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full h-8 pl-7.5 pr-7 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8f7d8c] hover:text-white"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Segmented Filter Control: All / Unread */}
            <div className="flex items-center p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
              <button
                type="button"
                onClick={() => setActiveTab("All")}
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
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03]">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center space-y-1.5">
                <p className="text-xs font-semibold text-[#b9adb6]">No conversations</p>
                <p className="text-[11px] text-[#8f7d8c]">
                  {searchQuery ? "Try a different search." : "Buyer messages will appear here."}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = selectedChatId === conv.id;
                const hasUnread = conv.unreadCount > 0;

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
                    {/* Buyer Avatar */}
                    <div className="relative shrink-0 mt-0.5">
                      <div className="size-8 rounded-full bg-[#3d2743] border border-white/10 flex items-center justify-center text-[#e59bc9] font-bold text-[11px]">
                        {conv.buyer.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .substring(0, 2)}
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
                          {conv.buyer.name}
                        </h4>
                        <span className="text-[10px] text-[#8f7d8c] shrink-0">
                          {conv.lastMessageAt}
                        </span>
                      </div>

                      {/* Product Name reference */}
                      <p className="text-[11px] text-[#e59bc9]/90 font-medium truncate mt-0.5">
                        {conv.product.name}
                      </p>

                      {/* Message preview */}
                      <p
                        className={`text-xs truncate mt-0.5 ${
                          hasUnread
                            ? "text-[#fffafa] font-semibold"
                            : "text-[#8f7d8c]"
                        }`}
                      >
                        {conv.lastMessage}
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
                  className="md:hidden p-1 -ml-1 text-[#b9adb6] hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                >
                  <ArrowLeft className="size-4" />
                </button>

                {/* Buyer Avatar */}
                <div className="size-9 rounded-full bg-[#3d2743] border border-white/10 flex items-center justify-center text-[#e59bc9] font-bold text-xs shrink-0">
                  {activeConversation.buyer.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)}
                </div>

                {/* Buyer & Context Subline */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-[#fffafa] truncate">
                      {activeConversation.buyer.name}
                    </h3>
                    <span className="text-[11px] text-[#8f7d8c]">
                      &bull; {activeConversation.buyer.activeStatus}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8f7d8c] truncate">
                    Regarding:{" "}
                    <span className="text-[#e59bc9] font-medium">
                      {activeConversation.product.name}
                    </span>
                  </p>
                </div>
              </div>

              {/* Header Right Actions: Order badge + Details trigger */}
              <div className="flex items-center gap-2 shrink-0">
                {activeConversation.associatedOrder && (
                  <Link
                    href="/seller/orders"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-[#e59bc9] transition-colors"
                  >
                    <ShoppingBag className="size-3" />
                    <span>#{activeConversation.associatedOrder.orderNumber}</span>
                  </Link>
                )}

                {/* Toggle Product Context (Tablet / Mobile) */}
                <button
                  type="button"
                  onClick={() => setShowMobileContext(!showMobileContext)}
                  className="xl:hidden p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/10 text-[#d6cbd5] hover:text-white border border-white/[0.08] transition-colors cursor-pointer"
                  title="View Listing Details"
                >
                  <Info className="size-4 text-[#e59bc9]" />
                </button>
              </div>
            </div>

            {/* Chat Message Stream */}
            <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3">
              {activeConversation.messages.map((msg, idx) => {
                const isSeller = msg.senderRole === "seller";
                const showDateSeparator =
                  idx === 0 ||
                  activeConversation.messages[idx - 1].dateGroup !== msg.dateGroup;

                return (
                  <React.Fragment key={msg.id || idx}>
                    {showDateSeparator && (
                      <div className="flex items-center justify-center my-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-[#8f7d8c] bg-white/[0.03]">
                          {msg.dateGroup}
                        </span>
                      </div>
                    )}

                    <div
                      className={`flex flex-col ${
                        isSeller ? "items-end" : "items-start"
                      }`}
                    >
                      {/* Max width constrained to ~65-72% */}
                      <div
                        className={`max-w-[72%] p-3 sm:px-4 sm:py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                          isSeller
                            ? "bg-[#54385c] text-white rounded-tr-xs shadow-xs"
                            : "bg-[#231526] text-[#fffafa] border border-white/[0.06] rounded-tl-xs shadow-xs"
                        }`}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-[#8f7d8c] mt-1 px-1 flex items-center gap-1">
                        <span>{msg.createdAt}</span>
                        {isSeller && <CheckCheck className="size-3 text-[#e59bc9]" />}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies Row: Compact, non-cramped chips */}
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

            {/* Clean Sticky Message Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 sm:p-3.5 border-t border-white/[0.06] bg-[#1a0f1d]/90 flex items-end gap-2 shrink-0"
            >
              <button
                type="button"
                onClick={() => toast.info("Attachments will be supported soon.")}
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
                  placeholder={`Type a message to ${activeConversation.buyer.name}...`}
                  rows={1}
                  className="w-full min-h-[38px] max-h-[90px] py-2 px-3 rounded-lg bg-[#281829]/70 border border-white/[0.08] text-xs sm:text-sm font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9] transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={!inputText.trim()}
                className={`size-9 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                  inputText.trim()
                    ? "bg-[#54385c] text-white hover:bg-[#684771] shadow-xs cursor-pointer active:scale-95"
                    : "bg-white/5 text-[#8f7d8c] cursor-not-allowed opacity-40"
                }`}
                title="Send message"
              >
                <Send className="size-4" />
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
              Select a conversation to start chatting with a buyer.
            </p>
          </div>
        )}

        {/* ========================================================= */}
        {/* COLUMN 3: PRODUCT CONTEXT PANEL (~270px · Quieter)       */}
        {/* ========================================================= */}
        {activeConversation && (
          <div className="w-[270px] shrink-0 border-l border-white/[0.06] hidden xl:flex flex-col bg-[#170c1a]/90 p-4 overflow-y-auto space-y-4">
            {/* ABOUT THIS LISTING */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8f7d8c] flex items-center gap-1.5">
                <Tag className="size-3 text-[#e59bc9]" />
                <span>About This Listing</span>
              </span>

              {/* Compact Product Thumbnail & Info */}
              <div className="relative aspect-[16/10] rounded-lg bg-gradient-to-br from-[#3d2743] to-[#201323] border border-white/[0.06] flex items-center justify-center overflow-hidden">
                <Package className="size-8 text-[#e59bc9]/60" />
                <div className="absolute top-2 right-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-black/50 backdrop-blur-xs text-white/90 border border-white/10">
                    {activeConversation.product.condition}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-xs font-bold text-[#fffafa] leading-snug">
                  {activeConversation.product.name}
                </h4>
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-extrabold text-[#fffafa]">
                      ₱{activeConversation.product.price.toLocaleString()}
                    </span>
                    {activeConversation.product.originalPrice && (
                      <span className="text-[10px] text-[#8f7d8c] line-through">
                        ₱{activeConversation.product.originalPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div>
                    {getListingStatusBadge(activeConversation.product.status)}
                  </div>
                </div>
              </div>

              {/* Specs snippet */}
              <p className="text-[11px] text-[#8f7d8c] leading-relaxed line-clamp-2">
                {activeConversation.product.specs}
              </p>

              {/* View Product action */}
              <button
                type="button"
                onClick={() => handleOpenProductModal(activeConversation.product.id)}
                className="w-full py-1.5 rounded-lg bg-white/[0.03] hover:bg-[#54385c] text-xs font-semibold text-[#fffafa] border border-white/[0.06] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Eye className="size-3 text-[#e59bc9]" />
                <span>View Product</span>
              </button>
            </div>

            {/* ASSOCIATED ORDER SECTION (if exists) */}
            {activeConversation.associatedOrder && (
              <div className="pt-3 border-t border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8f7d8c]">
                    Order Overview
                  </span>
                  {getOrderStatusBadge(activeConversation.associatedOrder.status)}
                </div>

                <div className="space-y-0.5 text-xs">
                  <div className="text-[#fffafa] font-bold">
                    #{activeConversation.associatedOrder.orderNumber}
                  </div>
                  <div className="text-[#8f7d8c] text-[11px]">
                    ₱{activeConversation.associatedOrder.total.toLocaleString()} &bull;{" "}
                    {activeConversation.associatedOrder.fulfillmentMethod}
                  </div>
                </div>

                <Link
                  href="/seller/orders"
                  className="w-full py-1.5 rounded-lg bg-[#54385c] hover:bg-[#684771] text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5"
                >
                  <ShoppingBag className="size-3" />
                  <span>View Order Details</span>
                </Link>
              </div>
            )}

            {/* BUYER PROFILE SECTION */}
            <div className="pt-3 border-t border-white/[0.06] space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8f7d8c]">
                Buyer Details
              </span>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#8f7d8c]">Rating:</span>
                  <span className="text-amber-300 font-semibold">
                    ★ {activeConversation.buyer.rating} ({activeConversation.buyer.reviewCount})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8f7d8c]">Location:</span>
                  <span className="text-[#d6cbd5] truncate max-w-[130px]">
                    {activeConversation.buyer.location}
                  </span>
                </div>
                {activeConversation.buyer.phoneVerified && (
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400 pt-0.5">
                    <CheckCircle2 className="size-3" />
                    <span>Verified Buyer</span>
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
                  <span>Listing Context</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowMobileContext(false)}
                  className="p-1 rounded-lg text-[#b9adb6] hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Product Info */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-[#fffafa]">
                  {activeConversation.product.name}
                </h4>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-[#fffafa]">
                    ₱{activeConversation.product.price.toLocaleString()}
                  </span>
                  <div>
                    {getListingStatusBadge(activeConversation.product.status)}
                  </div>
                </div>

                <p className="text-xs text-[#8f7d8c] leading-relaxed">
                  {activeConversation.product.specs}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setShowMobileContext(false);
                    handleOpenProductModal(activeConversation.product.id);
                  }}
                  className="w-full py-2 rounded-lg bg-[#54385c] text-white hover:bg-[#684771] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Eye className="size-3.5" />
                  <span>View Product</span>
                </button>
              </div>

              {/* Order Info */}
              {activeConversation.associatedOrder && (
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#fffafa]">
                      Order #{activeConversation.associatedOrder.orderNumber}
                    </span>
                    {getOrderStatusBadge(activeConversation.associatedOrder.status)}
                  </div>
                  <p className="text-xs text-[#8f7d8c]">
                    ₱{activeConversation.associatedOrder.total.toLocaleString()} &bull;{" "}
                    {activeConversation.associatedOrder.fulfillmentMethod}
                  </p>
                  <Link
                    href="/seller/orders"
                    className="block w-full py-1.5 text-center rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
                  >
                    Go to Order Details
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick View Dialog for Product preview */}
      <QuickViewDialog
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        isWishlisted={false}
        onToggleWishlist={() => {}}
        onAddToCart={() => toast.success("Added to cart")}
      />
    </SellerLayout>
  );
}
