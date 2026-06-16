export default function Loading() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#f4f7ff_35%,_#f8fafc_75%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <div className="space-y-3 border-b border-slate-200 pb-6">
          <div className="h-4 w-36 animate-pulse rounded-full bg-slate-200" />
          <div className="h-10 w-72 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-4 w-[32rem] max-w-full animate-pulse rounded-full bg-slate-200" />
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
              <div className="h-7 w-48 animate-pulse rounded-full bg-slate-200" />
              <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
            </div>
            <div className="flex justify-end">
              <div className="h-11 w-36 animate-pulse rounded-xl bg-slate-200" />
            </div>
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-4">
                <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Array.from({ length: 6 }).map((__, buttonIndex) => (
                    <div key={buttonIndex} className="h-10 animate-pulse rounded-xl bg-slate-200" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
