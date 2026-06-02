import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Sparkles, Send, Bot, User, RefreshCw } from "lucide-react";
import { Transaction, RecurringBill } from "../types";

interface PersonalAdvisorProps {
  transactions: Transaction[];
  bills: RecurringBill[];
  income: number;
  onAddAlert: (title: string, message: string, type: "warning" | "info" | "success") => void;
}

interface Message {
  sender: "user" | "bot";
  text: string;
  timestamp: Date;
}

export default function PersonalAdvisor({
  transactions,
  bills,
  income,
  onAddAlert,
}: PersonalAdvisorProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Hello! I am your AI Finance Assistant. I've analyzed your monthly cash-flow parameters. Ask me any question, suggest a category budget limit, or ask me to write a renegotiation script for subscriptions! E.g. 'How can I trim my Utilities?'",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const quickPrompts = [
    "Am I overspending on Food?",
    "Write Comcast renegotiation script",
    "Where is my money going?",
  ];

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = { sender: "user", text: textToSend, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/financial-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          transactions: transactions.slice(0, 50),
          bills,
          income,
        }),
      });
      if (!response.ok) throw new Error("Chat API error.");
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: data.reply || "Sorry, I encountered an error.", timestamp: new Date() },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "I'm having trouble connecting. Make sure your GEMINI_API_KEY is set in Settings > Secrets.",
          timestamp: new Date(),
        },
      ]);
      onAddAlert("Chat Connection Error", "Unable to connect to Gemini API", "warning");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div
      id="ai-personal-advisor-container"
      className="p-5 rounded-2xl h-[520px] flex flex-col justify-between transition-all duration-300 brutal-card"
    >
      {/* Header */}
      <div>
        <div
          className="flex items-center gap-3 pb-3 border-b"
          style={{ borderColor: "var(--color-border-subtle)" }}
        >
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "var(--color-brand-50)" }}
          >
            <Sparkles className="w-5 h-5 animate-pulse" style={{ color: "var(--color-brand-600)" }} />
          </div>
          <div>
            <h3
              className="text-sm font-semibold tracking-tight font-display"
              style={{ color: "var(--color-text-primary)" }}
            >
              AI Coach & Advisor
            </h3>
            <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
              Powered by Google Gemini
            </p>
          </div>
        </div>
      </div>

      {/* Message feed */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex gap-3 items-start max-w-[92%] ${
              m.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            }`}
          >
            {/* Avatar */}
            <div
              className="h-7 w-7 rounded-xl shrink-0 flex items-center justify-center"
              style={{
                backgroundColor: m.sender === "user"
                  ? "var(--color-brand-600)"
                  : "var(--color-bg-muted)",
                color: m.sender === "user" ? "#ffffff" : "var(--color-text-secondary)",
              }}
            >
              {m.sender === "user"
                ? <User className="w-3.5 h-3.5" />
                : <Bot className="w-4 h-4" />}
            </div>

            {/* Bubble */}
            <div
              className="p-3 rounded-2xl whitespace-pre-line font-sans leading-relaxed text-xs"
              style={
                m.sender === "user"
                  ? {
                      backgroundColor: "var(--color-brand-600)",
                      color: "#ffffff",
                      borderRadius: "1rem 0.25rem 1rem 1rem",
                    }
                  : {
                      backgroundColor: "var(--color-bg-subtle)",
                      color: "var(--color-text-primary)",
                      border: "1px solid var(--color-border-medium)",
                      borderRadius: "0.25rem 1rem 1rem 1rem",
                    }
              }
            >
              {m.text}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-3 items-start mr-auto">
            <div
              className="h-7 w-7 rounded-xl shrink-0 flex items-center justify-center"
              style={{ backgroundColor: "var(--color-bg-muted)" }}
            >
              <Bot className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
            </div>
            <div
              className="p-3 rounded-2xl flex items-center gap-1.5 font-sans text-xs"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                color: "var(--color-text-muted)",
                border: "1px solid var(--color-border-medium)",
                borderRadius: "0.25rem 1rem 1rem 1rem",
              }}
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {messages.length < 3 && !isTyping && (
        <div
          className="py-2.5 flex flex-wrap gap-1.5 border-t mt-1"
          style={{ borderColor: "var(--color-border-subtle)" }}
        >
          {quickPrompts.map((p, pIdx) => (
            <button
              key={pIdx}
              onClick={() => handleSendMessage(p)}
              className="text-[10px] font-sans font-semibold px-3 py-1.5 rounded-full cursor-pointer transition-all max-w-full truncate border"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                color: "var(--color-text-secondary)",
                borderColor: "var(--color-border-medium)",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputValue); }}
        className="flex gap-2 mt-2 pt-2 border-t"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask advice, request scripts, or analyze budgets..."
          className="brutal-input text-xs flex-1"
          disabled={isTyping}
        />
        <button
          type="submit"
          className="shrink-0 p-3 flex items-center justify-center rounded-xl transition-colors cursor-pointer"
          style={{
            backgroundColor: "var(--color-brand-600)",
            color: "#ffffff",
          }}
          disabled={isTyping}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}