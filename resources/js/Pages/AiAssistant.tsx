import { Bot, Clock3, Loader2, MessageSquarePlus, Send, Sparkles, Square, UserRound } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '../Layouts/AppLayout';

type Faq = { id: number; question: string; answer: string };
type RecentChat = { id: number; prompt: string; response: string; created_at: string };
type Props = {
  faqs: Faq[];
  recentChats: RecentChat[];
};
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export default function AiAssistant({ faqs, recentChats }: Props) {
  const initialMessages = useMemo(() => chatsToMessages(recentChats.slice().reverse()), [recentChats]);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamError, setStreamError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function sendPrompt(e?: React.FormEvent) {
    e?.preventDefault();
    const nextPrompt = prompt.trim();

    if (!nextPrompt || loading) return;

    const userMessage = makeMessage('user', nextPrompt);
    const assistantMessage = makeMessage('assistant', '');
    const history = messages.slice(-18).map((message) => ({ role: message.role, content: message.content }));

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setPrompt('');
    setStreamError('');
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/ai-help/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
        },
        body: JSON.stringify({ prompt: nextPrompt, messages: history }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const fallback = await response.json().catch(() => null);
        throw new Error(fallback?.message ?? 'The AI service is unavailable.');
      }

      await readStream(response.body, (event) => {
        const token = event.token;

        if (token) {
          setMessages((current) => appendToken(current, assistantMessage.id, token));
        }

        if (event.error) {
          setStreamError(event.error);
        }
      });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        const message = error instanceof Error ? error.message : 'The AI service is unavailable.';
        setStreamError(message);
        setMessages((current) => appendToken(current, assistantMessage.id, `I could not complete that request. ${message}`));
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }

  function startNewChat() {
    stopStreaming();
    setMessages([]);
    setPrompt('');
    setStreamError('');
  }

  function loadRecentChat(chat: RecentChat) {
    stopStreaming();
    setMessages(chatsToMessages([chat]));
    setPrompt('');
    setStreamError('');
  }

  const hasMessages = messages.length > 0;

  return (
    <AppLayout>
      <div className="grid h-[calc(100vh-9.5rem)] min-h-[620px] gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-700 text-white">
                <Bot size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-950">AI Chatbot</h2>
                <p className="text-xs text-slate-500">Powered by Gemini 3.1 Flash Lite</p>
              </div>
            </div>
            <button
              className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              type="button"
              onClick={startNewChat}
            >
              <MessageSquarePlus size={16} /> New chat
            </button>
          </div>

          <div ref={transcriptRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            {!hasMessages ? (
              <div className="mx-auto flex h-full max-w-3xl flex-col justify-center">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <Sparkles size={18} /> Employee leave assistant
                </div>
                <h3 className="mt-3 text-2xl font-semibold text-slate-950">Ask about policies, balances, approvals, or holidays.</h3>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {suggestedPrompts.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="rounded-md border border-slate-200 p-3 text-left text-sm text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                      type="button"
                      onClick={() => setPrompt(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-4xl space-y-5">
                {messages.map((message) => (
                  <ChatBubble key={message.id} message={message} loading={loading && message.role === 'assistant' && message.content === ''} />
                ))}
              </div>
            )}
          </div>

          {streamError && <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">{streamError}</div>}

          <form onSubmit={sendPrompt} className="border-t border-slate-200 bg-slate-50 p-4">
            <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-md border border-slate-300 bg-white p-2 shadow-sm focus-within:border-emerald-500">
              <textarea
                className="max-h-40 min-h-12 flex-1 resize-none border-0 px-2 py-2 text-sm text-slate-900 outline-none"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendPrompt();
                  }
                }}
                placeholder="Message the AI chatbot"
                rows={1}
              />
              {loading ? (
                <button
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white hover:bg-slate-800"
                  type="button"
                  aria-label="Stop streaming"
                  onClick={stopStreaming}
                >
                  <Square size={16} />
                </button>
              ) : (
                <button
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  type="submit"
                  aria-label="Send message"
                  disabled={!prompt.trim()}
                >
                  <Send size={17} />
                </button>
              )}
            </div>
          </form>
        </section>

        <aside className="flex min-h-0 flex-col gap-4">
          <section className="min-h-0 flex-1 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950">
              <Clock3 size={18} /> History
            </div>
            <div className="max-h-[calc(100vh-16rem)] space-y-2 overflow-y-auto pr-1">
              {recentChats.map((chat) => (
                <button
                  key={chat.id}
                  className="block w-full rounded-md border border-transparent bg-slate-50 p-3 text-left text-sm hover:border-emerald-200 hover:bg-emerald-50"
                  type="button"
                  onClick={() => loadRecentChat(chat)}
                >
                  <div className="line-clamp-2 font-medium text-slate-950">{chat.prompt}</div>
                  <div className="mt-1 line-clamp-2 text-slate-600">{chat.response}</div>
                  <div className="mt-2 text-xs text-slate-400">{formatDate(chat.created_at)}</div>
                </button>
              ))}
              {recentChats.length === 0 && <p className="text-sm text-slate-500">No saved chats yet.</p>}
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950">
              <Sparkles size={18} /> Policy FAQ
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {faqs.slice(0, 5).map((faq) => (
                <details key={faq.id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <summary className="cursor-pointer font-medium text-slate-950">{faq.question}</summary>
                  <p className="mt-2 text-slate-600">{faq.answer}</p>
                </details>
              ))}
              {faqs.length === 0 && <p className="text-sm text-slate-500">No FAQ entries are active yet.</p>}
            </div>
          </section>
        </aside>
      </div>
    </AppLayout>
  );
}

function ChatBubble({ message, loading }: { message: ChatMessage; loading: boolean }) {
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`flex gap-3 ${isAssistant ? '' : 'justify-end'}`}>
      {isAssistant && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white">
          <Bot size={17} />
        </div>
      )}
      <div className={`max-w-[min(46rem,85%)] rounded-md px-4 py-3 text-sm leading-6 ${isAssistant ? 'bg-slate-100 text-slate-800' : 'bg-slate-900 text-white'}`}>
        {loading ? (
          <span className="flex items-center gap-2 text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Thinking
          </span>
        ) : (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        )}
      </div>
      {!isAssistant && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-200 text-slate-700">
          <UserRound size={17} />
        </div>
      )}
    </div>
  );
}

async function readStream(body: ReadableStream<Uint8Array>, onEvent: (event: { token?: string; error?: string; done?: boolean }) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const dataLine = part.split('\n').find((line) => line.startsWith('data:'));

      if (!dataLine) continue;

      const event = JSON.parse(dataLine.slice(5).trim());
      onEvent(event);
    }
  }
}

function appendToken(messages: ChatMessage[], id: string, token: string) {
  return messages.map((message) => (message.id === id ? { ...message, content: message.content + token } : message));
}

function chatsToMessages(chats: RecentChat[]): ChatMessage[] {
  return chats.flatMap((chat) => [
    makeMessage('user', chat.prompt, chat.created_at),
    makeMessage('assistant', chat.response, chat.created_at),
  ]);
}

function makeMessage(role: ChatMessage['role'], content: string, createdAt = new Date().toISOString()): ChatMessage {
  return {
    id: `${role}-${createdAt}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    createdAt,
  };
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const suggestedPrompts = [
  'How much annual leave can I use this month?',
  'What happens after I submit a leave request?',
  'Which leave types require an attachment?',
  'Show me how managers approve or reject a request.',
];
