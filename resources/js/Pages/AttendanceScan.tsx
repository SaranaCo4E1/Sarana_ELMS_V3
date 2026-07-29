import { Head, router } from '@inertiajs/react';
import { CheckCircle2, Clock3, LocateFixed, LogIn, LogOut, MapPin, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

type Props = {
  site: { id: number; name: string; timezone: string };
  direction: 'in' | 'out';
  token: string;
  qrPublicId: string;
  idempotencyKey: string;
};

export default function AttendanceScan({ site, direction, token, qrPublicId, idempotencyKey }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('Ready to request your location.');
  const Icon = direction === 'in' ? LogIn : LogOut;

  const submit = () => {
    if (submitting) return;
    setSubmitting(true);
    setStatus('Requesting location…');

    const send = (payload: Record<string, unknown>) => {
      setStatus('Recording with secure server time…');
      router.post(`/attendance/scan/${qrPublicId}`, {
        token,
        idempotency_key: idempotencyKey,
        ...payload,
      }, {
        preserveScroll: true,
        onError: () => {
          setSubmitting(false);
          setStatus('Could not record this scan. Check the message and try again.');
        },
      });
    };

    if (!navigator.geolocation) {
      send({ geolocation_error: 'unavailable' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => send({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_meters: position.coords.accuracy,
      }),
      (error) => send({
        geolocation_error: error.code === error.PERMISSION_DENIED
          ? 'denied'
          : error.code === error.TIMEOUT ? 'timeout' : 'unavailable',
      }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  return (
    <>
      <Head title={`Attendance ${direction}`} />
      <main className="min-h-screen bg-[#fafbfa] px-4 py-8">
        <div className="mx-auto max-w-md">
          <div className="mb-8 flex items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-100 bg-white shadow-sm">
              <img src="/images/niyai-logo.png" alt="NiyAI" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-900">NiyAI Attendance</div>
              <div className="text-xs text-neutral-400">Authenticated employee check</div>
            </div>
          </div>

          <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl shadow-neutral-200/40">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 px-6 py-8 text-white">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                <Icon size={27} />
              </div>
              <p className="text-sm font-medium text-orange-100">Next attendance event</p>
              <h1 className="mt-1 text-3xl font-semibold capitalize">Check {direction}</h1>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4">
                <div className="flex items-center gap-3 text-sm text-neutral-700">
                  <MapPin size={17} className="text-orange-600" />
                  <span className="font-medium">{site.name}</span>
                </div>
                <div className="mt-3 flex items-center gap-3 text-sm text-neutral-500">
                  <Clock3 size={17} />
                  <span>Time is recorded securely by the server</span>
                </div>
              </div>

              <div className="flex gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-sm leading-6 text-blue-800">
                <LocateFixed size={18} className="mt-0.5 shrink-0" />
                <p>Your browser will request location permission. If location is unavailable, the office network can still verify the punch.</p>
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-orange-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-200 transition hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? <LocateFixed className="animate-pulse" size={18} /> : <CheckCircle2 size={18} />}
                {submitting ? 'Recording…' : `Confirm check ${direction}`}
              </button>

              <div className="flex items-start gap-2 text-xs leading-5 text-neutral-400">
                <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                <p>A failed location/network check does not discard your punch; it is recorded and flagged for review.</p>
              </div>
              <p className="text-center text-xs font-medium text-neutral-500">{status}</p>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
