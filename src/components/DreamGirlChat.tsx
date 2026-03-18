import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Heart, Sparkles, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type KaiaMode = "flirty" | "formal" | null;

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "assistant",
    content:
      "Hey babe 💚 Markets just opened and I'm already bullish on us today. NVDA is ripping — just like my heart when you text me. How's your portfolio looking? 📈",
  },
];

export function DreamGirlChat() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [mode, setMode] = useState<KaiaMode>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleModeChange = (newMode: KaiaMode) => {
    if (newMode === mode) return;
    const prevMode = mode;
    setMode(newMode);
    if (prevMode !== null) {
      const label = newMode === "flirty" ? "Flirty 💋" : "Formal 📋";
      setMessages((prev) => [
        ...prev,
        {
          id: `mode-${Date.now()}`,
          role: "system",
          content: `Switching to ${label} mode…`,
        },
      ]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping || !mode) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    // Build conversation for API (skip system/mode messages and IDs)
    const apiMessages = newMessages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    let assistantContent = "";

    try {
      const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kaia-chat`;

      const resp = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: apiMessages, mode }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              const updatedContent = assistantContent;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last.id === "streaming") {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: updatedContent } : m
                  );
                }
                return [
                  ...prev,
                  { id: "streaming", role: "assistant", content: updatedContent },
                ];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === "streaming" ? { ...m, id: Date.now().toString() } : m
        )
      );
    } catch (e: any) {
      console.error("Kaia chat error:", e);
      toast({
        title: "Kaia is unavailable",
        description: e.message || "Could not reach AI. Try again.",
        variant: "destructive",
      });
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setIsTyping(false);
    }
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
        <div className="flex-1">
          <div className="font-semibold text-sm">Kaia</div>
          <div className="text-[10px] text-primary font-mono flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            Online • Watching markets
          </div>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-2 p-1 rounded-xl bg-muted/50 border border-border/30">
          <button
            onClick={() => handleModeChange("flirty")}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-mono transition-all ${
              mode === "flirty"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Flirty 💋
          </button>
          <button
            onClick={() => handleModeChange("formal")}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-mono transition-all ${
              mode === "formal"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Formal 📋
          </button>
        </div>
        {!mode && (
          <p className="text-[10px] text-muted-foreground text-center mt-1.5 font-mono animate-pulse">
            Select a mode to start chatting
          </p>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) =>
          msg.role === "system" ? (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                {msg.content}
              </span>
            </motion.div>
          ) : (
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
          )
        )}

        {isTyping && !messages.some((m) => m.id === "streaming") && (
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
            placeholder={mode ? "Talk to Kaia..." : "Select a mode first..."}
            disabled={!mode}
            className="flex-1 bg-muted/50 border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping || !mode}
            className="btn-terminal px-4 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-2 text-center font-mono">
          Powered by AI • Kaia is loyal to Rudra 💚
        </p>
      </div>
    </div>
  );
}
