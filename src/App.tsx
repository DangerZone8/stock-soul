import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Achievements from "./pages/Achievements.tsx";
import DreamGirl from "./pages/DreamGirl.tsx";
import NotFound from "./pages/NotFound.tsx";
import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

const queryClient = new QueryClient();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {/* Dark/Light Mode Toggle */}
<button
  onClick={toggleDarkMode}
  className="fixed top-4 right-4 z-50 p-3 rounded-full bg-card border border-border hover:bg-accent transition-colors shadow-lg"
  aria-label="Toggle dark/light mode"
>
  {darkMode ? (
    <Sun className="h-5 w-5 text-yellow-400" />
  ) : (
    <Moon className="h-5 w-5 text-indigo-500" />
  )}
</button>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/dream-girl" element={<DreamGirl />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
