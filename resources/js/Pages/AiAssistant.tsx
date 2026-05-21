import { Bot, Clock3, Loader2, MessageSquarePlus, Send, Sparkles, Square, UserRound, HelpCircle, ArrowRight, CornerDownLeft } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
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
  const [activeTab, setActiveTab] = useState<'chat' | 'history' | 'faq'>('chat');

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
    setActiveTab('chat');
  }

  const hasMessages = messages.length > 0;

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Mobile Tab Bar (iOS style Segmented Control) */}
        <div className="flex bg-neutral-100/80 p-1 lg:hidden mb-4 rounded-2xl border border-neutral-200/40 shadow-premium-sm">
          {(['chat', 'history', 'faq'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-semibold capitalize tracking-wide transition-all duration-200 rounded-xl cursor-pointer ${
                activeTab === tab
                  ? 'bg-white text-emerald-800 shadow-premium-sm border border-neutral-200'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:h-[calc(100vh-9.5rem)] lg:min-h-[620px] flex-1 min-h-0">
          {/* Main Chat Interface */}
          <section className={`min-h-0 flex-col overflow-hidden border border-neutral-200/50 bg-white rounded-2xl shadow-premium-sm ${
            activeTab === 'chat' ? 'flex h-[calc(100vh-14.5rem)]' : 'hidden'
          } lg:flex lg:h-full`}>
            {/* Chat Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50/20 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center border border-emerald-100 bg-emerald-50 text-emerald-700 rounded-xl shadow-premium-sm">
                  <Bot size={18} />
                  <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 border border-white"></span>
                  </span>
                </div>
                <div>
                  <h2 className="text-[10px] font-semibold uppercase tracking-widest text-neutral-450">AI Assistant</h2>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    <span>Gemini 3.5 flash · Ready</span>
                  </div>
                </div>
              </div>
              <button
                className="group flex h-9 items-center gap-2 border border-neutral-200 bg-white px-3.5 text-xs font-semibold tracking-wide text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 active:scale-98 transition-all duration-200 rounded-xl shadow-premium-sm cursor-pointer"
                type="button"
                onClick={startNewChat}
              >
                <MessageSquarePlus size={14} className="text-neutral-400 transition-colors group-hover:text-neutral-900" /> 
                New Chat
              </button>
            </div>

            {/* Chat Scroll Area */}
            <div ref={transcriptRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-6 bg-neutral-50/10">
              {!hasMessages ? (
                <div className="mx-auto flex h-full max-w-2xl flex-col justify-center py-10">
                  <div className="text-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center border border-emerald-100 bg-emerald-50/50 text-emerald-600 mb-4 rounded-xl shadow-premium-sm">
                      <Sparkles size={18} />
                    </div>
                    <h3 className="text-xl font-semibold tracking-tight text-neutral-850">
                      How can I assist you today?
                    </h3>
                    <p className="mt-2 text-xs font-medium text-neutral-500 max-w-md mx-auto leading-relaxed">
                      Ask me questions about company leave policies, current leave balances, approval workflows, or upcoming public holidays.
                    </p>
                  </div>

                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {suggestedPrompts.map((suggestion) => (
                      <button
                        key={suggestion}
                        className="group flex items-center justify-between border border-neutral-200 bg-white p-4 text-left text-xs font-medium text-neutral-500 hover:border-emerald-300 hover:bg-emerald-50/5 active:scale-[0.99] transition-all rounded-xl shadow-premium-sm cursor-pointer"
                        type="button"
                        onClick={() => setPrompt(suggestion)}
                      >
                        <span className="pr-4 font-semibold text-neutral-800 group-hover:text-emerald-950">{suggestion}</span>
                        <ArrowRight size={14} className="shrink-0 text-neutral-400 opacity-0 group-hover:opacity-100 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all duration-200" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl space-y-6">
                  {messages.map((message) => (
                    <ChatBubble key={message.id} message={message} loading={loading && message.role === 'assistant' && message.content === ''} />
                  ))}
                </div>
              )}
            </div>

            {/* Stream Error Banner */}
            {streamError && (
              <div className="border-t border-rose-100 bg-rose-50 px-6 py-2.5 text-xs font-semibold text-rose-700 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-600 shrink-0"></span>
                {streamError}
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={sendPrompt} className="border-t border-neutral-100 bg-white p-4">
              <div className="mx-auto flex max-w-3xl items-end gap-3 border border-neutral-200 bg-neutral-50/50 p-2 focus-within:border-emerald-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-500/5 transition-all duration-200 rounded-2xl shadow-premium-sm">
                <textarea
                  className="max-h-32 min-h-10 focus:border-0! focus:ring-0! focus:shadow-none! flex-1 resize-none border-0 border-transparent! bg-transparent px-3 py-2.5 text-sm text-neutral-800 placeholder-neutral-400 outline-none"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendPrompt();
                    }
                  }}
                  placeholder="Ask ELMS assistant anything..."
                  rows={1}
                />
                <div className="flex items-center gap-2 pr-1 pb-1">
                  {loading ? (
                    <button
                      className="flex h-9 w-9 shrink-0 items-center justify-center bg-rose-600 text-white hover:bg-rose-700 transition-colors rounded-xl shadow-premium-sm cursor-pointer active:scale-95"
                      type="button"
                      aria-label="Stop streaming"
                      onClick={stopStreaming}
                    >
                      <Square size={12} fill="white" />
                    </button>
                  ) : (
                    <button
                      className="flex h-9 w-9 shrink-0 items-center justify-center bg-neutral-950 text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 transition-all rounded-xl shadow-premium-sm cursor-pointer active:scale-95"
                      type="submit"
                      aria-label="Send message"
                      disabled={!prompt.trim()}
                    >
                      <Send size={13} />
                    </button>
                  )}
                </div>
              </div>
              <div className="mx-auto max-w-3xl mt-2.5 flex items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                <span>Use Shift + Enter for new lines</span>
                <span className="flex items-center gap-1">
                  <CornerDownLeft size={10} /> Enter to send
                </span>
              </div>
            </form>
          </section>

          {/* Sidebar panels */}
          <aside className={`min-h-0 flex-col gap-6 lg:flex ${
            activeTab !== 'chat' ? 'flex h-[calc(100vh-14.5rem)]' : 'hidden'
          }`}>
            {/* History Panel */}
            <section className={`min-h-0 flex-1 flex-col border border-neutral-200/50 bg-white p-5 rounded-2xl shadow-premium-sm ${
              activeTab === 'history' ? 'flex h-full' : 'hidden lg:flex'
            }`}>
              <div className="mb-4 flex items-center gap-2 border-b border-neutral-200 pb-3">
                <Clock3 size={15} className="text-neutral-400" />
                <h2 className="text-[10px] font-semibold uppercase tracking-widest text-neutral-450">Recent Chats</h2>
              </div>
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
                {recentChats.map((chat) => (
                  <button
                    key={chat.id}
                    className="group block w-full border border-neutral-200/70 bg-neutral-50/20 p-3.5 text-left hover:border-emerald-300 hover:bg-emerald-50/5 active:scale-[0.99] transition-all rounded-xl shadow-premium-sm cursor-pointer"
                    type="button"
                    onClick={() => loadRecentChat(chat)}
                  >
                    <div className="line-clamp-1 text-xs font-semibold text-neutral-850 group-hover:text-emerald-800 transition-colors">
                      {chat.prompt}
                    </div>
                    <div className="mt-1.5 line-clamp-2 text-xs text-neutral-500 font-medium leading-relaxed">
                      {chat.response}
                    </div>
                    <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                      {formatDate(chat.created_at)}
                    </div>
                  </button>
                ))}
                {recentChats.length === 0 && (
                  <div className="flex h-32 flex-col items-center justify-center text-center">
                    <p className="text-xs text-neutral-400 font-semibold">No saved chats yet.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Policy FAQ Panel */}
            <section className={`border border-neutral-200/50 bg-white p-5 rounded-2xl shadow-premium-sm ${
              activeTab === 'faq' ? 'flex flex-col h-full overflow-y-auto' : 'hidden lg:block'
            }`}>
              <div className="mb-4 flex items-center gap-2 border-b border-neutral-200 pb-3">
                <HelpCircle size={15} className="text-neutral-400" />
                <h2 className="text-[10px] font-semibold uppercase tracking-widest text-neutral-450">Quick Policy FAQ</h2>
              </div>
              <div className="max-h-64 lg:max-h-none lg:overflow-y-auto space-y-2.5 pr-1">
                {faqs.slice(0, 5).map((faq) => (
                  <details key={faq.id} className="group border border-neutral-200/60 p-3.5 text-xs bg-neutral-50/30 hover:bg-neutral-50/80 transition-all rounded-xl shadow-premium-sm cursor-pointer">
                    <summary className="flex cursor-pointer items-center justify-between font-semibold text-neutral-800 outline-none select-none">
                      <span className="pr-2">{faq.question}</span>
                      <span className="ml-2 text-neutral-400 group-open:rotate-180 transition-transform duration-200">
                        ▼
                      </span>
                    </summary>
                    <p className="mt-2.5 leading-relaxed text-neutral-500 font-medium group-open:animate-fade-in">
                      {faq.answer}
                    </p>
                  </details>
                ))}
                {faqs.length === 0 && (
                  <p className="text-xs text-neutral-400 font-semibold text-center py-4">No active FAQ entries.</p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}

function ChatBubble({ message, loading }: { message: ChatMessage; loading: boolean }) {
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`flex gap-3.5 ${isAssistant ? '' : 'justify-end'} animate-fade-in`}>
      {isAssistant && (
        <div className="mt-0.5 flex h-8.5 w-8.5 shrink-0 items-center justify-center border border-emerald-100 bg-emerald-50 text-emerald-700 rounded-xl shadow-premium-sm">
          <Bot size={15} />
        </div>
      )}
      <div className={`max-w-[80%] border p-4 text-sm leading-relaxed ${
        isAssistant 
          ? 'bg-emerald-50/20 text-neutral-800 border-emerald-100/60 rounded-2xl rounded-tl-sm shadow-premium-sm' 
          : 'bg-neutral-900 text-white border-neutral-900 rounded-2xl rounded-tr-sm shadow-premium-sm'
      }`}>
        {loading ? (
          <span className="flex items-center gap-2 text-xs font-medium text-neutral-400">
            <Loader2 size={13} className="animate-spin text-emerald-600" /> 
            Thinking...
          </span>
        ) : (
          <div className="whitespace-normal break-words markdown-prose">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
      {!isAssistant && (
        <div className="mt-0.5 flex h-8.5 w-8.5 shrink-0 items-center justify-center border border-neutral-200 bg-neutral-50 text-neutral-700 rounded-xl shadow-premium-sm">
          <UserRound size={15} />
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

// Map chats to messages utility
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
