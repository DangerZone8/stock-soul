import { Link, useLocation } from "react-router-dom";
import { TrendingUp, Heart, LayoutDashboard } from "lucide-react";
import ThemeToggle from "../ThemeToggle";

const NAV_ITEMS = [
  { label: "Home", path: "/", icon: TrendingUp },
  { label: "Achievements", path: "/achievements", icon: LayoutDashboard },
  { label: "Kaia", path: "/dream-girl", icon: Heart },
];

export function Navbar() {
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center neon-glow">
            <TrendingUp className="w-4 h-4 text-primary" strokeWidth={1.5} />
          </div>
          <span className="font-semibold text-lg tracking-tight">
            Stock<span className="text-primary">Soul</span>
          </span>
        </Link>

        {/* Nav Items + Toggle */}
        <div className="flex items-center gap-2">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <item.icon className="w-4 h-4" strokeWidth={1.5} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}

          {/* 🌗 Theme Toggle Button */}
          <ThemeToggle />
        </div>

      </div>
    </nav>
  );
}
      </div>
    </nav>
  );
}
