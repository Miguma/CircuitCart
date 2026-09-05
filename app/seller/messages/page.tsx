"use client";

import React, { useState } from "react";
import { MessageSquare, Send, User, CheckCheck, Clock } from "lucide-react";
import { SellerLayout } from "@/components/seller/seller-layout";
import { toast } from "sonner";

export default function SellerMessagesPage() {
  const [selectedChat, setSelectedChat] = useState<string>("chat-1");
  const [replyText, setReplyText] = useState("");

  const chats = [
    {
      id: "chat-1",
      buyer: "John D.",
      product: "Asus ROG Strix G16 Gaming Laptop",
      lastMessage: "Is this still available for meetup in IT Park today?",
      time: "10m ago",
      unread: true,
      messages: [
        {
          sender: "buyer",
          text: "Hi! Interested in the Asus ROG Strix G16. Is the original charger and box included?",
          time: "2:05 PM",
        },
        {
          sender: "seller",
          text: "Hello John! Yes, original 280W ROG power adapter and factory packaging are all included.",
          time: "2:08 PM",
        },
        {
          sender: "buyer",
          text: "Great. Is this still available for meetup in IT Park today?",
          time: "2:15 PM",
        },
      ],
    },
    {
      id: "chat-2",
      buyer: "Maria S.",
      product: "Samsung Galaxy S23 Ultra",
      lastMessage: "Thanks for packing it securely!",
      time: "2h ago",
      unread: false,
      messages: [
        {
          sender: "seller",
          text: "Your order has been packed with heavy-duty bubble wrap and fragile stickers.",
          time: "12:30 PM",
        },
        {
          sender: "buyer",
          text: "Thanks for packing it securely!",
          time: "12:45 PM",
        },
      ],
    },
  ];

  const currentChat = chats.find((c) => c.id === selectedChat) || chats[0];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    toast.success("Message sent to buyer.");
    setReplyText("");
  };

  return (
    <SellerLayout
      title="Messages"
      subtitle="Direct buyer inquiries, meetup coordinates, and order support."
      showAddProduct={true}
    >
      <div className="bg-[#1e1322]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-xl shadow-black/20 overflow-hidden grid grid-cols-1 md:grid-cols-3 min-h-[550px]">
        {/* Left: Chat List */}
        <div className="border-r border-white/[0.08] flex flex-col">
          <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#fffafa] flex items-center gap-2">
              <MessageSquare className="size-4 text-[#e59bc9]" />
              <span>Inquiries ({chats.length})</span>
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
            {chats.map((c) => {
              const isSelected = selectedChat === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedChat(c.id)}
                  className={`w-full p-4 text-left transition-colors cursor-pointer select-none flex items-start gap-3 ${
                    isSelected
                      ? "bg-[#342339]/70 border-l-2 border-[#e59bc9]"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="size-9 rounded-full bg-[#3d2743] border border-white/10 flex items-center justify-center text-[#e59bc9] font-bold text-xs shrink-0">
                    {c.buyer.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[#fffafa] truncate">
                        {c.buyer}
                      </h4>
                      <span className="text-[10px] text-[#b9adb6]">{c.time}</span>
                    </div>
                    <p className="text-[11px] text-[#e59bc9] font-medium truncate mt-0.5">
                      {c.product}
                    </p>
                    <p className="text-xs text-[#b9adb6] truncate mt-1">
                      {c.lastMessage}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Message Window */}
        <div className="md:col-span-2 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#fffafa]">
                {currentChat.buyer}
              </h3>
              <p className="text-xs text-[#e59bc9]">
                Regarding: {currentChat.product}
              </p>
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
            {currentChat.messages.map((m, idx) => {
              const isMe = m.sender === "seller";
              return (
                <div
                  key={idx}
                  className={`flex flex-col ${
                    isMe ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-md p-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      isMe
                        ? "bg-[#65486f] text-white rounded-br-xs"
                        : "bg-[#342339]/80 text-[#fffafa] border border-white/[0.08] rounded-bl-xs"
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="text-[10px] text-[#8f7d8c] mt-1 px-1">
                    {m.time}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Reply Box */}
          <form
            onSubmit={handleSend}
            className="p-3 border-t border-white/[0.08] flex items-center gap-2 bg-[#1e1322]/90"
          >
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to ${currentChat.buyer}...`}
              className="flex-1 h-10 px-3.5 rounded-xl bg-[#342339]/50 border border-white/10 text-xs sm:text-sm font-medium text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9] focus:ring-1 focus:ring-[#e59bc9]"
            />
            <button
              type="submit"
              className="size-10 rounded-xl bg-[#65486f] text-white hover:bg-[#7a5985] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </SellerLayout>
  );
}
