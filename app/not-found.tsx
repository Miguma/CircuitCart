import Link from "next/link";
import { ArrowLeft, Search, ShoppingCart } from "lucide-react";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#19131b] px-6 py-16 text-[#fffafa]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(143,115,117,0.55),transparent_48%)]" />
      <div className="pointer-events-none absolute -left-24 top-1/3 size-72 rounded-full bg-[#65486f]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-1/4 size-72 rounded-full bg-[#e59bc9]/10 blur-3xl" />

      <section className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-[#211a24]/90 p-8 text-center shadow-[0_24px_80px_rgba(8,5,9,0.45)] backdrop-blur-xl sm:p-12">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-[#342339] text-[#e59bc9] shadow-lg">
          <ShoppingCart className="size-8" />
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-[#e59bc9]">
          Error 404
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          This item wandered off the shelf.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[#d6cbd5] sm:text-base">
          The page may have moved, or the listing is no longer available. There is still plenty of verified tech to discover.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/marketplace"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#65486f] px-5 text-sm font-bold text-white transition-colors hover:bg-[#7a5985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e59bc9]"
          >
            <Search className="size-4" />
            Browse marketplace
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-[#fffafa] transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e59bc9]"
          >
            <ArrowLeft className="size-4" />
            Back to showcase
          </Link>
        </div>
      </section>
    </main>
  );
}
