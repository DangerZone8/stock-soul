import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { TrendingUp, Heart, Menu, X, Trophy, BarChart3, Coins, LogOut, LogIn, Briefcase } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";

const NAV_ITEMS = [
  { label: "Home", path: "/", icon: TrendingUp },
  { label: "Kaia", path: "/dream-girl", icon: Heart },
  { label: "Live Market", path: "/live", icon: BarChart3 },
  { label: "Stock Investor", path: "/investor", icon: Briefcase },
  { label: "Achievements", path: "/achievements", icon: Trophy },
];

export function Navbar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, profile, signOut } = useAuth();

  const isActive = (path: string) => {
    const base = path.split("#")[0];
    return location.pathname === base;
  };

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center neon-glow">
            <TrendingUp className="w-4 h-4 text-primary" strokeWidth={1.5} />
          </div>
          <span className="font-semibold text-lg tracking-tight">
            Stock<span className="text-primary">Soul</span>
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <item.icon className="w-4 h-4" strokeWidth={1.5} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <ThemeToggle />
          {user && profile && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-sm font-mono font-semibold">
              <Coins className="w-4 h-4" />
              {Math.floor(profile.coins)}
            </div>
          )}
          {user ? (
            <button onClick={signOut} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50">
              <LogOut className="w-4 h-4" /> <span className="hidden xl:inline">Sign out</span>
            </button>
          ) : (
            <Link to="/auth" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90">
              <LogIn className="w-4 h-4" /> Sign in
            </Link>
          )}
        </div>

        <div className="flex lg:hidden items-center gap-2">
          {user && profile && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-mono font-semibold">
              <Coins className="w-3.5 h-3.5" />
              {Math.floor(profile.coins)}
            </div>
          )}
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2.5 rounded-lg text-foreground hover:bg-secondary/50 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-border/30 bg-background/95 backdrop-blur-xl">
          <div className="container mx-auto px-4 py-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <item.icon className="w-5 h-5" strokeWidth={1.5} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
