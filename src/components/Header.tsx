import { Link, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const topLinks = [
  { label: "Para você", to: "/" },
  { label: "Para empresas", to: "/" },
  { label: "Para operadoras", to: "/" },
  { label: "Quero aderir", to: "/contato" },
];

const navLinks = [
  { to: "/", label: "Início" },
  { to: "/recarga", label: "Recarga" },
  { to: "/sobre", label: "Sobre a TIM" },
  { to: "/contato", label: "Contato" },
] as const;

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 m-0 p-0">
      <div className="hidden md:block bg-primary border-b border-primary-foreground/10">
        <div className="section-container flex items-center justify-between h-8">
          <nav className="hidden md:flex items-center gap-6">
            {topLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="text-xs text-primary-foreground/80 hover:text-primary-foreground transition-colors font-medium"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div />
        </div>
      </div>

      <div className="bg-primary">
        <div className="section-container flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-1.5 font-extrabold text-xl">
            <span className="text-tim-red text-2xl">≡</span>
            <span className="text-primary-foreground text-2xl tracking-tight">TIM</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className={`text-sm font-medium transition-colors hover:text-primary-foreground ${
                  isActive(link.to) ? "text-primary-foreground" : "text-primary-foreground/70"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Search className="w-5 h-5 text-primary-foreground/70 hover:text-primary-foreground cursor-pointer transition-colors" />
          </nav>

          <button
            className="md:hidden text-primary-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden bg-primary"
          >
            <div className="section-container py-4 flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`text-sm font-medium py-2 transition-colors ${
                    isActive(link.to)
                      ? "text-primary-foreground"
                      : "text-primary-foreground/80 hover:text-primary-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
