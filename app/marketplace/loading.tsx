export default function MarketplaceLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading marketplace"
      className="mx-auto w-full max-w-7xl animate-pulse space-y-8 px-4 py-6 sm:px-6 lg:px-8"
    >
      <span className="sr-only">Loading marketplace content…</span>

      <div className="flex gap-2 overflow-hidden">
        {[72, 92, 84, 112, 80, 76].map((width) => (
          <div
            key={width}
            className="h-9 shrink-0 rounded-xl border border-white/5 bg-white/10"
            style={{ width }}
          />
        ))}
      </div>

      <div className="grid min-h-80 grid-cols-1 gap-6 rounded-3xl border border-white/10 bg-[#211a24]/75 p-6 sm:p-8 md:grid-cols-2">
        <div className="flex flex-col justify-center space-y-4">
          <div className="h-6 w-28 rounded-full bg-white/10" />
          <div className="h-9 w-4/5 rounded-xl bg-white/10" />
          <div className="h-4 w-full rounded-lg bg-white/10" />
          <div className="h-4 w-3/4 rounded-lg bg-white/10" />
          <div className="mt-3 flex gap-3">
            <div className="h-10 w-32 rounded-xl bg-white/10" />
            <div className="h-10 w-28 rounded-xl bg-white/10" />
          </div>
        </div>
        <div className="min-h-56 rounded-2xl bg-[#f8f3f3]/15" />
      </div>

      <div className="space-y-4">
        <div className="h-7 w-52 rounded-lg bg-white/10" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[390px] rounded-2xl border border-white/10 bg-[#f8f3f3]/15"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
