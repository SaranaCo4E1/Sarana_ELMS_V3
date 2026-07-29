import { router } from '@inertiajs/react';
import { LogIn, LogOut, MapPin, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  direction?: 'in' | 'out' | null;
  branchName?: string | null;
  unavailableReason?: string | null;
  className?: string;
};

export default function AttendancePunchButton({
  direction,
  branchName,
  unavailableReason,
  className = '',
}: Props) {
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const available = Boolean(direction) && !unavailableReason;
  const Icon = direction === 'out' ? LogOut : LogIn;
  const label = unavailableReason
    ? 'Attendance unavailable'
    : direction === 'out' ? 'Check out' : 'Check in';

  useEffect(() => {
    if (!available) setConfirming(false);
  }, [available]);

  const submit = (location: Record<string, string | number>) => {
    router.post('/attendance/punch', {
      idempotency_key: uuid(),
      ...location,
    }, {
      preserveScroll: true,
      onStart: () => {
        setProcessing(true);
        setStatus('Recording attendance…');
      },
      onSuccess: () => {
        setStatus(null);
        setConfirming(false);
      },
      onError: (errors) => setStatus(
        typeof errors.attendance === 'string'
          ? errors.attendance
          : 'Attendance could not be recorded. Please try again.',
      ),
      onFinish: () => setProcessing(false),
    });
  };

  const punch = () => {
    if (!available || processing) return;
    setProcessing(true);
    setStatus('Checking your location…');

    if (!navigator.geolocation) {
      submit({ geolocation_error: 'unavailable' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => submit({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_meters: position.coords.accuracy,
      }),
      (error) => submit({
        geolocation_error: error.code === error.PERMISSION_DENIED
          ? 'denied'
          : error.code === error.TIMEOUT ? 'timeout' : 'unavailable',
      }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={!available || processing}
        title={unavailableReason ?? `${label} at ${branchName ?? 'your primary branch'}`}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500 disabled:shadow-none"
      >
        <Icon size={16} />
        {processing ? 'Recording…' : label}
      </button>
      <p className={`mt-1.5 text-center text-xs ${unavailableReason ? 'text-amber-700' : 'text-neutral-400'}`}>
        {unavailableReason ?? status ?? (branchName ? `Primary branch: ${branchName}` : 'Location or branch network verification applies')}
      </p>
      {confirming && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-sm"
          onClick={() => !processing && setConfirming(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendance-confirm-title"
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-neutral-100 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Confirm attendance</p>
                <h2 id="attendance-confirm-title" className="mt-1.5 text-lg font-semibold text-neutral-900">
                  {direction === 'out' ? 'Check out now?' : 'Check in now?'}
                </h2>
              </div>
              <button
                type="button"
                disabled={processing}
                onClick={() => setConfirming(false)}
                aria-label="Close attendance confirmation"
                className="rounded-lg border border-neutral-200 p-2 text-neutral-400 hover:bg-neutral-50 disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </header>
            <div className="space-y-4 p-5">
              <div className="flex gap-3 rounded-xl border border-neutral-100 bg-neutral-50/70 p-4">
                <MapPin className="mt-0.5 shrink-0 text-orange-600" size={18} />
                <div>
                  <p className="text-sm font-medium text-neutral-800">{branchName ?? 'Your primary branch'}</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    Your current location or branch network will be checked. The server records the official time.
                  </p>
                </div>
              </div>
              {status && <p className="text-center text-xs text-neutral-500" role="status">{status}</p>}
            </div>
            <footer className="flex justify-end gap-3 border-t border-neutral-100 p-5">
              <button
                type="button"
                disabled={processing}
                onClick={() => setConfirming(false)}
                className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={punch}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
              >
                <Icon size={16} />
                {processing ? 'Recording…' : `Confirm ${direction === 'out' ? 'check out' : 'check in'}`}
              </button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (character) => (
    Number(character) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(character) / 4)))
  ).toString(16));
}
