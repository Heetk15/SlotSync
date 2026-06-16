export default function Loading() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#f4f7ff_35%,_#f8fafc_75%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <div className="space-y-3 border-b border-slate-200 pb-6">
          <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />
          <div className="h-10 w-80 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-4 w-[32rem] max-w-full animate-pulse rounded-full bg-slate-200" />
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-4">
                <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
                <div className="h-7 w-3/4 animate-pulse rounded-full bg-slate-200" />
                <div className="space-y-2">
                  <div className="h-4 w-full animate-pulse rounded-full bg-slate-200" />
                  <div className="h-4 w-5/6 animate-pulse rounded-full bg-slate-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}