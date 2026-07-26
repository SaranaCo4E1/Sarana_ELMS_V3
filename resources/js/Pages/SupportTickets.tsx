import { Head } from '@inertiajs/react';
import { Clock3, Inbox, Mail, MessageSquareText, Search, UserRound } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import AppLayout from '../Layouts/AppLayout';

type Ticket = {
  id: number;
  user_id: number | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
  } | null;
};

type Props = {
  tickets: Ticket[];
  stats: {
    total: number;
    today: number;
    registered: number;
    guest: number;
  };
};

function formatTicketDate(value: string, includeTime = false) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(value));
}

export default function SupportTickets({ tickets, stats }: Props) {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<'all' | 'registered' | 'guest'>('all');
  const [selectedId, setSelectedId] = useState<number | null>(tickets[0]?.id ?? null);

  const filteredTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesSource =
        source === 'all' ||
        (source === 'registered' && ticket.user_id !== null) ||
        (source === 'guest' && ticket.user_id === null);
      const searchable = `${ticket.name} ${ticket.email} ${ticket.subject} ${ticket.message}`.toLowerCase();

      return matchesSource && searchable.includes(normalizedQuery);
    });
  }, [query, source, tickets]);

  const selectedTicket =
    filteredTickets.find((ticket) => ticket.id === selectedId) ??
    filteredTickets[0] ??
    null;

  return (
    <AppLayout>
      <Head title="Support Tickets" />

      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-orange-600">
              <MessageSquareText size={14} />
              Help Desk
            </div>
            <h1 className="mt-2 text-2xl font-medium tracking-tight text-neutral-900">Support Tickets</h1>
            <p className="mt-1.5 text-sm text-neutral-500">
              Review inquiries submitted through the public support desk.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<Inbox size={15} />} label="All tickets" value={stats.total} />
          <Metric icon={<Clock3 size={15} />} label="Submitted today" value={stats.today} />
          <Metric icon={<UserRound size={15} />} label="Registered users" value={stats.registered} />
          <Metric icon={<Mail size={15} />} label="Guest inquiries" value={stats.guest} />
        </div>

        <section className="overflow-hidden rounded-xl border border-neutral-200/60 bg-white shadow-premium-sm">
          <div className="flex flex-col gap-3 border-b border-neutral-200/60 bg-neutral-50/20 px-5 py-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, subject, or message..."
                className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-9 pr-3.5 text-sm text-neutral-800 outline-none transition-all placeholder:text-neutral-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/5"
              />
            </div>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as typeof source)}
              className="rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-700 outline-none transition-all focus:border-orange-500 focus:ring-4 focus:ring-orange-500/5"
            >
              <option value="all">All submitters</option>
              <option value="registered">Registered users</option>
              <option value="guest">Guest inquiries</option>
            </select>
          </div>

          {filteredTickets.length > 0 ? (
            <div className="grid min-h-[34rem] lg:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.35fr)]">
              <div className="max-h-[42rem] overflow-y-auto border-b border-neutral-200/60 lg:border-b-0 lg:border-r">
                {filteredTickets.map((ticket) => {
                  const active = selectedTicket?.id === ticket.id;

                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setSelectedId(ticket.id)}
                      className={`block w-full border-b border-neutral-100 px-5 py-4 text-left transition-colors ${
                        active ? 'bg-orange-50/60' : 'hover:bg-neutral-50/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-neutral-900">{ticket.subject}</div>
                          <div className="mt-1 truncate text-xs text-neutral-500">
                            {ticket.name} · {ticket.email}
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                          {formatTicketDate(ticket.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-neutral-500">{ticket.message}</p>
                      <span
                        className={`mt-3 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider ${
                          ticket.user_id
                            ? 'border-orange-100 bg-orange-50 text-orange-700'
                            : 'border-neutral-200 bg-neutral-50 text-neutral-500'
                        }`}
                      >
                        {ticket.user_id ? 'Registered user' : 'Guest'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedTicket && (
                <article className="p-6 sm:p-8">
                  <div className="border-b border-neutral-100 pb-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wider text-orange-600">
                          Ticket #{selectedTicket.id}
                        </div>
                        <h2 className="mt-2 text-xl font-medium leading-snug text-neutral-900">
                          {selectedTicket.subject}
                        </h2>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[10px] font-medium text-neutral-500">
                        <Clock3 size={11} />
                        {formatTicketDate(selectedTicket.created_at, true)}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 border-b border-neutral-100 py-6 sm:grid-cols-2">
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">Submitted by</div>
                      <div className="mt-1.5 text-sm font-medium text-neutral-800">{selectedTicket.name}</div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {selectedTicket.user_id ? 'Registered employee' : 'Guest submitter'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">Contact email</div>
                      <a
                        href={`mailto:${selectedTicket.email}?subject=${encodeURIComponent(`Re: ${selectedTicket.subject}`)}`}
                        className="mt-1.5 inline-flex items-center gap-1.5 break-all text-sm font-medium text-orange-700 hover:text-orange-800"
                      >
                        <Mail size={13} />
                        {selectedTicket.email}
                      </a>
                    </div>
                  </div>

                  <div className="py-6">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">Message</div>
                    <div className="mt-3 whitespace-pre-wrap rounded-xl border border-neutral-200/70 bg-neutral-50/50 p-5 text-sm leading-7 text-neutral-700">
                      {selectedTicket.message}
                    </div>
                  </div>
                </article>
              )}
            </div>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-400">
                <Inbox size={20} />
              </div>
              <h2 className="mt-4 text-sm font-medium text-neutral-800">No support tickets found</h2>
              <p className="mt-1.5 text-xs text-neutral-500">
                {tickets.length === 0 ? 'New inquiries will appear here.' : 'Try changing your search or submitter filter.'}
              </p>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-200/60 bg-white p-5 shadow-premium-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-orange-100 bg-orange-50 text-orange-600">
          {icon}
        </span>
      </div>
      <div className="mt-3 text-2xl font-medium text-neutral-900">{value}</div>
    </div>
  );
}
