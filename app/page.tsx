"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Smartphone,
  Watch,
  Camera,
  Headphones,
  Monitor,
  Gamepad2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

export default function CircuitCartShowcasePage() {
  const [activeTab, setActiveTab] = useState<"new" | "bestseller" | "featured">("new");

  const categories = [
    { name: "Phones", icon: Smartphone },
    { name: "Smart Watches", icon: Watch },
    { name: "Cameras", icon: Camera },
    { name: "Headphones", icon: Headphones },
    { name: "Computers", icon: Monitor },
    { name: "Gaming", icon: Gamepad2 },
  ];

  const showcaseProducts = [
    {
      id: "sc-1",
      name: "Apple iPhone 15 Pro Max 128GB",
      category: "Phones",
      price: "₱68,900",
      gradientFrom: "#432c45",
      gradientTo: "#281729",
      tab: "new",
    },
    {
      id: "sc-2",
      name: "Blackmagic Pocket Cinema Camera 6K",
      category: "Cameras",
      price: "₱74,500",
      gradientFrom: "#544061",
      gradientTo: "#34243b",
      tab: "new",
    },
    {
      id: "sc-3",
      name: "Apple Watch Series 9 GPS 41mm",
      category: "Smart Watches",
      price: "₱19,500",
      gradientFrom: "#684d72",
      gradientTo: "#4a3054",
      tab: "new",
    },
    {
      id: "sc-4",
      name: "AirPods Max Silver Starlight",
      category: "Headphones",
      price: "₱32,500",
      gradientFrom: "#a37282",
      gradientTo: "#7d4e5d",
      tab: "new",
    },
    {
      id: "sc-5",
      name: "Samsung Galaxy Watch6 Classic",
      category: "Smart Watches",
      price: "₱14,990",
      gradientFrom: "#694975",
      gradientTo: "#432c45",
      tab: "bestseller",
    },
    {
      id: "sc-6",
      name: "Galaxy Z Fold5 Unlocked 256GB",
      category: "Phones",
      price: "₱64,900",
      gradientFrom: "#3a233e",
      gradientTo: "#201524",
      tab: "bestseller",
    },
    {
      id: "sc-7",
      name: "Galaxy Buds FE Graphite",
      category: "Headphones",
      price: "₱4,250",
      gradientFrom: "#684e70",
      gradientTo: "#442f4b",
      tab: "featured",
    },
    {
      id: "sc-8",
      name: "Apple iPad 9 10.2\" 64GB Wi-Fi",
      category: "Computers",
      price: "₱16,500",
      gradientFrom: "#7d6484",
      gradientTo: "#544061",
      tab: "featured",
    },
  ];

  const filteredProducts = showcaseProducts.filter((p) => p.tab === activeTab);

  return (
    <div className="min-h-screen w-full bg-[#140e16] text-[#faf7f7] font-sans overflow-x-hidden selection:bg-[#6a4f6d] selection:text-white">
      {/* ========================================================= */}
      {/* 1. FLOATING NAVIGATION BAR */}
      {/* ========================================================= */}
      <header className="sticky top-0 z-50 w-full bg-[#18101b]/90 backdrop-blur-md border-b border-[#34243b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo / Brand Mark -> / */}
          <Link href="/" className="inline-flex items-center gap-2.5 select-none focus-visible:outline-2 focus-visible:outline-[#a37282] rounded-xs">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-pink-300 size-5 shrink-0"
              aria-hidden="true"
            >
              <path
                d="M2 3.5H4.5L6.5 13.5H16.5L18.5 6.5H6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 9.5H13.5V13.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="13.5" cy="9.5" r="1.2" fill="currentColor" />
              <circle cx="9" cy="9.5" r="1.2" fill="currentColor" />
              <circle cx="8" cy="16.5" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <circle cx="15" cy="16.5" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
            <span className="text-xl font-bold tracking-tight text-white">
              Circuit<span className="text-pink-300">Cart</span>
            </span>
          </Link>

          {/* Center Navigation Links (Scroll targets) */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold tracking-wide text-zinc-300">
            <a href="#categories" className="hover:text-pink-300 transition-colors">
              Categories
            </a>
            <a href="#featured" className="hover:text-pink-300 transition-colors">
              Featured
            </a>
            <a href="#about" className="hover:text-pink-300 transition-colors">
              About
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-xs font-semibold text-zinc-200 hover:text-white transition-colors border border-[#48334c] hover:border-[#6a4f6d] rounded-xl"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#544061] hover:bg-[#684d72] rounded-xl shadow-xs transition-all"
            >
              Create account
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-16">
        {/* ========================================================= */}
        {/* 2. HERO SECTION */}
        {/* ========================================================= */}
        <section
          id="hero"
          className="w-full bg-gradient-to-br from-[#241727] via-[#1a111c] to-[#120a14] border border-[#3b2740] rounded-3xl p-8 sm:p-12 md:p-16 overflow-hidden relative shadow-2xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Left Copy Column */}
            <div className="md:col-span-7 space-y-4">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-pink-300/80">
                Pro.Beyond.
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                iPhone 15 Pro <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-purple-300 to-rose-200">
                  CircuitCart
                </span>
              </h1>
              <p className="text-sm sm:text-base text-zinc-400 max-w-lg leading-relaxed">
                Created to change everything for the better. For everyone. Discover verified technology from trusted sellers.
              </p>
              <div className="pt-4">
                <Link
                  href="/marketplace"
                  className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-[#544061] hover:bg-[#684d72] border border-[#7d6484]/40 rounded-xl shadow-lg transition-all"
                >
                  <span>Shop Now</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            {/* Right Visual Graphic Column */}
            <div className="md:col-span-5 flex items-center justify-center">
              <div className="relative w-64 h-80 sm:w-72 sm:h-96 bg-gradient-to-b from-[#38263e] to-[#201524] border-4 border-[#544061]/50 rounded-[42px] p-3 shadow-2xl flex flex-col items-center justify-between">
                {/* Dynamic Island / Notch */}
                <div className="w-24 h-4 bg-[#120a14] rounded-full mt-1 z-10" />

                {/* Display Graphic */}
                <div className="w-full flex-1 rounded-[32px] bg-gradient-to-tr from-[#694975] via-[#3a233e] to-[#876690] flex flex-col items-center justify-center p-4 text-center my-2">
                  <Sparkles className="size-8 text-pink-200 mb-2 animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-pink-100/70">
                    CircuitCart
                  </span>
                  <span className="text-2xl font-extrabold text-white mt-1">
                    9:41
                  </span>
                  <span className="text-[11px] text-pink-200/80 mt-1">
                    Verified Electronics
                  </span>
                </div>

                {/* Home Indicator */}
                <div className="w-28 h-1 bg-white/40 rounded-full mb-1" />
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 3. FEATURED BENTO DISCOVERY GRID */}
        {/* ========================================================= */}
        <section aria-label="Featured Showcase Grid" className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Card 1: Playstation 5 */}
          <div className="md:col-span-6 bg-[#1f1523] border border-[#38263e] rounded-3xl p-8 flex flex-col justify-between hover:border-[#6a4f6d] transition-all group">
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-pink-300/80">
                Gaming Console
              </span>
              <h3 className="text-2xl font-bold text-white group-hover:text-pink-200 transition-colors">
                PlayStation 5
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
                Incredibly powerful CPUs, GPUs, and an SSD with integrated I/O will redefine your PlayStation experience.
              </p>
            </div>
            <div className="pt-6">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-300 hover:text-white transition-colors"
              >
                <span>Explore Gaming</span>
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </div>

          {/* Card 2: Macbook Air */}
          <div className="md:col-span-6 bg-[#25192a] border border-[#38263e] rounded-3xl p-8 flex flex-col justify-between hover:border-[#6a4f6d] transition-all group">
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-pink-300/80">
                Laptops
              </span>
              <h3 className="text-2xl font-bold text-white group-hover:text-pink-200 transition-colors">
                MacBook Air M2
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
                The 15-inch MacBook Air makes room for more of what you love with a spacious Liquid Retina display.
              </p>
            </div>
            <div className="pt-6">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-300 hover:text-white transition-colors"
              >
                <span>Shop Laptops</span>
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </div>

          {/* Card 3: AirPods Max */}
          <div className="md:col-span-6 bg-[#1a121c] border border-[#38263e] rounded-3xl p-8 flex flex-col justify-between hover:border-[#6a4f6d] transition-all group">
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-pink-300/80">
                Audio
              </span>
              <h3 className="text-2xl font-bold text-white group-hover:text-pink-200 transition-colors">
                AirPods Max
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
                Computational audio. High-fidelity acoustic design with Active Noise Cancellation.
              </p>
            </div>
            <div className="pt-6">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-300 hover:text-white transition-colors"
              >
                <span>Discover Audio</span>
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </div>

          {/* Card 4: Apple Vision Pro */}
          <div className="md:col-span-6 bg-[#281b2d] border border-[#38263e] rounded-3xl p-8 flex flex-col justify-between hover:border-[#6a4f6d] transition-all group">
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-pink-300/80">
                Spatial Computing
              </span>
              <h3 className="text-2xl font-bold text-white group-hover:text-pink-200 transition-colors">
                Apple Vision Pro
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
                An immersive way to experience entertainment and personal workspace computing.
              </p>
            </div>
            <div className="pt-6">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-300 hover:text-white transition-colors"
              >
                <span>View Innovations</span>
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 4. BROWSE BY CATEGORY SECTION */}
        {/* ========================================================= */}
        <section id="categories" className="space-y-6 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Browse By Category
            </h2>
            <Link
              href="/marketplace"
              className="text-xs font-semibold text-pink-300 hover:text-white transition-colors"
            >
              See all in Marketplace →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {categories.map((cat) => {
              const IconElem = cat.icon;
              return (
                <Link
                  key={cat.name}
                  href="/marketplace"
                  className="bg-[#1f1523] border border-[#38263e] hover:border-[#6a4f6d] hover:bg-[#281b2d] rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all text-center group"
                >
                  <IconElem className="size-6 text-pink-300 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-semibold text-zinc-300 group-hover:text-white">
                    {cat.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ========================================================= */}
        {/* 5. SPOTLIGHT PRODUCTS SECTION */}
        {/* ========================================================= */}
        <section id="featured" className="space-y-6 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              CircuitCart Showcase
            </h2>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 bg-[#18101b] border border-[#34243b] p-1 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab("new")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "new"
                    ? "bg-[#544061] text-white shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                New Arrival
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("bestseller")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "bestseller"
                    ? "bg-[#544061] text-white shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Bestseller
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("featured")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "featured"
                    ? "bg-[#544061] text-white shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Featured
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            {filteredProducts.map((prod) => (
              <div
                key={prod.id}
                className="bg-[#1e1522] border border-[#38263e] rounded-2xl p-4 flex flex-col justify-between hover:border-[#6a4f6d] transition-all group"
              >
                <div>
                  <div
                    className="w-full h-40 rounded-xl mb-3.5 flex items-center justify-center p-3 text-center"
                    style={{
                      background: `linear-gradient(135deg, ${prod.gradientFrom}, ${prod.gradientTo})`,
                    }}
                  >
                    <span className="text-xs font-bold text-white line-clamp-2">
                      {prod.name}
                    </span>
                  </div>

                  <span className="text-[11px] font-semibold text-pink-300 uppercase tracking-wider block mb-1">
                    {prod.category}
                  </span>
                  <h3 className="text-sm font-bold text-white line-clamp-1 mb-2">
                    {prod.name}
                  </h3>
                </div>

                <div className="pt-3 border-t border-[#34243b] space-y-3">
                  <div className="text-lg font-extrabold text-white">
                    {prod.price}
                  </div>
                  <Link
                    href="/marketplace"
                    className="w-full h-9 inline-flex items-center justify-center text-xs font-semibold bg-[#544061] text-white hover:bg-[#684d72] rounded-xl transition-all"
                  >
                    Buy Now
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================= */}
        {/* 6. SPECIAL DISCOUNTS BANNER */}
        {/* ========================================================= */}
        <section
          id="discounts"
          className="w-full bg-gradient-to-r from-[#2c1d30] via-[#201524] to-[#2c1d30] border border-[#3d2944] rounded-3xl p-8 sm:p-10 space-y-6"
        >
          <div className="text-center space-y-2">
            <span className="inline-block px-3 py-1 bg-[#544061] text-pink-200 text-xs font-bold rounded-full uppercase tracking-wider">
              Special Promotion
            </span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Discounts up to -50% with CircuitCart
            </h2>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Verified tech deals on pre-owned and open-box laptops, smartphones, and accessories.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {showcaseProducts.slice(0, 4).map((p) => (
              <div
                key={`disc-${p.id}`}
                className="bg-[#18101b] border border-[#38263e] rounded-2xl p-4 text-center space-y-3"
              >
                <div className="text-xs font-bold text-white line-clamp-1">
                  {p.name}
                </div>
                <div className="text-base font-extrabold text-pink-300">
                  {p.price}
                </div>
                <Link
                  href="/marketplace"
                  className="w-full h-8 inline-flex items-center justify-center text-xs font-semibold bg-[#544061] text-white hover:bg-[#684d72] rounded-xl transition-all"
                >
                  Buy Now
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================= */}
        {/* 7. ABOUT CIRCUITCART SECTION */}
        {/* ========================================================= */}
        <section
          id="about"
          className="w-full bg-[#1b121e] border border-[#38263e] rounded-3xl p-8 sm:p-12 space-y-8"
        >
          <div className="max-w-2xl space-y-3">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              About CircuitCart
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              CircuitCart is the trusted technology marketplace tailored for Cebu and the Visayas. We connect buyers and sellers through verified listings, transparent condition ratings, and safe local trading.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#140e16] border border-[#34243b] rounded-2xl p-6 space-y-3">
              <ShieldCheck className="size-7 text-emerald-400" />
              <h3 className="text-base font-bold text-white">
                Verified Tech Sellers
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Every listing is backed by seller verification to ensure authentic hardware and safe transactions.
              </p>
            </div>

            <div className="bg-[#140e16] border border-[#34243b] rounded-2xl p-6 space-y-3">
              <Sparkles className="size-7 text-pink-300" />
              <h3 className="text-base font-bold text-white">
                Transparent Conditions
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Detailed specs, condition grades (New, Like New, Good, Fair), and honest pricing in Philippine Pesos.
              </p>
            </div>

            <div className="bg-[#140e16] border border-[#34243b] rounded-2xl p-6 space-y-3">
              <RefreshCw className="size-7 text-purple-300" />
              <h3 className="text-base font-bold text-white">
                Better Electronics Lifecycle
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Giving quality pre-owned laptops, smartphones, and gaming gear a second life in our tech ecosystem.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================= */}
      {/* 8. FOOTER */}
      {/* ========================================================= */}
      <footer className="w-full bg-[#100a12] border-t border-[#2a1a2e] pt-12 pb-8 mt-16 text-zinc-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-[#2a1a2e]">
            <div className="md:col-span-5 space-y-3">
              <Link href="/" className="inline-flex items-center gap-2 select-none">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-pink-300 size-5 shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d="M2 3.5H4.5L6.5 13.5H16.5L18.5 6.5H6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 9.5H13.5V13.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="13.5" cy="9.5" r="1.2" fill="currentColor" />
                  <circle cx="9" cy="9.5" r="1.2" fill="currentColor" />
                  <circle cx="8" cy="16.5" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <circle cx="15" cy="16.5" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
                <span className="text-xl font-bold tracking-tight text-white">
                  Circuit<span className="text-pink-300">Cart</span>
                </span>
              </Link>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
                The official technology marketplace for discovering new and pre-owned electronics across Cebu and the Visayas.
              </p>
            </div>

            <div className="md:col-span-3 space-y-2">
              <h4 className="font-bold text-white uppercase tracking-wider">
                Quick Navigation
              </h4>
              <ul className="space-y-1.5">
                <li>
                  <Link href="/marketplace" className="hover:text-white transition-colors">
                    Marketplace
                  </Link>
                </li>
                <li>
                  <a href="#categories" className="hover:text-white transition-colors">
                    Categories
                  </a>
                </li>
                <li>
                  <a href="#featured" className="hover:text-white transition-colors">
                    Featured Products
                  </a>
                </li>
                <li>
                  <a href="#about" className="hover:text-white transition-colors">
                    About CircuitCart
                  </a>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4 space-y-2">
              <h4 className="font-bold text-white uppercase tracking-wider">
                Account Actions
              </h4>
              <div className="flex items-center gap-3 pt-1">
                <Link
                  href="/login"
                  className="px-4 py-2 bg-[#1e1522] border border-[#34243b] text-white hover:bg-[#34243b] rounded-xl transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 bg-[#544061] text-white hover:bg-[#684d72] rounded-xl transition-colors"
                >
                  Create account
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-zinc-500">
            <p>© {new Date().getFullYear()} CircuitCart. All rights reserved.</p>
            <div className="flex gap-4">
              <span className="hover:text-zinc-300 cursor-pointer">Privacy Policy</span>
              <span>•</span>
              <span className="hover:text-zinc-300 cursor-pointer">Terms of Service</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}