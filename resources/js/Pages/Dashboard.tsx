import { router, usePage } from '@inertiajs/react';
import { Bot, CalendarPlus, FileText, Paperclip, Send } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveBalance, LeaveRequest, LeaveType, PageProps } from '../types';

type Props = {
  leaveTypes: LeaveType[];
  balances: LeaveBalance[];
  requests: LeaveRequest[];
  pendingApprovals: LeaveRequest[];
  notifications: { id: number; title: string; body: string; created_at: string }[];
  faqs: { id: number; question: string; answer: string }[];
};

export default function Dashboard({ leaveTypes, balances, requests, pendingApprovals, notifications, faqs }: Props) {
  const { errors } = usePage<PageProps>().props;
  const [form, setForm] = useState({ leave_type_id: leaveTypes[0]?.id ?? '', starts_at: '', ends_at: '', reason: '', attachments: [] as File[] });
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');

  function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    const data = new FormData();
    data.append('leave_type_id', String(form.leave_type_id));
    data.append('starts_at', form.starts_at);
    data.append('ends_at', form.ends_at);
    data.append('reason', form.reason);
    form.attachments.forEach((file) => data.append('attachments[]', file));
    router.post('/leave-requests', data, { forceFormData: true });
  }

  async function askFaq(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/ai-help', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '' },
      body: JSON.stringify({ prompt }),
    });
    const json = await res.json();
    setAnswer(json.answer);
  }

  return (
    <AppLayout>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {balances.map((balance) => (
              <div key={balance.id} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">{balance.leave_type.name}</div>
                <div className="mt-2 text-3xl font-semibold text-slate-950">{balance.available_days}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <span>Quota {balance.allowance_days}</span>
                  <span>Used {balance.used_days}</span>
                  <span>Pending {balance.pending_days}</span>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={submitLeave} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarPlus size={20} className="text-emerald-700" />
              <h2 className="font-semibold text-slate-950">Submit Leave Request</h2>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="text-sm">Leave type
                <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.leave_type_id} onChange={(e) => setForm({ ...form, leave_type_id: Number(e.target.value) })}>
                  {leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                </select>
              </label>
              <label className="text-sm">Start date
                <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </label>
              <label className="text-sm">End date
                <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </label>
            </div>
            <textarea className="mt-4 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm">
                <Paperclip size={16} /> Attach files
                <input className="hidden" type="file" multiple onChange={(e) => setForm({ ...form, attachments: Array.from(e.target.files ?? []) })} />
              </label>
              <button className="flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"><Send size={16} /> Submit</button>
            </div>
            {Object.values(errors).length > 0 && <p className="mt-3 text-sm text-red-600">{Object.values(errors)[0]}</p>}
          </form>

          <div className="rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4 font-semibold">Request History</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Comment</th><th></th></tr></thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id} className="border-t border-slate-100">
                      <td className="px-5 py-3">{request.leave_type.name}</td>
                      <td>{request.starts_at} to {request.ends_at}</td>
                      <td>{request.requested_days}</td>
                      <td><span className="rounded-md bg-slate-100 px-2 py-1 text-xs">{request.status}</span></td>
                      <td>{request.manager_comment ?? '-'}</td>
                      <td>{request.status === 'pending' && <button className="text-red-600" onClick={() => router.delete(`/leave-requests/${request.id}`)}>Cancel</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          {pendingApprovals.length > 0 && <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{pendingApprovals.length} request(s) need manager review.</div>}
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">System Alerts</h2>
            <div className="mt-3 space-y-3">
              {notifications.map((item) => <div key={item.id} className="border-t border-slate-100 pt-3 text-sm"><div className="font-medium">{item.title}</div><div className="text-slate-500">{item.body}</div></div>)}
              {notifications.length === 0 && <p className="text-sm text-slate-500">No alerts.</p>}
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 font-semibold"><Bot size={18} /> Policy FAQ</div>
            <form onSubmit={askFaq} className="mt-3 flex gap-2">
              <input className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask about leave policy" />
              <button className="rounded-md bg-slate-900 px-3 py-2 text-white"><Send size={16} /></button>
            </form>
            {answer && <p className="mt-3 rounded-md bg-slate-100 p-3 text-sm">{answer}</p>}
            <div className="mt-4 space-y-2">
              {faqs.map((faq) => <details key={faq.id} className="text-sm"><summary className="cursor-pointer font-medium">{faq.question}</summary><p className="mt-1 text-slate-500">{faq.answer}</p></details>)}
            </div>
          </div>
          <a className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-4 text-sm shadow-sm" href={`/reports/monthly?month=${new Date().toISOString().slice(0, 7)}`}><FileText size={17} /> Download current month CSV</a>
        </aside>
      </div>
    </AppLayout>
  );
}
