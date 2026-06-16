import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function getAppointmentType(typeId) {
  const response = await fetch(`${API_URL}/bookings/appointment-types`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load appointment types.');
  }

  const appointmentTypes = await response.json();
  return appointmentTypes.find((type) => type.id === typeId) || null;
}

async function getProviders(typeId) {
  const response = await fetch(`${API_URL}/bookings/appointment-types/${typeId}/providers`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load providers.');
  }

  return response.json();
}

export default async function AppointmentTypeProvidersPage({ params }) {
  const [appointmentType, providers] = await Promise.all([
    getAppointmentType(params.typeId),
    getProviders(params.typeId),
  ]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#f4f7ff_35%,_#f8fafc_75%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <header className="space-y-3 border-b border-slate-200 pb-6">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <Link href="/book" className="font-medium text-[#0f62fe] transition hover:text-[#0b57e3]">
              Back to services
            </Link>
            <span>/</span>
            <span>Providers</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
            {appointmentType?.name || 'Choose a provider'}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            {appointmentType?.description || 'Select a provider to continue.'}
          </p>
        </header>

        {providers.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <p className="text-base font-medium text-slate-900">No providers found for this service.</p>
            <p className="mt-2 text-sm text-slate-600">Please choose a different appointment type.</p>
          </section>
        ) : (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {providers.map((provider) => (
              <Link
                key={provider.id}
                href={`/book/${params.typeId}/${provider.id}`}
                className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#0f62fe]/20"
              >
                <div className="flex h-full flex-col justify-between gap-6">
                  <div className="space-y-3">
                    <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                      Provider
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight text-slate-950">{provider.name}</h2>
                    <p className="text-sm leading-6 text-slate-600">{provider.description}</p>
                  </div>
                  <span className="text-sm font-medium text-[#0f62fe] transition group-hover:translate-x-0.5">
                    Select provider
                  </span>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}