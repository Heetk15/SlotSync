import Link from 'next/link';

export default function ProviderSelectionPage({ params }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#f4f7ff_35%,_#f8fafc_75%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-6 py-10 lg:px-10">
        <header className="space-y-3 border-b border-slate-200 pb-6">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <Link href="/book" className="font-medium text-[#0f62fe] transition hover:text-[#0b57e3]">
              Services
            </Link>
            <span>/</span>
            <Link href={`/book/${params.typeId}`} className="font-medium text-[#0f62fe] transition hover:text-[#0b57e3]">
              Providers
            </Link>
            <span>/</span>
            <span>Selection</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Next booking step</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Provider {params.providerId} was selected for service {params.typeId}. The slot selection experience can be added here next.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-600">
            This route is reserved for the next step in the consumer flow.
          </p>
        </section>
      </div>
    </main>
  );
}