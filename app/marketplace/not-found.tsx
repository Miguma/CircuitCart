import Link from "next/link";
import { ArrowLeft, PackageSearch } from "lucide-react";

export default function MarketplaceNotFound() {
  return (
    <main className="mx-auto flex min-h-[68vh] w-full max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <section className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#211a24] p-8 text-center shadow-2xl sm:p-12">
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[#e59bc9]/10 blur-3xl" />
        <div className="relative">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-[#342339] text-[#e59bc9] shadow-lg">
            <PackageSearch className="size-8" />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-[#e59bc9]">
            Listing unavailable
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            We could not find this product.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[#d6cbd5]">
            It may have been sold, removed, or moved to another listing. Browse the marketplace for similar verified tech.
          </p>
          <Link
            href="/marketplace"
            className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#65486f] px-5 text-sm font-bold text-white transition-colors hover:bg-[#7a5985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e59bc9]"
          >
            <ArrowLeft className="size-4" />
            Back to marketplace
          </Link>
        </div>
      </section>
    </main>
  );
}
