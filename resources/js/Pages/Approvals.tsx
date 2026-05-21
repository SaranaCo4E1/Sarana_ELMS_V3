import { router } from '@inertiajs/react';
import {
  Calendar,
  Check,
  ChevronRight,
  Clock,
  ClipboardCheck,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Paperclip,
  User2,
  X,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveRequest } from '../types';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-500',
};

export default function Approvals({ requests }: { requests: LeaveRequest[] }) {
  const [selected, setSelected] = useState<LeaveRequest | null>(null);

  return (
    <AppLayout>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Pending Approvals</h2>
              <p className="text-sm text-slate-500">
                {requests.length} {requests.length === 1 ? 'request' : 'requests'} awaiting review
              </p>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {requests.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <ClipboardCheck size={28} />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-500">No pending requests</p>
            <p className="mt-1 text-xs text-slate-400">All team requests have been reviewed</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((r) => {
              const statusStyle = STATUS_STYLE[r.status] ?? 'bg-slate-100 text-slate-600';
              return (
                <button
                  key={r.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-slate-50/60"
                  onClick={() => setSelected(r)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {r.user?.name ?? 'Unknown'}
                      </span>
                      <span className="text-sm text-slate-400">&middot;</span>
                      <span className="text-sm font-medium text-slate-600">{r.leave_type.name}</span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle}`}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        {fmtDate(r.starts_at)}
                        <ChevronRight size={12} className="text-slate-300" />
                        {fmtDate(r.ends_at)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-400" />
                        {r.requested_days} {parseFloat(r.requested_days) === 1 ? 'day' : 'days'}
                      </span>
                      {r.user?.department && (
                        <span className="flex items-center gap-1.5">
                          <User2 size={13} className="text-slate-400" />
                          {r.user.department.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="mt-1.5 shrink-0 text-slate-300" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <ApprovalDetailModal
          request={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </AppLayout>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail + Decision Modal                                            */
/* ------------------------------------------------------------------ */

function ApprovalDetailModal({
  request: r,
  onClose,
}: {
  request: LeaveRequest;
  onClose: () => void;
}) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function decide(decision: 'approved' | 'rejected') {
    setSubmitting(true);
    router.patch(
      `/approvals/${r.id}`,
      { decision, manager_comment: comment },
      {
        onFinish: () => setSubmitting(false),
        onSuccess: () => onClose(),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg animate-[scaleIn_0.15s_ease-out] overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Review Request</h3>
              <p className="text-xs text-slate-500">{r.user?.name ?? 'Unknown'} &middot; {r.leave_type.name}</p>
            </div>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4">
            <InfoField label="Leave Type" value={r.leave_type.name} />
            <InfoField label="Duration" value={`${r.requested_days} ${parseFloat(r.requested_days) === 1 ? 'day' : 'days'}`} />
            <InfoField label="Start Date" value={fmtDate(r.starts_at)} />
            <InfoField label="End Date" value={fmtDate(r.ends_at)} />
            {r.user?.department && <InfoField label="Department" value={r.user.department.name} />}
            {r.user && <InfoField label="Employee" value={r.user.name} />}
          </div>

          {/* Reason */}
          <div className="mt-5">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Reason</div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm leading-relaxed text-slate-700">
              {r.reason || <span className="italic text-slate-400">No reason provided</span>}
            </div>
          </div>

          {/* Attachments */}
          {r.attachments && r.attachments.length > 0 && (
            <AttachmentViewer attachments={r.attachments} />
          )}

          {/* Decision comment */}
          <div className="mt-5">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Your Comment <span className="normal-case tracking-normal text-slate-300">(optional)</span>
            </div>
            <div className="relative">
              <MessageSquare size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
              <textarea
                className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Add a comment for the employee..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
              onClick={() => decide('rejected')}
            >
              <X size={15} /> Reject
            </button>
            <button
              type="button"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:opacity-50"
              onClick={() => decide('approved')}
            >
              <Check size={15} /> Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small Helpers                                                      */
/* ------------------------------------------------------------------ */

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}

function fmtDate(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ------------------------------------------------------------------ */
/*  Attachment Viewer                                                  */
/* ------------------------------------------------------------------ */

type Attachment = { id: number; original_name: string; path: string; mime_type: string };

function isImage(mime: string) {
  return mime.startsWith('image/');
}

function attachmentUrl(id: number, inline = false) {
  return `/attachments/${id}${inline ? '?inline=1' : ''}`;
}

function AttachmentViewer({ attachments }: { attachments: Attachment[] }) {
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  const images = attachments.filter((a) => isImage(a.mime_type));
  const files = attachments.filter((a) => !isImage(a.mime_type));

  return (
    <div className="mt-5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Attachments ({attachments.length})
      </div>

      {/* Image thumbnails */}
      {images.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((a) => {
            const idx = attachments.indexOf(a);
            return (
              <button
                key={a.id}
                type="button"
                className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-all hover:border-emerald-300 hover:shadow-md"
                onClick={() => setPreviewIdx(idx)}
              >
                <img
                  src={attachmentUrl(a.id, true)}
                  alt={a.original_name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                  <Eye size={20} className="text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Non-image files */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((a) => (
            <a
              key={a.id}
              href={attachmentUrl(a.id)}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/30"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <FileIcon mime={a.mime_type} />
              </div>
              <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{a.original_name}</span>
              <Download size={14} className="shrink-0 text-slate-400" />
            </a>
          ))}
        </div>
      )}

      {/* Image lightbox */}
      {previewIdx !== null && (
        <ImageLightbox
          attachments={attachments.filter((a) => isImage(a.mime_type))}
          initialIndex={images.indexOf(attachments[previewIdx])}
          onClose={() => setPreviewIdx(null)}
        />
      )}
    </div>
  );
}

function FileIcon({ mime }: { mime: string }) {
  if (mime.includes('pdf')) return <FileText size={16} />;
  if (mime.includes('image')) return <ImageIcon size={16} />;
  return <Paperclip size={16} />;
}

function ImageLightbox({
  attachments,
  initialIndex,
  onClose,
}: {
  attachments: Attachment[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const current = attachments[idx];
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center" onClick={(e) => e.stopPropagation()}>
        {/* Top bar */}
        <div className="mb-3 flex w-full items-center justify-between">
          <span className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur">
            {current.original_name}
          </span>
          <div className="flex items-center gap-2">
            <a
              href={attachmentUrl(current.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
              title="Download"
            >
              <Download size={16} />
            </a>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Image */}
        <img
          src={attachmentUrl(current.id, true)}
          alt={current.original_name}
          className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
        />

        {/* Navigation */}
        {attachments.length > 1 && (
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
              disabled={idx === 0}
              onClick={() => setIdx((i) => i - 1)}
            >
              <ChevronRight size={18} className="rotate-180" />
            </button>
            <span className="text-sm text-white/70">
              {idx + 1} / {attachments.length}
            </span>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
              disabled={idx === attachments.length - 1}
              onClick={() => setIdx((i) => i + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
