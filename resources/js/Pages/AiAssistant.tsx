import { Link } from '@inertiajs/react';
import { ArrowRight, Bot, CalendarPlus, Clock3, CornerDownLeft, HelpCircle, Loader2, MessageSquarePlus, Send, Sparkles, Square, UserRound } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import AppLayout from '../Layouts/AppLayout';

type Faq = { id: number; question: string; answer: string };
type RecentChatMessage = { prompt: string; response: string; created_at: string };
type RecentChat = { id: string; prompt: string; response: string; created_at: string; messages: RecentChatMessage[] };
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
type LeaveDraft = {
  leave_type: string;
  starts_at: string;
  ends_at: string;
  duration: 'full_day' | 'half_day';
  reason: string;
};

const DEFAULT_MAX_CHAT_TURNS = 15;
const MAX_CHAT_TURNS = parseChatTurnLimit(import.meta.env.VITE_AI_CHAT_THREAD_LIMIT);

export default function AiAssistant({ faqs, recentChats }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatHistory, setChatHistory] = useState(recentChats);
  const [conversationId, setConversationId] = useState<string>(() => makeConversationId());
  const [externalPrompt, setExternalPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamError, setStreamError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'history' | 'faq'>('chat');
  const [leaveDraft, setLeaveDraft] = useState<LeaveDraft | null>(null);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => setChatHistory(recentChats), [recentChats]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function sendPrompt(text: string) {
    const nextPrompt = text.trim();

    if (!nextPrompt || loading || isThreadLimitReached) return;

    const currentConversationId = conversationId;
    const userMessage = makeMessage('user', nextPrompt);
    const assistantMessage = makeMessage('assistant', '');
    const history = messages.slice(-18).map((message) => ({ role: message.role, content: message.content }));
    let responseIntent = 'general';
    let assistantText = '';
    let fakeStreamQueue = Promise.resolve();

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setStreamError('');
    setLoading(true);
    setLeaveDraft(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/ai-help/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
        },
        body: JSON.stringify({ prompt: nextPrompt, conversation_id: currentConversationId, messages: history }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const fallback = await response.json().catch(() => null);
        throw new Error(fallback?.message ?? 'The AI service is unavailable.');
      }

      await readStream(response.body, (event) => {
        const token = event.token;

        if (token) {
          assistantText += token;
          if (responseIntent === 'leave_draft') {
            setMessages((current) => appendToken(current, assistantMessage.id, token));
          } else {
            fakeStreamQueue = fakeStreamQueue.then(() =>
              appendFakeStreamText(assistantMessage.id, token, controller.signal, (chunk) => {
                setMessages((current) => appendToken(current, assistantMessage.id, chunk));
              }),
            );
          }
        }

        if (event.intent) {
          responseIntent = event.intent;
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
      await fakeStreamQueue.catch(() => undefined);
      if (responseIntent === 'leave_draft' && assistantText.trim()) {
        setLeaveDraft(parseLeaveDraftResponse(assistantText));
      }
      if (assistantText.trim() && !controller.signal.aborted) {
        updateRecentChat(currentConversationId, {
          prompt: nextPrompt,
          response: assistantText,
          created_at: new Date().toISOString(),
        });
      }
      abortRef.current = null;
      setLoading(false);
    }
  }

  function updateRecentChat(id: string, message: RecentChatMessage) {
    setChatHistory((current) => {
      const existing = current.find((chat) => chat.id === id);
      const nextChat: RecentChat = {
        id,
        prompt: message.prompt,
        response: message.response,
        created_at: message.created_at,
        messages: existing ? [...existing.messages, message] : [message],
      };

      return [nextChat, ...current.filter((chat) => chat.id !== id)].slice(0, 8);
    });
  }

  function stopStreaming() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }

  function startNewChat() {
    stopStreaming();
    setConversationId(makeConversationId());
    setMessages([]);
    setExternalPrompt('');
    setStreamError('');
    setLeaveDraft(null);
  }

  function loadRecentChat(chat: RecentChat) {
    stopStreaming();
    setConversationId(isUuid(chat.id) ? chat.id : makeConversationId());
    setMessages(chatsToMessages(chat.messages));
    setExternalPrompt('');
    setStreamError('');
    setActiveTab('chat');
  }

  const hasMessages = messages.length > 0;
  const chatTurnCount = messages.filter((message) => message.role === 'user').length;
  const isThreadLimitReached = chatTurnCount >= MAX_CHAT_TURNS;

  return (
    <AppLayout fullHeight>
      <div className="flex flex-col h-full px-4 py-4 sm:px-6">
        {/* Mobile Tab Bar (iOS style Segmented Control) */}
        <div className="flex bg-neutral-100/80 p-1 lg:hidden mb-4 rounded-xl border border-neutral-200/40 shadow-premium-sm">
          {(['chat', 'history', 'faq'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-medium capitalize tracking-wide transition-all duration-200 rounded-lg cursor-pointer ${
                activeTab === tab
                  ? 'bg-white text-orange-800 shadow-premium-sm border border-neutral-200'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_22rem] flex-1 min-h-0">
          {/* Main Chat Interface */}
          <section className={`min-h-0 flex-col overflow-hidden border border-neutral-200/50 bg-white rounded-xl shadow-premium-sm ${
            activeTab === 'chat' ? 'flex h-[calc(100svh-14rem)]' : 'hidden'
          } lg:flex lg:h-full`}>
            {/* Chat Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50/20 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center border border-orange-100 bg-orange-50 text-orange-700 rounded-lg shadow-premium-sm">
                  <Bot size={18} />
                  <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500 border border-white"></span>
                  </span>
                </div>
                <div>
                  <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">ELMS Copilot</h2>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 mt-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500"></span>
                    <span>Gemini 3.5 flash Â· Ready</span>
                  </div>
                </div>
              </div>
              <button
                className="group flex h-10 items-center gap-2 border border-neutral-200 bg-white px-4.5 text-sm font-medium tracking-wide text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 active:scale-98 transition-all duration-200 rounded-lg shadow-premium-sm cursor-pointer"
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
                    <div className="inline-flex h-12 w-12 items-center justify-center border border-orange-100 bg-orange-50/50 text-orange-600 mb-4 rounded-lg shadow-premium-sm">
                      <Sparkles size={18} />
                    </div>
                    <h3 className="text-xl font-medium tracking-tight text-neutral-800">
                      How can I assist you today?
                    </h3>
                    <p className="mt-2.5 text-sm font-medium text-neutral-500 max-w-md mx-auto leading-relaxed">
                      Ask me questions about company leave policies, current leave balances, approval workflows, or upcoming public holidays.
                    </p>
                  </div>

                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    {suggestedPrompts.map((suggestion) => (
                      <button
                        key={suggestion}
                        className="group flex items-center justify-between border border-neutral-200 bg-white p-4.5 text-left text-sm font-medium text-neutral-655 hover:border-orange-300 hover:bg-orange-50/5 active:scale-[0.99] transition-all rounded-lg shadow-premium-sm cursor-pointer"
                        type="button"
                        onClick={() => setExternalPrompt(suggestion)}
                      >
                        <span className="pr-4 font-medium text-neutral-800 group-hover:text-orange-950">{suggestion}</span>
                        <ArrowRight size={14} className="shrink-0 text-neutral-400 opacity-0 group-hover:opacity-100 group-hover:text-orange-600 group-hover:translate-x-0.5 transition-all duration-200" />
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
              <div className="border-t border-rose-100 bg-rose-50 px-6 py-3 text-sm font-semibold text-rose-700 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-600 shrink-0"></span>
                {streamError}
              </div>
            )}

            {/* Input Form */}
            {isThreadLimitReached && !loading ? (
              <div className="border-t border-neutral-100 bg-white p-4">
                <div className="mx-auto flex max-w-3xl flex-col gap-4 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium leading-relaxed text-neutral-600">
                    This conversation has reached its {MAX_CHAT_TURNS}-question limit. Start a new conversation to keep responses focused and easier to follow.
                  </p>
                  <button
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-premium-sm transition-all hover:bg-orange-700 active:scale-98 cursor-pointer"
                    type="button"
                    onClick={startNewChat}
                  >
                    <MessageSquarePlus size={14} />
                    Start New Conversation
                  </button>
                </div>
              </div>
            ) : (
              <ChatInput
                onSubmit={sendPrompt}
                loading={loading}
                onStop={stopStreaming}
                externalPrompt={externalPrompt}
                onExternalPromptConsumed={() => setExternalPrompt('')}
              />
            )}
          </section>

          {/* Sidebar panels */}
          <aside className={`min-h-0 flex-col gap-4 lg:flex ${
            activeTab !== 'chat' ? 'flex h-[calc(100svh-14rem)]' : 'hidden'
          }`}>
            {/* History Panel */}
            {leaveDraft && (
              <section className="border border-orange-100 bg-orange-50/50 p-5 rounded-xl shadow-premium-sm">
                <div className="mb-4 flex items-center gap-2 border-b border-orange-100/70 pb-3">
                  <CalendarPlus size={15} className="text-orange-700" />
                  <h2 className="text-sm font-medium uppercase tracking-wider text-orange-800">Leave Draft Ready</h2>
                </div>
                <div className="space-y-3.5 text-sm font-medium text-orange-900">
                  <div className="rounded-lg border border-orange-100 bg-white/80 p-3.5 shadow-premium-sm">
                    <div className="text-xs font-medium uppercase tracking-wider text-orange-700">Type</div>
                    <div className="mt-1 font-medium">{leaveDraft.leave_type || 'Review in form'}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-orange-100 bg-white/80 p-3.5 shadow-premium-sm">
                      <div className="text-xs font-medium uppercase tracking-wider text-orange-700">Start</div>
                      <div className="mt-1 font-medium">{leaveDraft.starts_at || 'Choose'}</div>
                    </div>
                    <div className="rounded-lg border border-orange-100 bg-white/80 p-3.5 shadow-premium-sm">
                      <div className="text-xs font-medium uppercase tracking-wider text-orange-700">End</div>
                      <div className="mt-1 font-medium">{leaveDraft.ends_at || 'Choose'}</div>
                    </div>
                  </div>
                  {leaveDraft.reason && (
                    <div className="rounded-lg border border-orange-100 bg-white/80 p-3.5 shadow-premium-sm">
                      <div className="text-xs font-medium uppercase tracking-wider text-orange-700">Application note</div>
                      <div className="mt-1.5 text-sm leading-relaxed text-orange-950">{leaveDraft.reason}</div>
                    </div>
                  )}
                  <Link
                    href={leaveDraftUrl(leaveDraft)}
                    className="flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-3.5 text-sm font-medium text-white shadow-md shadow-orange-600/10 transition-all hover:bg-orange-700 active:scale-98"
                  >
                    Autofill Application <ArrowRight size={13} />
                  </Link>
                </div>
              </section>
            )}

            {/* History Panel */}
            <section className={`min-h-0 flex-1 flex-col border border-neutral-200/50 bg-white p-5 rounded-xl shadow-premium-sm ${
              activeTab === 'history' ? 'flex h-full' : 'hidden lg:flex'
            }`}>
              <div className="mb-4 flex items-center gap-2 border-b border-neutral-200 pb-3">
                <Clock3 size={15} className="text-neutral-400" />
                <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">Recent Chats</h2>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {chatHistory.map((chat) => (
                  <button
                    key={chat.id}
                    className="group block w-full border border-neutral-200/70 bg-neutral-50/20 p-4 text-left hover:border-orange-300 hover:bg-orange-50/5 active:scale-[0.99] transition-all rounded-lg shadow-premium-sm cursor-pointer"
                    type="button"
                    onClick={() => loadRecentChat(chat)}
                  >
                    <div className="line-clamp-1 text-sm font-medium text-neutral-800 group-hover:text-orange-800 transition-colors">
                      {chat.prompt}
                    </div>
                    <div className="mt-1.5 line-clamp-2 text-sm text-neutral-500 font-medium leading-relaxed">
                      {chat.response}
                    </div>
                    <div className="mt-3 text-xs font-medium uppercase tracking-wider text-neutral-400">
                      {formatDate(chat.created_at)}
                    </div>
                  </button>
                ))}
                {chatHistory.length === 0 && (
                  <div className="flex h-32 flex-col items-center justify-center text-center">
                    <p className="text-sm text-neutral-400 font-medium">No saved chats yet.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Policy FAQ Panel */}
            <section className={`border border-neutral-200/50 bg-white p-5 rounded-xl shadow-premium-sm ${
              activeTab === 'faq' ? 'flex flex-col h-full overflow-y-auto' : 'hidden lg:block'
            }`}>
              <div className="mb-4 flex items-center gap-2 border-b border-neutral-200 pb-3">
                <HelpCircle size={15} className="text-neutral-400" />
                <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">Quick Policy FAQ</h2>
              </div>
              <div className="max-h-64 lg:max-h-none lg:overflow-y-auto space-y-3 pr-1">
                {faqs.slice(0, 5).map((faq) => (
                  <details key={faq.id} className="group border border-neutral-200/60 p-4 text-sm bg-neutral-50/30 hover:bg-neutral-50/80 transition-all rounded-lg shadow-premium-sm cursor-pointer">
                    <summary className="flex cursor-pointer items-center justify-between font-medium text-neutral-800 outline-none select-none">
                      <span className="pr-2">{faq.question}</span>
                      <span className="ml-2 text-neutral-400 group-open:rotate-180 transition-transform duration-200">
                        â–¼
                      </span>
                    </summary>
                    <p className="mt-3 leading-relaxed text-neutral-500 font-medium group-open:animate-fade-in">
                      {faq.answer}
                    </p>
                  </details>
                ))}
                {faqs.length === 0 && (
                  <p className="text-sm text-neutral-400 font-medium text-center py-4">No active FAQ entries.</p>
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
  const draft = isAssistant && !loading ? draftFromAssistantMessage(message.content) : null;

  return (
    <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} animate-fade-in`}>
      <div className={`max-w-[85%] border px-5 py-4 text-sm leading-relaxed ${
        isAssistant 
          ? 'bg-neutral-50/60 text-neutral-600 border-neutral-200/50 rounded-lg font-medium shadow-premium-sm' 
          : 'bg-orange-50 text-orange-800 border-orange-100/40 rounded-lg font-medium shadow-premium-sm'
      }`}>
        {loading ? (
          <span className="flex items-center gap-2 text-sm font-medium text-neutral-500">
            <Loader2 size={13} className="animate-spin text-orange-600" /> 
            Thinking...
          </span>
        ) : draft ? (
          <LeaveDraftMessage draft={draft} />
        ) : (
          <div className="whitespace-normal break-words markdown-prose">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

interface ChatInputProps {
  onSubmit: (text: string) => void;
  loading: boolean;
  onStop: () => void;
  externalPrompt: string;
  onExternalPromptConsumed: () => void;
}

function ChatInput({ onSubmit, loading, onStop, externalPrompt, onExternalPromptConsumed }: ChatInputProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (externalPrompt) {
      setValue(externalPrompt);
      onExternalPromptConsumed();
    }
  }, [externalPrompt, onExternalPromptConsumed]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!value.trim() || loading) return;
    onSubmit(value.trim());
    setValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-neutral-100 bg-white p-4">
      <div className="mx-auto flex max-w-3xl items-end gap-3 border border-neutral-200 bg-neutral-50/50 p-2 focus-within:border-orange-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-500/5 transition-all duration-200 rounded-xl shadow-premium-sm">
        <textarea
          className="max-h-32 min-h-10 focus:border-0! focus:ring-0! focus:shadow-none! flex-1 resize-none border-0 border-transparent! bg-transparent px-3 py-2.5 text-sm text-neutral-800 placeholder-neutral-400 outline-none"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Ask ELMS Copilot anything..."
          rows={1}
        />
        <div className="flex items-center gap-2 pr-1 pb-1">
          {loading ? (
            <button
              className="flex h-9 w-9 shrink-0 items-center justify-center bg-rose-600 text-white hover:bg-rose-700 transition-colors rounded-lg shadow-premium-sm cursor-pointer active:scale-95"
              type="button"
              aria-label="Stop streaming"
              onClick={onStop}
            >
              <Square size={12} fill="white" />
            </button>
          ) : (
            <button
              className="flex h-9 w-9 shrink-0 items-center justify-center bg-orange-600 text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 transition-all rounded-lg shadow-premium-sm cursor-pointer active:scale-95"
              type="submit"
              aria-label="Send message"
              disabled={!value.trim()}
            >
              <Send size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-3xl mt-2.5 flex items-center justify-between px-2 text-xs font-normal uppercase tracking-wider text-neutral-500">
        <span>Use Shift + Enter for new lines</span>
        <span className="flex items-center gap-1">
          <CornerDownLeft size={10} /> Enter to send
        </span>
      </div>
    </form>
  );
}

function LeaveDraftMessage({ draft }: { draft: LeaveDraft }) {
  return (
    <div className="w-full min-w-[min(26rem,70vw)] space-y-4">
      <div className="flex items-center gap-3 border-b border-orange-100 pb-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-orange-100 bg-white text-orange-700 shadow-premium-sm">
          <CalendarPlus size={16} />
        </div>
        <div>
          <div className="text-sm font-medium text-neutral-900">Leave draft ready</div>
          <div className="text-xs font-medium text-neutral-500">Review before filling the application form.</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <DraftField label="Type" value={draft.leave_type || 'Review in form'} />
        <DraftField label="Start" value={draft.starts_at || 'Choose'} />
        <DraftField label="End" value={draft.ends_at || 'Choose'} />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-3.5 shadow-premium-sm">
        <div className="text-xs font-medium uppercase tracking-wider text-neutral-400">Application note</div>
        <div className="mt-1.5 text-sm font-medium leading-relaxed text-neutral-700">
          {draft.reason || 'No note generated yet.'}
        </div>
      </div>

      <Link
        href={leaveDraftUrl(draft)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-3.5 text-sm font-medium text-white shadow-md shadow-orange-600/10 transition-all hover:bg-orange-700 active:scale-98"
      >
        Autofill Application <ArrowRight size={13} />
      </Link>
    </div>
  );
}

interface DraftFieldProps {
  label: string;
  value: string;
}

function DraftField({ label, value }: DraftFieldProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3.5 shadow-premium-sm">
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-400">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-neutral-800" title={value}>
        {value}
      </div>
    </div>
  );
}

async function readStream(body: ReadableStream<Uint8Array>, onEvent: (event: { token?: string; intent?: string; error?: string; done?: boolean }) => void) {
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

async function appendFakeStreamText(id: string, text: string, signal: AbortSignal, append: (chunk: string) => void) {
  for (const chunk of fakeStreamChunks(text)) {
    if (signal.aborted) throw new DOMException('Streaming stopped', 'AbortError');

    append(chunk);
    await sleep(fakeStreamDelay(chunk), signal);
  }
}

function fakeStreamChunks(text: string) {
  const chunks = text.match(/\s+|[^\s]+/g) ?? [];
  const grouped: string[] = [];
  let buffer = '';

  for (const chunk of chunks) {
    buffer += chunk;

    if (buffer.length >= 14 || /[.!?]\s$/.test(buffer) || /\n$/.test(buffer)) {
      grouped.push(buffer);
      buffer = '';
    }
  }

  if (buffer) grouped.push(buffer);

  return grouped;
}

function fakeStreamDelay(chunk: string) {
  if (/\n$/.test(chunk)) return 90;
  if (/[.!?]\s$/.test(chunk)) return 120;

  return Math.min(85, Math.max(24, chunk.length * 8));
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Streaming stopped', 'AbortError'));
      return;
    }

    const timeout = window.setTimeout(resolve, ms);

    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException('Streaming stopped', 'AbortError'));
      },
      { once: true },
    );
  });
}

// Map chats to messages utility
function chatsToMessages(chats: RecentChatMessage[]): ChatMessage[] {
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

function makeConversationId() {
  return crypto.randomUUID();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseChatTurnLimit(value: string | undefined) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CHAT_TURNS;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const suggestedPrompts = [
  'Draft annual leave for May 25 to May 28 for family travel.',
  'How much annual leave can I use this month?',
  'What happens after I submit a leave request?',
  'Which leave types require an attachment?',
  'Show me how managers approve or reject a request.',
];

function parseLeaveDraftResponse(response: string): LeaveDraft {
  return {
    leave_type: valueAfterLabel(response, 'Leave type'),
    starts_at: normalizeDraftDate(valueAfterLabel(response, 'Start date')),
    ends_at: normalizeDraftDate(valueAfterLabel(response, 'End date')),
    duration: normalizeDuration(valueAfterLabel(response, 'Duration')),
    reason: applicationNoteFromResponse(response),
  };
}

function draftFromAssistantMessage(response: string): LeaveDraft | null {
  if (!/draft request ready|leave draft ready|application note:/i.test(response)) return null;

  const draft = parseLeaveDraftResponse(response);
  const hasDraftContent = Boolean(draft.leave_type || draft.starts_at || draft.ends_at || draft.reason);

  return hasDraftContent ? draft : null;
}

function valueAfterLabel(response: string, label: string) {
  const match = response.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
  const value = match?.[1]?.trim() ?? '';
  return /review in form|choose|unknown|n\/a/i.test(value) ? '' : value;
}

function normalizeDraftDate(value: string) {
  const match = value.match(/\b20\d{2}-\d{2}-\d{2}\b/);
  return match?.[0] ?? '';
}

function normalizeDuration(value: string): LeaveDraft['duration'] {
  return /half/i.test(value) ? 'half_day' : 'full_day';
}

function applicationNoteFromResponse(response: string) {
  const match = response.match(/application note:\s*([\s\S]*)/i);
  const note = match?.[1]?.trim() ?? '';

  return note
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[-*]\s*/gm, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

function leaveDraftUrl(draft: LeaveDraft) {
  const params = new URLSearchParams({ source: 'ai', duration: draft.duration, reason: draft.reason });

  if (draft.leave_type) params.set('leave_type', draft.leave_type);
  if (draft.starts_at) params.set('starts_at', draft.starts_at);
  if (draft.ends_at) params.set('ends_at', draft.ends_at);

  return `/apply-leave?${params.toString()}`;
}
