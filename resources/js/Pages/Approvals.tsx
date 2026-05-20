import { router } from '@inertiajs/react';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveRequest } from '../types';

export default function Approvals({ requests }: { requests: LeaveRequest[] }) {
  const [comments, setComments] = useState<Record<number, string>>({});
  const decide = (id: number, decision: 'approved' | 'rejected') => router.patch(`/approvals/${id}`, { decision, manager_comment: comments[id] ?? '' });

  return (
    <AppLayout>
      <div className="rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4 font-semibold">Pending Team Requests</div>
        <div className="divide-y divide-slate-100">
          {requests.map((request) => (
            <div key={request.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_280px]">
              <div>
                <div className="font-medium text-slate-950">{request.user?.name} · {request.leave_type.name}</div>
                <div className="mt-1 text-sm text-slate-500">{request.starts_at} to {request.ends_at} · {request.requested_days} working day(s)</div>
                <p className="mt-3 text-sm">{request.reason}</p>
                <div className="mt-2 text-xs text-slate-500">Attachments: {request.attachments?.map((a) => a.original_name).join(', ') || 'None'}</div>
              </div>
              <div>
                <textarea className="h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Decision comment" value={comments[request.id] ?? ''} onChange={(e) => setComments({ ...comments, [request.id]: e.target.value })} />
                <div className="mt-3 flex gap-2">
                  <button className="flex flex-1 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white" onClick={() => decide(request.id, 'approved')}><Check size={16} /> Approve</button>
                  <button className="flex flex-1 items-center justify-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white" onClick={() => decide(request.id, 'rejected')}><X size={16} /> Reject</button>
                </div>
              </div>
            </div>
          ))}
          {requests.length === 0 && <div className="p-5 text-sm text-slate-500">No pending requests.</div>}
        </div>
      </div>
    </AppLayout>
  );
}
