import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Send, MessageCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

const WHATSAPP_MARKER = '[WHATSAPP]';

const SupportChat: React.FC<{ clientId: string | null }> = ({ clientId }) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('support_chat_messages')
        .select('id, role, content, created_at')
        .order('created_at', { ascending: true })
        .limit(100);
      setMessages((data as ChatMessage[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  const whatsappUrl = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Vim do chat do painel AD SCALE e preciso de ajuda.')}`
    : null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);

    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const { data, error } = await supabase.functions.invoke('support-chat', {
        body: { message: text },
      });
      if (error) throw error;
      if (data?.whatsapp) setWhatsapp(data.whatsapp);
      const reply: string = (data?.reply ?? '').replace(WHATSAPP_MARKER, '').trim();
      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: reply || t('supportChat.errorGeneric'),
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {
      toast.error(t('supportChat.errorGeneric'));
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl border-glow overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
        <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Bot size={16} className="text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-sm font-semibold">{t('supportChat.title')}</h3>
          <p className="text-[11px] text-muted-foreground">{t('supportChat.subtitle')}</p>
        </div>
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 border border-emerald-400/30 bg-emerald-400/10 rounded-lg px-3 py-1.5 hover:brightness-110 transition-all"
          >
            <MessageCircle size={14} /> {t('supportChat.whatsappCta')}
          </a>
        )}
      </div>

      <div className="h-80 overflow-y-auto px-5 py-4 space-y-3">
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-8">{t('supportChat.loading')}</p>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <Bot size={28} className="text-primary/60 mx-auto" />
            <p className="text-sm text-foreground">{t('supportChat.emptyTitle')}</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">{t('supportChat.emptyDesc')}</p>
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-wrap'
                    : 'max-w-[80%] text-foreground rounded-2xl rounded-bl-md px-4 py-2.5 text-sm whitespace-pre-wrap border border-border/60'
                }
              >
                {m.content.replace(WHATSAPP_MARKER, '').trim()}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="text-muted-foreground text-xs px-4 py-2.5 border border-border/60 rounded-2xl rounded-bl-md animate-pulse">
              {t('supportChat.typing')}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex items-center gap-2 px-4 py-3 border-t border-border/60">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t('supportChat.placeholder')}
          maxLength={2000}
          disabled={sending}
          className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="bg-primary text-primary-foreground p-2.5 rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
          aria-label={t('supportChat.send')}
        >
          <Send size={16} />
        </button>
      </form>

      <p className="flex items-center gap-1.5 px-5 pb-3 text-[10px] text-muted-foreground/70">
        <AlertCircle size={11} /> {t('supportChat.disclaimer')}
      </p>
    </div>
  );
};

export default SupportChat;
