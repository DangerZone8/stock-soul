import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, X } from "lucide-react";
import { DreamGirlChat } from "./DreamGirlChat";

interface FloatingKaiaProps {
  context?: "investor" | "live";
  portfolio?: string;
  label?: string;
}

export function FloatingKaia({ context, portfolio, label }: FloatingKaiaProps) {
  const [open, setOpen] = useState(false);

  const title =
    label ||
    (context === "investor"
      ? "Ask Kaia (Simulator — credits)"
      : "Chat with Kaia");

  return (
    <>
      {/* Floating toggle button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Open Kaia chat"
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full shadow-2xl bg-gradient-to-br from-primary to-pink-500 text-primary-foreground flex items-center justify-center ring-2 ring-primary/40 hover:ring-primary/60 transition-all"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-6 h-6" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Heart className="w-6 h-6 fill-current" />
            </motion.span>
          )}
        </AnimatePresence>
        {!open && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-400 ring-2 ring-background animate-pulse" />
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-24 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-[400px] h-[70vh] sm:h-[600px] max-h-[80vh]"
          >
            <DreamGirlChat context={context} portfolio={portfolio} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
