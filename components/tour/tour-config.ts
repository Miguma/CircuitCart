import { TourConfig } from "./types";

export const TOUR_CONFIGS: Record<string, TourConfig> = {
  buyer: {
    id: "buyer",
    name: "Buyer Guided Tour",
    badge: "Buyer Walkthrough",
    steps: [
      {
        id: "buyer-welcome",
        target: '[data-tour="marketplace-brand"]',
        title: "Welcome to CircuitCart",
        content:
          "Cebu's premier marketplace for electronics, computer components, and tech hardware. Enjoy AI-verified listings, escrow protection, and direct seller negotiations.",
        preferredPlacement: "bottom",
        iconName: "Sparkles",
      },
      {
        id: "buyer-search",
        target: '[data-tour="marketplace-search"]',
        title: "Product Search & Smart Categories",
        content:
          "Find laptops, phones, GPUs, and peripherals in seconds. Search by keyword or explore categories with condition and price filters.",
        preferredPlacement: "bottom",
        iconName: "Search",
      },
      {
        id: "buyer-products",
        target: '[data-tour="marketplace-products"]',
        title: "AI-Verified Listings",
        content:
          "Browse live tech inventory. Every product undergoes multimodal AI verification to safeguard against non-tech items, counterfeit products, and fake images.",
        preferredPlacement: "top",
        iconName: "Package",
      },
      {
        id: "buyer-cart",
        target: '[data-tour="marketplace-cart"]',
        title: "Favorites & Shopping Cart",
        content:
          "Save items for later or add them to your cart. When a seller offers you a negotiated discount in chat, the cart automatically locks in your agreed savings.",
        preferredPlacement: "bottom",
        iconName: "ShoppingCart",
      },
      {
        id: "buyer-messages",
        target: '[data-tour="marketplace-messages"]',
        title: "Chat & Private Negotiations",
        content:
          "Connect directly with sellers. Negotiate prices, receive private discount offers, and agree on meetup or delivery details in real time.",
        preferredPlacement: "bottom",
        iconName: "MessageSquare",
      },
      {
        id: "buyer-orders",
        target: '[data-tour="marketplace-account"]',
        title: "Orders, Downpayments & Protection",
        content:
          "Track purchases with full visibility. Meetup orders feature a 50% escrow deposit to eliminate no-shows and ensure reliable handovers across Cebu.",
        preferredPlacement: "bottom",
        iconName: "ShieldCheck",
      },
    ],
  },

  seller: {
    id: "seller",
    name: "Seller Guided Tour",
    badge: "Seller Studio",
    steps: [
      {
        id: "seller-overview",
        target: '[data-tour="seller-overview"]',
        title: "Seller Command Center",
        content:
          "Track your shop's revenue, active listings, order statuses, and performance analytics from a centralized dashboard.",
        preferredPlacement: "bottom",
        iconName: "LayoutDashboard",
      },
      {
        id: "seller-shop",
        target: '[data-tour="seller-shop"]',
        title: "Shop Branding & Profile",
        content:
          "Personalize your public storefront with your store logo, banner, bio, and business contact information to build instant buyer trust.",
        preferredPlacement: "bottom",
        iconName: "Store",
      },
      {
        id: "seller-products",
        target: '[data-tour="seller-products"]',
        title: "Product Listings & AI Verification",
        content:
          "Add new inventory with ease. High-resolution images are evaluated by Gemini AI to ensure compliance with tech category guidelines.",
        preferredPlacement: "bottom",
        iconName: "Package",
      },
      {
        id: "seller-verification",
        target: '[data-tour="seller-verification"]',
        title: "Merchant Verification",
        content:
          "Submit your government ID for automated OCR extraction and admin review to earn the verified merchant badge on your storefront.",
        preferredPlacement: "bottom",
        iconName: "ShieldCheck",
      },
      {
        id: "seller-messages",
        target: '[data-tour="seller-messages"]',
        title: "Customer Chat & Private Offers",
        content:
          "Chat with prospective buyers and issue private discount offers. Accepted offers automatically bind directly to the buyer's checkout cart.",
        preferredPlacement: "bottom",
        iconName: "MessageSquare",
      },
      {
        id: "seller-orders",
        target: '[data-tour="seller-orders"]',
        title: "Orders, Meetups & Payouts",
        content:
          "Fulfill orders seamlessly. Meetup reservations collect a 50% deposit up front, and seller payouts can be requested directly to your bank account.",
        preferredPlacement: "bottom",
        iconName: "ShoppingBag",
      },
    ],
  },

  admin: {
    id: "admin",
    name: "Admin Guided Tour",
    badge: "Admin Console",
    steps: [
      {
        id: "admin-overview",
        target: '[data-tour="admin-overview"]',
        title: "Admin Command Center",
        content:
          "Monitor platform health, active user counts, total marketplace sales, and critical audit alerts at a glance.",
        preferredPlacement: "bottom",
        iconName: "LayoutDashboard",
      },
      {
        id: "admin-verifications",
        target: '[data-tour="admin-verifications"]',
        title: "Merchant Verification Requests",
        content:
          "Inspect submitted seller IDs, cross-examine OCR extraction scores, and approve or reject verified seller credentials.",
        preferredPlacement: "right",
        iconName: "ShieldCheck",
      },
      {
        id: "admin-products",
        target: '[data-tour="admin-products"]',
        title: "Marketplace Product Moderation",
        content:
          "Audit active listings across all categories, review flagged items, and override automated AI verification decisions when needed.",
        preferredPlacement: "right",
        iconName: "Package",
      },
      {
        id: "admin-orders",
        target: '[data-tour="admin-orders"]',
        title: "Platform Orders & Escrow Audit",
        content:
          "Review platform orders across Cash on Delivery, Maya Sandbox, Demo Card, and Meetup deposits with full audit logging.",
        preferredPlacement: "right",
        iconName: "ShoppingBag",
      },
      {
        id: "admin-reports",
        target: '[data-tour="admin-reports"]',
        title: "Dispute Reports & System Logs",
        content:
          "Investigate user dispute reports, monitor system error logs, and audit financial reconciliation records.",
        preferredPlacement: "right",
        iconName: "FileText",
      },
    ],
  },
};
