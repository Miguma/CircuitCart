export default function MarketplaceLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading marketplace"
      className="mx-auto w-full max-w-[84rem] animate-pulse space-y-5 px-4 py-4 sm:py-6 sm:px-6 lg:px-8"
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

      <div className="grid min-h-72 grid-cols-1 gap-6 rounded-3xl border border-white/10 bg-[#211a24]/75 p-5 sm:p-6 lg:p-7 md:grid-cols-2">
        <div className="flex flex-col justify-center space-y-3">
          <div className="h-6 w-28 rounded-full bg-white/10" />
          <div className="h-9 w-4/5 rounded-xl bg-white/10" />
          <div className="h-4 w-full rounded-lg bg-white/10" />
          <div className="h-4 w-3/4 rounded-lg bg-white/10" />
          <div className="mt-2 flex gap-3">
            <div className="h-10 w-32 rounded-xl bg-white/10" />
            <div className="h-10 w-28 rounded-xl bg-white/10" />
          </div>
        </div>
        <div className="min-h-52 sm:min-h-60 rounded-2xl bg-[#f8f3f3]/15" />
      </div>

      <div className="space-y-3">
        <div className="h-7 w-52 rounded-lg bg-white/10" />
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-[300px] sm:h-[330px] rounded-2xl border border-white/10 bg-[#f8f3f3]/15"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
