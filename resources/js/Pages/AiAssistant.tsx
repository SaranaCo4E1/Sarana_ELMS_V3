import { Bot, Clock3, Send, Sparkles } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import AppLayout from '../Layouts/AppLayout';

type Faq = { id: number; question: string; answer: string };
type RecentChat = { id: number; prompt: string; response: string; created_at: string };
type Props = {
  faqs: Faq[];
  recentChats: RecentChat[];
};

export default function AiAssistant({ faqs, recentChats }: Props) {
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  async function askFaq(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setAnswer('');
    const res = await fetch('/ai-help', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '' },
      body: JSON.stringify({ prompt }),
    });
    const json = await res.json();
    setAnswer(json.answer);
    setLoading(false);
  }

  return (
    <AppLayout>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Bot size={21} className="text-emerald-700" />
            <h2 className="font-semibold text-slate-950">AI Chatbot</h2>
          </div>
          <form onSubmit={askFaq} className="mt-5 flex gap-2">
            <input className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask about leave policy, balances, approvals, or holidays" />
            <button className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"><Send size={16} /> Ask</button>
          </form>
          {(loading || answer) && <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{loading ? 'Thinking...' : answer}</div>}
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2 font-semibold"><Sparkles size={18} /> Policy FAQ</div>
            <div className="space-y-2">
              {faqs.map((faq) => <details key={faq.id} className="rounded-md border border-slate-200 p-3 text-sm"><summary className="cursor-pointer font-medium text-slate-950">{faq.question}</summary><p className="mt-2 text-slate-600">{faq.answer}</p></details>)}
              {faqs.length === 0 && <p className="text-sm text-slate-500">No FAQ entries are active yet.</p>}
            </div>
          </div>
        </section>

        <aside className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 font-semibold"><Clock3 size={18} /> Recent Chats</div>
          <div className="space-y-3">
            {recentChats.map((chat) => (
              <div key={chat.id} className="rounded-md bg-slate-50 p-3 text-sm">
                <div className="font-medium text-slate-950">{chat.prompt}</div>
                <div className="mt-1 text-slate-600">{chat.response}</div>
                <div className="mt-2 text-xs text-slate-400">{formatDate(chat.created_at)}</div>
              </div>
            ))}
            {recentChats.length === 0 && <p className="text-sm text-slate-500">No chats yet.</p>}
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
