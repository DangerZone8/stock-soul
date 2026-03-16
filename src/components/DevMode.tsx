import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Code2, X, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const DEV_EMAIL = "rudra.shailendra1@gmail.com";

type DevState = "idle" | "form" | "dev-active" | "waitlist-done";

export function DevMode() {
  const [state, setState] = useState<DevState>("idle");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setLoading(true);

    if (trimmed === DEV_EMAIL) {
      // Activate dev mode
      setState("dev-active");
      document.querySelectorAll<HTMLElement>(
        "h1, h2, h3, h4, h5, h6, p, span, div.text-xs, div.text-sm, div.text-lg, div.text-muted-foreground, li, a"
      ).forEach((el) => {
        // Skip interactive elements and containers with many children
        if (el.tagName === "A" && el.children.length > 1) return;
        if (el.querySelector("input, button, svg")) return;
        el.contentEditable = "true";
        el.style.outline = "1px dashed hsl(157 100% 50% / 0.3)";
        el.style.cursor = "text";
      });
      toast({ title: "🚀 Dev Mode Activated", description: "All text is now editable. Click any text to edit." });
    } else {
      // Add to waitlist
      try {
        await supabase.from("waitlist" as any).insert({ email: trimmed } as any);
      } catch {
        // ignore duplicate
      }
      setState("waitlist-done");
    }
    setLoading(false);
  }, [email, toast]);

  const handlePublish = useCallback(() => {
    // Collect all editable text and save to localStorage
    const edits: Record<string, string> = {};
    document.querySelectorAll<HTMLElement>('[contenteditable="true"]').forEach((el, i) => {
      const key = el.dataset.editKey || `edit-${i}`;
      edits[key] = el.innerText;
      el.contentEditable = "false";
      el.style.outline = "";
      el.style.cursor = "";
    });
    localStorage.setItem("stocksoul-edits", JSON.stringify(edits));
    setState("idle");
    toast({ title: "✅ Changes Published", description: "Edits saved locally. They'll persist on reload." });
  }, [toast]);

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {state === "idle" && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setState("form")}
            className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            style={{ boxShadow: "0 0 20px hsl(157 100% 50% / 0.4)" }}
            title="Dev Mode"
          >
            <Code2 className="w-5 h-5" strokeWidth={2} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Email Form */}
      <AnimatePresence>
        {state === "form" && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 glass-card p-5 w-80"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold font-mono text-primary">Dev Mode</span>
              <button onClick={() => setState("idle")} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Your email"
              className="w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 mb-3"
              autoFocus
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !email.trim()}
              className="btn-terminal w-full text-sm disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Waitlist Confirmation */}
      <AnimatePresence>
        {state === "waitlist-done" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 glass-card p-5 w-80"
          >
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-primary">You're on the list!</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Thanks! You're on the waitlist — updates coming soon.
            </p>
            <button onClick={() => setState("idle")} className="btn-ghost-terminal w-full text-xs">
              Close
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dev Active: Publish Button */}
      <AnimatePresence>
        {state === "dev-active" && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={handlePublish}
            className="fixed bottom-6 right-6 z-50 btn-terminal text-sm neon-glow"
            style={{ boxShadow: "0 0 25px hsl(157 100% 50% / 0.5)" }}
          >
            <Check className="w-4 h-4" />
            Publish Changes
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
