import React, { useEffect, useState } from "react";
import { fetchApi, ApiError } from "../../api/client.js";
import { Button } from "../../components/ui/Button.js";
import { Badge } from "../../components/ui/Badge.js";
import { Bot, User, Send, TicketCheck } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  ticketId?: number;
}

interface SupportTicket {
  id: number;
  number: string;
  status: string;
  subject: string;
  source?: string;
  created_at?: string;
  createdAt?: string;
}
export function CustomerSupportPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial",
      role: "assistant",
      content:
        "Hello! I am Brightloop's virtual assistant. You can ask me about your outstanding balance, upcoming billing date, invoice breakdowns, or request to open a support ticket for our operations team.",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [sessionId, setSessionId] = useState<number | undefined>(undefined);
  const [isSending, setIsSending] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    fetchApi<SupportTicket[] | { data: SupportTicket[] }>("/support/tickets")
      .then((res) => {
        const list = Array.isArray(res)
          ? res
          : res && typeof res === "object" && "data" in res && Array.isArray(res.data)
            ? res.data
            : [];
        setTickets(list);
      })
      .catch((e: unknown) => console.error("Error loading tickets", e));
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending) return;

    const userText = inputMessage.trim();
    setInputMessage("");

    const newMsg: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      content: userText,
    };

    setMessages((prev) => [...prev, newMsg]);
    setIsSending(true);

    try {
      const res = await fetchApi<{
        sessionId?: number;
        role?: "assistant";
        content?: string;
        intent?: string;
        ticketId?: number;
        data?: {
          sessionId: number;
          role: "assistant";
          content: string;
          intent: string;
          ticketId?: number;
        };
      }>("/support/chat", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          message: userText,
        }),
      });

      const payload =
        res && typeof res === "object" && "data" in res && res.data
          ? res.data
          : res;

      if (payload?.sessionId) {
        setSessionId(payload.sessionId);
      }

      const botMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: payload?.content || "Thank you for reaching out. Your request has been recorded.",
        intent: payload?.intent,
        ticketId: payload?.ticketId,
      };
      setMessages((prev) => [...prev, botMsg]);

      // If a ticket was escalated, refresh tickets
      if (payload?.ticketId) {
        fetchApi<SupportTicket[] | { data: SupportTicket[] }>("/support/tickets").then((r) => {
          const list = Array.isArray(r)
            ? r
            : r && typeof r === "object" && "data" in r && Array.isArray(r.data)
              ? r.data
              : [];
          setTickets(list);
        });
      }
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: "assistant",
          content: "Sorry, I encountered an issue processing your request. Please try again or open a ticket directly.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Chatbot Column */}
      <div className="lg:col-span-2 bg-surface-card border border-border-default rounded-xl shadow-sm flex flex-col h-[650px] overflow-hidden">
        {/* Chat header */}
        <div className="p-4 bg-brand-creamDeep border-b border-border-default flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-forest text-text-inverse flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-text-primary text-sm">
                Brightloop AI Assistant
              </div>
              <div className="text-xs text-text-secondary flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-semantic-success inline-block"></span>
                Active on-premise policy engine
              </div>
            </div>
          </div>
          <div className="text-xs text-text-secondary font-mono">
            {sessionId ? `Session #${sessionId}` : "New Session"}
          </div>
        </div>

        {/* Message history */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-brand-cream/20">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${
                m.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                  m.role === "user"
                    ? "bg-brand-taupe text-brand-forest"
                    : "bg-brand-forest text-text-inverse"
                }`}
              >
                {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-brand-forest text-text-inverse rounded-tr-none"
                    : "bg-surface-card border border-border-default text-text-primary rounded-tl-none shadow-sm whitespace-pre-wrap"
                }`}
              >
                {m.content}
                {m.ticketId && (
                  <div className="mt-2.5 pt-2 border-t border-border-subtle flex items-center gap-1.5 text-xs text-brand-forest font-semibold">
                    <TicketCheck className="w-4 h-4 text-semantic-success" />
                    <span>Ticket #{m.ticketId} escalated to support inbox</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex items-center gap-2 text-text-secondary text-xs italic">
              <Bot className="w-4 h-4 animate-spin text-brand-forest" />
              Thinking...
            </div>
          )}
        </div>

        {/* Preset prompts */}
        <div className="p-2.5 bg-brand-creamDeep/50 border-t border-border-default flex gap-2 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setInputMessage("What is my current balance?")}
            className="px-2.5 py-1 bg-surface-card border border-border-default rounded-full text-text-secondary hover:text-text-primary hover:border-brand-forest whitespace-nowrap transition"
          >
            💳 What is my balance?
          </button>
          <button
            type="button"
            onClick={() => setInputMessage("When is my next billing date?")}
            className="px-2.5 py-1 bg-surface-card border border-border-default rounded-full text-text-secondary hover:text-text-primary hover:border-brand-forest whitespace-nowrap transition"
          >
            📅 Next billing date?
          </button>
          <button
            type="button"
            onClick={() => setInputMessage("Can I pause my subscription?")}
            className="px-2.5 py-1 bg-surface-card border border-border-default rounded-full text-text-secondary hover:text-text-primary hover:border-brand-forest whitespace-nowrap transition"
          >
            ⏸ Pause policy?
          </button>
          <button
            type="button"
            onClick={() => setInputMessage("I want to speak with a human representative")}
            className="px-2.5 py-1 bg-surface-card border border-border-default rounded-full text-text-secondary hover:text-text-primary hover:border-brand-forest whitespace-nowrap transition"
          >
            🎫 Open a ticket
          </button>
        </div>

        {/* Input box */}
        <form onSubmit={handleSendMessage} className="p-3 bg-surface-card border-t border-border-default flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message or question..."
            className="flex-1 px-3.5 py-2 text-sm bg-brand-cream/30 border border-border-default rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-forest text-text-primary placeholder:text-text-muted"
          />
          <Button variant="primary" type="submit" isLoading={isSending} disabled={!inputMessage.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>

      {/* Support Tickets Column */}
      <div className="space-y-4">
        <div className="bg-surface-card border border-border-default rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold text-text-primary">
              Your Support Tickets
            </h2>
            <Badge variant="info">{tickets.length}</Badge>
          </div>
          <p className="text-xs text-text-secondary">
            Tickets opened automatically via chat or escalated to internal staff operations.
          </p>

          {tickets.length === 0 ? (
            <div className="text-center py-8 text-xs text-text-secondary">
              No tickets opened yet.
            </div>
          ) : (
            <div className="divide-y divide-border-default max-h-[480px] overflow-y-auto">
              {tickets.map((t) => (
                <div key={t.id} className="py-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-brand-forest">
                      {t.number}
                    </span>
                    <Badge variant={t.status === "closed" ? "draft" : "active"}>
                      {t.status}
                    </Badge>
                  </div>
                  <div className="font-medium text-text-primary line-clamp-1">
                    {t.subject}
                  </div>
                  <div className="text-[11px] text-text-secondary">
                    {t.created_at || t.createdAt ? new Date((t.created_at || t.createdAt) as string).toLocaleDateString() : "—"} via {t.source || "web"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
