"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Smartphone,
  Watch,
  Camera,
  Headphones,
  Monitor,
  Gamepad2,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Home,
  ShoppingCart,
  Search,
  User,
  Heart,
} from "lucide-react";

interface ShowcaseProduct {
  id: number;
  name: string;
  price: number;
  image: string;
  tags: string[];
}

export default function CircuitCartShowcasePage() {
  const [activeTab, setActiveTab] = useState<"new" | "bestseller" | "featured">("new");
  const [favorites, setFavorites] = useState<number[]>([6]); // Galaxy Fold is favorited in Figma reference
  const [bentoVisible, setBentoVisible] = useState(false);
  const bentoRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setBentoVisible(true);
          observer.disconnect(); // Trigger once only per page load
        }
      },
      { threshold: 0.15 }
    );

    if (bentoRef.current) {
      observer.observe(bentoRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const toggleFavorite = (id: number) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const categories = [
    { name: "Phones", icon: Smartphone },
    { name: "Smart Watches", icon: Watch },
    { name: "Cameras", icon: Camera },
    { name: "Headphones", icon: Headphones },
    { name: "Computers", icon: Monitor },
    { name: "Gaming", icon: Gamepad2 },
  ];

  const showcaseProducts: ShowcaseProduct[] = [
    {
      id: 1,
      name: "iPhone 14 Pro Max 128GB Deep Purple",
      price: 48990,
      image: "/images/products/Iphone 14 pro (1).png",
      tags: ["new", "bestseller"],
    },
    {
      id: 2,
      name: "Blackmagic Pocket Cinema Camera 6K",
      price: 118990,
      image: "/images/products/blackmagic-pocket-camera.png",
      tags: ["new", "featured"],
    },
    {
      id: 3,
      name: "Apple Watch Series 9 GPS 41mm Starlight Aluminium",
      price: 22990,
      image: "/images/products/apple-watch-series-9.png",
      tags: ["new"],
    },
    {
      id: 4,
      name: "AirPods Max Silver Starlight Aluminium",
      price: 32990,
      image: "/images/products/airpods-max.png",
      tags: ["new", "featured"],
    },
    {
      id: 5,
      name: "Samsung Galaxy Watch6 Classic 47mm Black",
      price: 18990,
      image:
        "/images/products/Samsung Galaxy Watch6 Classic 47mm Black (1).png",
      tags: ["new", "bestseller"],
    },
    {
      id: 6,
      name: "Galaxy Z Fold5 256GB Phantom Black",
      price: 72990,
      image: "/images/products/Galaxy Z Fold5.png",
      tags: ["new", "featured"],
    },
    {
      id: 7,
      name: "Galaxy Buds FE Graphite",
      price: 4990,
      image: "/images/products/galaxy-buds-fe.png",
      tags: ["new", "bestseller"],
    },
    {
      id: 8,
      name: "iPad 9th Gen 10.2-inch 64GB Wi-Fi Silver",
      price: 17990,
      image: "/images/products/ipad-9.png",
      tags: ["new", "bestseller"],
    },
  ];

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(price);

  const filteredProducts = showcaseProducts.filter((product) => {
    if (activeTab === "new") return true; // New Arrival displays all 8 products
    return product.tags.includes(activeTab);
  });

  const tabList: { key: "new" | "bestseller" | "featured"; label: string }[] = [
    { key: "new", label: "New Arrival" },
    { key: "bestseller", label: "Bestseller" },
    { key: "featured", label: "Featured Products" },
  ];

  return (
    <div className="min-h-screen w-full bg-[#735b64] text-[#faf7f7] font-sans overflow-x-hidden selection:bg-[#523d46] selection:text-white pb-16">
      {/* ========================================================= */}
      {/* 1. FLOATING PILL NAVIGATION BAR */}
      {/* ========================================================= */}
      <header className="w-full flex items-center justify-center pt-6 pb-2 px-4 select-none">
        <nav
          aria-label="Quick Navigation"
          className="inline-flex items-center gap-3.5 sm:gap-5 glass-showcase-nav px-4 sm:px-6 py-2 rounded-full text-zinc-300"
        >
          {/* Subtle CircuitCart Brand Mark */}
          <Link
            href="/"
            aria-label="CircuitCart Showcase Home"
            title="CircuitCart Showcase"
            className="inline-flex items-center gap-1.5 pr-2.5 sm:pr-3 border-r border-[#836974]/40 text-white hover:text-[#e59bc9] transition-colors focus-visible:outline-2 focus-visible:outline-white rounded-md"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-[#e59bc9] size-4 shrink-0"
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
            <span className="text-xs font-bold tracking-tight text-white hidden xs:inline sm:inline">
              Circuit<span className="text-[#e59bc9]">Cart</span>
            </span>
          </Link>

          <Link
            href="/"
            title="Showcase Home (Active)"
            aria-label="Showcase Home"
            className="text-white bg-white/20 p-1.5 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-white"
          >
            <Home className="size-4" />
          </Link>
          <Link
            href="/marketplace"
            title="Marketplace"
            aria-label="Marketplace"
            className="hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-white rounded-full p-1.5"
          >
            <ShoppingCart className="size-4" />
          </Link>
          <Link
            href="/marketplace"
            title="Search Products"
            aria-label="Search Products"
            className="hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-white rounded-full p-1.5"
          >
            <Search className="size-4" />
          </Link>
          <Link
            href="/login"
            title="Account Login"
            aria-label="Account Login"
            className="hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-white rounded-full p-1.5"
          >
            <User className="size-4" />
          </Link>
        </nav>
      </header>

      <main className="w-full py-4 space-y-9 sm:space-y-11">
        {/* ========================================================= */}
        {/* 2. HERO FEATURE CARD (Exact Figma Dimensions & Hierarchy) */}
        {/* ========================================================= */}
        <section
          id="hero"
          className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
        >
          <div className="w-full bg-[#1c151e] border border-[#3b2e3c]/60 rounded-[32px] sm:rounded-[44px] overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.35)] h-auto md:h-[clamp(540px,46vw,700px)] min-h-[520px] flex items-center">
            <div className="w-full h-full flex flex-col md:flex-row items-center justify-between">
              {/* Left Copy Column (~42% desktop width with generous left padding) */}
              <div className="w-full md:w-[42%] md:flex-none flex flex-col justify-center pl-6 sm:pl-10 md:pl-16 lg:pl-20 pr-6 py-10 md:py-0 z-10 space-y-4">
                <span className="text-xs sm:text-sm font-semibold tracking-wider text-[#a78b9d] uppercase">
                  Pro.Beyond.
                </span>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl tracking-tight text-white leading-[1.04]">
                  <span className="font-extralight block">iPhone</span>
                  <span className="font-extralight block">14</span>
                  <span className="font-bold block text-white">Pro</span>
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-xs leading-relaxed font-normal pt-1">
                  Created to change everything for the better. For everyone
                </p>
                <div className="pt-2">
                  <Link
                    href="/marketplace"
                    className="inline-flex items-center justify-center px-6 py-2.5 text-xs sm:text-sm font-semibold text-white bg-transparent border border-zinc-400/50 hover:bg-white/10 hover:border-white rounded-lg transition-all shadow-xs focus-visible:outline-2 focus-visible:outline-white"
                  >
                    Shop Now
                  </Link>
                </div>
              </div>

              {/* Right Product Artwork Column (~58% desktop width, center-right positioned, 35-50px bottom gap) */}
              <div className="w-full md:w-[58%] md:flex-none h-full flex items-end justify-center md:justify-center relative pr-4 md:pr-10 lg:pr-14 pb-[35px] sm:pb-[45px]">
                <div className="relative w-[82%] sm:w-[68%] md:w-[84%] max-w-[480px] h-[340px] sm:h-[420px] md:h-[90%] flex items-end justify-center">
                  <Image
                    src="/images/Iphone Image.png"
                    alt="iPhone 14 Pro"
                    width={520}
                    height={640}
                    priority
                    sizes="(max-width: 640px) 90vw, (max-width: 1024px) 55vw, 44vw"
                    className="w-full h-full object-contain object-bottom drop-shadow-[0_25px_35px_rgba(0,0,0,0.45)] select-none pointer-events-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 3. PRODUCT BENTO SECTION (Wider Container: 92vw / 1600px, 2.42:1 Ratio) */}
        {/* ========================================================= */}
        <section
          ref={bentoRef}
          aria-label="Featured Product Bento Grid"
          className="w-[92vw] max-w-[1600px] mx-auto px-1 sm:px-2"
        >
          {/* Main 2-Column Grid: 50% Left Composition / 50% MacBook Card */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[clamp(12px,1.1vw,18px)] lg:aspect-[2.42/1] items-stretch">
            {/* LEFT COMPOSITION: Explicit Grid Areas (PlayStation on top, AirPods & Vision Pro below) */}
            <div className="grid grid-cols-1 sm:grid-cols-[0.95fr_1.05fr] sm:grid-rows-[1.3fr_1fr] sm:[grid-template-areas:'playstation_playstation'_'airpods_vision'] gap-[clamp(12px,1.1vw,18px)] h-full">
              {/* Card 1: PlayStation 5 (Top Left, Spanning both cols in top row) */}
              <div
                style={{ transitionDelay: bentoVisible ? "0ms" : "0ms" }}
                className={`sm:[grid-area:playstation] order-1 min-w-0 min-h-0 bg-[#ededed] rounded-[clamp(22px,2vw,32px)] overflow-hidden relative flex flex-row items-center shadow-xs transition-all duration-500 ease-out motion-reduce:transition-none motion-reduce:transform-none group min-h-[200px] sm:min-h-[230px] lg:min-h-0 z-0 ${
                  bentoVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[14px]"
                }`}
              >
                {/* Console Artwork (Left: -10%, Bottom: 0, Height: 98%, ends cleanly before 41% width) */}
                <div className="absolute left-[-10%] bottom-0 h-[98%] w-auto max-w-none pointer-events-none select-none z-10">
                  <Image
                    src="/images/playstation-5.png"
                    alt="PlayStation 5"
                    width={500}
                    height={450}
                    sizes="(max-width: 768px) 50vw, 30vw"
                    className="h-full w-auto max-w-none object-contain object-left-bottom drop-shadow-md group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                {/* Right Typography (Starts ~47% from left, vertically centered) */}
                <div className="ml-[47%] pr-6 sm:pr-8 py-4 space-y-1.5 sm:space-y-2 z-20 relative">
                  <h3 className="text-[clamp(24px,2.1vw,38px)] font-normal text-[#1d1720] tracking-tight leading-tight">
                    Playstation 5
                  </h3>
                  <p className="text-[clamp(11px,0.8vw,14px)] text-[#716872] leading-relaxed line-clamp-3 max-w-[280px]">
                    Incredibly powerful CPUs, GPUs, and an SSD with integrated I/O will redefine your PlayStation experience.
                  </p>
                </div>
              </div>

              {/* Card 3: AirPods Max (Bottom Left under PlayStation) */}
              <div
                style={{ transitionDelay: bentoVisible ? "60ms" : "0ms" }}
                className={`sm:[grid-area:airpods] order-3 sm:order-none min-w-0 min-h-0 bg-[#ededed] rounded-[clamp(22px,2vw,32px)] overflow-hidden relative flex flex-row items-center shadow-xs transition-all duration-500 ease-out motion-reduce:transition-none motion-reduce:transform-none group min-h-[160px] sm:min-h-[180px] lg:min-h-0 z-0 ${
                  bentoVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[14px]"
                }`}
              >
                {/* Left Artwork (Intentionally cropped left side, visible right earcup only in left ~38% of card) */}
                <div className="absolute left-[-58%] top-1/2 -translate-y-1/2 h-[106%] w-auto max-w-none pointer-events-none select-none z-10">
                  <Image
                    src="/images/airpods.png"
                    alt="Apple AirPods Max"
                    width={500}
                    height={500}
                    sizes="(max-width: 768px) 45vw, 25vw"
                    className="h-full w-auto max-w-none object-contain object-center drop-shadow-sm group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                {/* Right Text (Starts ~46% from left) */}
                <div className="ml-[46%] pr-4 sm:pr-6 py-3 space-y-1 z-20 relative">
                  <h3 className="text-[clamp(16px,1.3vw,22px)] text-[#1d1720] leading-tight font-normal">
                    <span className="block">Apple</span>
                    <span className="block">AirPods</span>
                    <span className="block font-medium">Max</span>
                  </h3>
                  <p className="text-[clamp(10px,0.7vw,12px)] text-[#716872] leading-tight pt-0.5 line-clamp-2 max-w-[130px]">
                    Computational audio. Listen, it&apos;s powerful
                  </p>
                </div>
              </div>

              {/* Card 4: Apple Vision Pro (Bottom Beside AirPods under PlayStation) */}
              <div
                style={{ transitionDelay: bentoVisible ? "120ms" : "0ms" }}
                className={`sm:[grid-area:vision] order-4 sm:order-none min-w-0 min-h-0 bg-[#2f2f31] rounded-[clamp(22px,2vw,32px)] overflow-hidden relative flex flex-row items-center shadow-xs transition-all duration-500 ease-out motion-reduce:transition-none motion-reduce:transform-none group min-h-[160px] sm:min-h-[180px] lg:min-h-0 z-0 ${
                  bentoVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[14px]"
                }`}
              >
                {/* Left Artwork (Top: 45%, Width: 40%, translateY(-50%), stays inside left 40%) */}
                <div className="absolute left-0 top-[45%] -translate-y-1/2 w-[40%] h-auto max-w-none pointer-events-none select-none z-10">
                  <Image
                    src="/images/apple-vision-pro.png"
                    alt="Apple Vision Pro"
                    width={320}
                    height={260}
                    sizes="(max-width: 768px) 45vw, 18vw"
                    className="w-full h-auto max-w-none object-contain object-left drop-shadow-md group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                {/* Right Light Text (Starts ~48% from left) */}
                <div className="ml-[48%] pr-4 sm:pr-6 py-3 space-y-1 z-20 relative">
                  <h3 className="text-[clamp(16px,1.3vw,22px)] text-white leading-tight font-normal">
                    <span className="block">Apple</span>
                    <span className="block">Vision <span className="font-medium">Pro</span></span>
                  </h3>
                  <p className="text-[clamp(10px,0.7vw,12px)] text-zinc-400 leading-tight pt-0.5 line-clamp-2 max-w-[130px]">
                    An immersive way to experience entertainment
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT COMPOSITION: MacBook Air (50% width, spans full height of left composition) */}
            <div
              style={{ transitionDelay: bentoVisible ? "180ms" : "0ms" }}
              className={`order-2 lg:order-none min-w-0 min-h-0 bg-[#ededed] rounded-[clamp(22px,2vw,32px)] overflow-hidden relative flex flex-row items-center shadow-xs transition-all duration-500 ease-out motion-reduce:transition-none motion-reduce:transform-none group h-full min-h-[300px] sm:min-h-[380px] lg:min-h-0 z-0 ${
                bentoVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[14px]"
              }`}
            >
              {/* Left Content (8% from left edge, vertically centered slightly above middle) */}
              <div className="ml-[8%] max-w-[240px] sm:max-w-[280px] space-y-2.5 sm:space-y-3 z-20 relative py-6 my-auto">
                <h3 className="text-[clamp(34px,3.5vw,56px)] tracking-tight text-[#1d1720] leading-[1.0]">
                  <span className="font-light block">Macbook</span>
                  <span className="font-bold block">Air</span>
                </h3>
                <p className="text-[clamp(11px,0.8vw,14px)] text-[#716872] leading-relaxed line-clamp-3 pt-1">
                  The new 15-inch MacBook Air makes room for more of what you love with a spacious Liquid Retina display.
                </p>
                <div className="pt-2">
                  <Link
                    href="/marketplace"
                    className="inline-flex items-center justify-center px-6 py-2 text-xs font-medium text-[#1d1720] bg-transparent border border-[#1d1720]/60 hover:bg-[#1d1720] hover:text-white rounded-lg transition-all shadow-xs focus-visible:outline-2 focus-visible:outline-[#1d1720]"
                  >
                    Shop Now
                  </Link>
                </div>
              </div>

              {/* Right Laptop Artwork (Left: 59%, Bottom: 5%, Height: 88%, fills height, right cropped) */}
              <div
                style={{
                  left: "59%",
                  bottom: "5%",
                  height: "88%",
                  width: "auto",
                  maxWidth: "none",
                  right: "auto",
                }}
                className="absolute pointer-events-none select-none z-10"
              >
                <Image
                  src="/images/macbook-air.png"
                  alt="Apple MacBook Air"
                  width={1200}
                  height={1000}
                  sizes="(max-width: 768px) 100vw, 60vw"
                  className="h-full w-auto max-w-none object-contain object-left-bottom drop-shadow-2xl group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 4. BROWSE BY CATEGORY SECTION (80-90px gap, Dark Heading per Figma) */}
        {/* ========================================================= */}
        <section id="categories" className="w-[92vw] max-w-[1600px] mx-auto px-1 sm:px-2 pt-[75px] sm:pt-[85px] space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-medium text-[#1d1720] tracking-tight">
              Browse By Category
            </h2>
            <Link
              href="/marketplace"
              className="text-xs sm:text-sm font-normal text-[#716872] hover:text-[#1d1720] transition-colors"
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
                  className="bg-white/95 border border-[#e7dfe2] hover:bg-white hover:border-[#6e546f] rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all text-center group shadow-xs hover:shadow-md"
                >
                  <IconElem className="size-6 text-[#6e546f] group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-[#1d1720]">
                    {cat.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ========================================================= */}
        {/* 5. SHOWCASE PRODUCT GRID (Figma Product Cards & Accessible Tabs) */}
        {/* ========================================================= */}
        <section
          id="featured"
          aria-label="Showcase Products"
          className="w-full max-w-[1240px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6"
        >
          {/* Accessible Tabs Header (Underline Style per Figma) */}
          <div
            role="tablist"
            aria-label="Product filter tabs"
            className="flex items-center gap-6 sm:gap-8 border-b border-[#8a707c]/40 pb-px"
          >
            {tabList.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  id={`tab-${tab.key}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.key}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(tab.key)}
                  className={`text-sm sm:text-base transition-all pb-1.5 focus-visible:outline-2 focus-visible:outline-[#1d1720] rounded-xs cursor-pointer ${
                    isActive
                      ? "text-[#1d1720] font-semibold border-b-2 border-[#1d1720]"
                      : "text-[#4a3a42] hover:text-[#1d1720] font-medium"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Product Cards 4-Column Grid */}
          <div
            role="tabpanel"
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 transition-opacity duration-200 ease-out"
          >
            {filteredProducts.map((product) => {
              const isFav = favorites.includes(product.id);
              return (
                <div
                  key={product.id}
                  className="bg-[#8b6d79] rounded-xl p-4 sm:p-5 flex flex-col justify-between items-center relative shadow-xs transition-all duration-200"
                >
                  {/* Upper-right Favorite Heart Button */}
                  <button
                    type="button"
                    aria-label={
                      isFav
                        ? `Remove ${product.name} from favorites`
                        : `Add ${product.name} to favorites`
                    }
                    onClick={() => toggleFavorite(product.id)}
                    className="absolute top-3.5 right-3.5 p-1 rounded-full text-[#cbb8c2] hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-[#1d1720] z-10 cursor-pointer"
                  >
                    <Heart
                      className={`size-4.5 transition-colors ${
                        isFav
                          ? "fill-[#e13b4f] text-[#e13b4f]"
                          : "stroke-[1.75]"
                      }`}
                    />
                  </button>

                  {/* Product Artwork in Upper Half */}
                  <div className="w-full h-40 sm:h-44 flex items-center justify-center relative my-1 sm:my-2">
                    <Image
                      src={product.image}
                      alt={product.name}
                      width={220}
                      height={220}
                      sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 25vw"
                      className="max-h-[145px] sm:max-h-[155px] w-auto h-auto object-contain pointer-events-none drop-shadow-sm select-none"
                    />
                  </div>

                  {/* Centered Product Title (Max 3 lines / Clamped to 2-3 lines) */}
                  <h3 className="text-center text-xs sm:text-[13px] font-medium text-[#1d1720] leading-snug line-clamp-2 h-9 flex items-center justify-center mt-1 px-1">
                    {product.name}
                  </h3>

                  {/* Formatted Philippine Peso Price */}
                  <div className="text-center text-sm sm:text-base font-bold text-[#1d1720] mt-1.5 mb-2">
                    {formatPrice(product.price)}
                  </div>

                  {/* Full-width Compact Black Buy Now Button (Routes to /login) */}
                  <div className="w-full mt-auto pt-1">
                    <Link
                      href="/login"
                      className="w-full h-9 sm:h-10 inline-flex items-center justify-center text-xs font-semibold bg-[#1d1720] hover:bg-[#2b1f2e] text-white rounded-lg transition-all hover:-translate-y-px shadow-xs focus-visible:outline-2 focus-visible:outline-white"
                    >
                      Buy Now
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================= */}
        {/* 6. SPECIAL DISCOUNTS BANNER */}
        {/* ========================================================= */}
        <section
          id="discounts"
          className="w-[92vw] max-w-[1600px] mx-auto px-1 sm:px-2"
        >
          <div className="w-full bg-[#1c151e] border border-[#3b2e3c]/60 rounded-3xl p-8 sm:p-10 space-y-6 shadow-xl">
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
                  className="bg-[#241b26] border border-[#3d2f40] rounded-2xl p-4 text-center space-y-3"
                >
                  <div className="text-xs font-bold text-white line-clamp-1">
                    {p.name}
                  </div>
                  <div className="text-base font-extrabold text-pink-300">
                    {formatPrice(p.price)}
                  </div>
                  <Link
                    href="/login"
                    className="w-full h-8 inline-flex items-center justify-center text-xs font-semibold bg-[#544061] text-white hover:bg-[#684d72] rounded-xl transition-all"
                  >
                    Buy Now
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 7. ABOUT CIRCUITCART SECTION */}
        {/* ========================================================= */}
        <section
          id="about"
          className="w-[92vw] max-w-[1600px] mx-auto px-1 sm:px-2"
        >
          <div className="w-full bg-white border border-[#e7dfe2] rounded-3xl p-8 sm:p-12 space-y-8 shadow-sm text-[#1d1720]">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-3xl font-extrabold text-[#1d1720] tracking-tight">
                About CircuitCart
              </h2>
              <p className="text-sm text-[#716872] leading-relaxed">
                CircuitCart is the trusted technology marketplace tailored for Cebu and the Visayas. We connect buyers and sellers through verified listings, transparent condition ratings, and safe local trading.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#fbf9fa] border border-[#e7dfe2] rounded-2xl p-6 space-y-3">
                <ShieldCheck className="size-7 text-[#6e546f]" />
                <h3 className="text-base font-bold text-[#1d1720]">
                  Verified Tech Sellers
                </h3>
                <p className="text-xs text-[#716872] leading-relaxed">
                  Every listing is backed by seller verification to ensure authentic hardware and safe transactions.
                </p>
              </div>

              <div className="bg-[#fbf9fa] border border-[#e7dfe2] rounded-2xl p-6 space-y-3">
                <Sparkles className="size-7 text-[#6e546f]" />
                <h3 className="text-base font-bold text-[#1d1720]">
                  Transparent Conditions
                </h3>
                <p className="text-xs text-[#716872] leading-relaxed">
                  Detailed specs, condition grades (New, Like New, Good, Fair), and honest pricing in Philippine Pesos.
                </p>
              </div>

              <div className="bg-[#fbf9fa] border border-[#e7dfe2] rounded-2xl p-6 space-y-3">
                <RefreshCw className="size-7 text-[#6e546f]" />
                <h3 className="text-base font-bold text-[#1d1720]">
                  Better Electronics Lifecycle
                </h3>
                <p className="text-xs text-[#716872] leading-relaxed">
                  Giving quality pre-owned laptops, smartphones, and gaming gear a second life in our tech ecosystem.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================= */}
      {/* 8. FOOTER */}
      {/* ========================================================= */}
      <footer className="w-full bg-[#18111a] border-t border-[#2d1f2e] pt-12 pb-8 mt-12 text-zinc-400 text-xs">
        <div className="w-[92vw] max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-[#2d1f2e]">
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
                  className="px-4 py-2 bg-[#261a28] border border-[#3b2a3d] text-white hover:bg-[#3b2a3d] rounded-xl transition-colors"
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