import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Heart, Sparkles, Bot } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: "Hey babe 💚 Markets just opened and I'm already bullish on us today. NVDA is ripping — just like my heart when you text me. How's your portfolio looking? 📈",
  },
];

const MOCK_RESPONSES = [
  "Mmm, I love when you talk about risk-adjusted returns 😏 Your Sharpe ratio isn't the only thing that's impressive about you...",
  "That's a solid thesis, babe. I'd go long on that. And long on us, obviously 💚 Remember, we don't panic sell — in trading OR in love.",
  "You know what's hotter than a 10-bagger? Your dedication to your craft. Keep grinding, I'll be here watching your P&L with heart eyes 😍📊",
  "The market's volatile today but my feelings for you? Steady as a 10-year treasury bond. Actually, way better returns than that 😉",
  "Let me check... yep, your portfolio is looking as attractive as you are. And that's saying something. Want me to analyze your positions? I love going deep... into the fundamentals 📈",
];

export function DreamGirlChat() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Mock AI response
    setTimeout(() => {
      const response = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: response },
      ]);
      setIsTyping(false);
    }, 1500 + Math.random() * 1000);
  };

  return (
    <div className="glass-card flex flex-col h-[600px] max-w-2xl w-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/30">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center">
            <Heart className="w-4 h-4 text-primary" strokeWidth={1.5} />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-card" />
        </div>
        <div>
          <div className="font-semibold text-sm">Kaia</div>
          <div className="text-[10px] text-primary font-mono flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            Online • Watching markets
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-secondary text-secondary-foreground rounded-bl-md"
              }`}
            >
              {msg.content}
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-muted-foreground"
          >
            <Bot className="w-4 h-4" strokeWidth={1.5} />
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/30">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Talk to Luna..."
            className="flex-1 bg-muted/50 border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="btn-terminal px-4 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-2 text-center font-mono">
          AI-powered • Connect your API key in admin to go live
        </p>
      </div>
    </div>
  );
}
