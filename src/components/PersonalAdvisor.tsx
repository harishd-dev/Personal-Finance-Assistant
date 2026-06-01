import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Sparkles, Send, Bot, User, RefreshCw} from "lucide-react";
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

export default function PersonalAdvisor({ transactions, bills, income, onAddAlert }: PersonalAdvisorProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Hello! I am your AI Finance Assistant. I've analyzed your monthly cash-flow parameters. Ask me any question, suggest a category budget limit, or ask me to write a renegotiation script for subscriptions like Comcast or gym clubs! E.g. 'How can I trim my Utilities?'",
      timestamp: new Date()
    }
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
    "Where is my money going?"
  ];

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    // Append user message
    const userMsg: Message = {
      sender: "user",
      text: textToSend,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
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
          income
        })
      });

      if (!response.ok) {
        throw new Error("Chat assistant backend returned an error.");
      }

      const data = await response.json();
      
      const botMsg: Message = {
        sender: "bot",
        text: data.reply || "I apologize, I encountered a response error.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.error(err);
      const botErrMsg: Message = {
        sender: "bot",
        text: "I am having trouble connecting to my cognitive server. Make sure your GEMINI_API_KEY is configured correctly under Settings > Secrets, or try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botErrMsg]);
      onAddAlert("Chat Connection Error", "Unable to establish communication with Gemini API", "warning");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div id="ai-personal-advisor-container" className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm h-[520px] flex flex-col justify-between hover:shadow-md transition-all duration-300">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center shadow-2xs">
            <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight font-display">
              AI Coach & Advisor
            </h3>
            <p className="text-[10px] text-slate-400 font-sans">
              Conversational advisor powered by Google Gemini AI
            </p>
          </div>
        </div>
      </div>

      {/* Message Feed Display */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex gap-3 items-start max-w-[92%] ${
              m.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            }`}
          >
            <div className={`h-7.5 w-7.5 rounded-xl shrink-0 flex items-center justify-center text-[10px] shadow-xs ${
              m.sender === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
            }`}>
              {m.sender === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-4 h-4 text-slate-650" />}
            </div>

            <div className={`p-3 rounded-2xl whitespace-pre-line font-sans leading-relaxed text-slate-700 shadow-2xs ${
              m.sender === "user" 
                ? "bg-indigo-600 text-white rounded-tr-none" 
                : "bg-slate-50 border border-slate-100/60 rounded-tl-none text-slate-850"
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3 items-start mr-auto">
            <div className="h-7.5 w-7.5 rounded-xl shrink-0 bg-slate-100 text-slate-700 flex items-center justify-center shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-50 text-slate-500 border border-slate-100/60 p-3 rounded-2xl rounded-tl-none flex items-center gap-1.5 font-sans">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Prompts Suggestions */}
      {messages.length < 3 && !isTyping && (
        <div className="py-2.5 flex flex-wrap gap-1.5 border-t border-slate-100 mt-1">
          {quickPrompts.map((p, pIdx) => (
            <button
              key={pIdx}
              onClick={() => handleSendMessage(p)}
              className="text-[10px] font-sans tracking-tight font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full cursor-pointer transition-all max-w-full truncate"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input panel prompt */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputValue);
        }}
        className="flex gap-2 mt-2 pt-2 border-t border-slate-100"
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask advice, request Scripts, or analyze budgets..."
          className="brutal-input text-xs flex-1"
          disabled={isTyping}
        />
        <button
          type="submit"
          className="brutal-btn-primary shrink-0 p-3.5 flex items-center justify-center rounded-xl hover:bg-indigo-500 cursor-pointer"
          disabled={isTyping}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

    </div>
  );
}
