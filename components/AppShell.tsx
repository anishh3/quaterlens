"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  FileText,
  Home,
  Menu,
  MessageSquare,
  Plus,
  Settings,
  X,
} from "lucide-react";
import type { RecentQuestion } from "@/lib/types";

type QuarterLensContextValue = {
  recent: RecentQuestion[];
  activeQuestion: string;
  isNew: boolean;
  selectQuestion: (question: string) => void;
  ask: (question: string) => void;
  startNew: () => void;
};

const QuarterLensContext = createContext<QuarterLensContextValue | null>(null);

export function useQuarterLens() {
  const value = useContext(QuarterLensContext);
  if (!value) {
    throw new Error("useQuarterLens must be used inside AppShell");
  }
  return value;
}

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

function nowLabel() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<RecentQuestion[]>([]);
  const [activeQuestion, setActiveQuestion] = useState("");
  const [isNew, setIsNew] = useState(true);

  useEffect(() => {
    setRecent([]);
    setActiveQuestion("");
    setIsNew(true);
  }, []);

  const value = useMemo<QuarterLensContextValue>(
    () => ({
      recent,
      activeQuestion,
      isNew,
      selectQuestion: (question: string) => {
        setIsNew(false);
        setActiveQuestion(question);
        setOpen(false);
        if (pathname !== "/") router.push("/");
      },
      ask: (question: string) => {
        const text = question.trim();
        if (!text) return;
        setIsNew(false);
        setActiveQuestion(text);
        setRecent((current) => {
          const existing = current.find((item) => item.text === text);
          const nextItem: RecentQuestion = existing
            ? { ...existing, ago: "just now" }
            : { text, ago: "just now", timeLabel: `Today at ${nowLabel()}` };
          return [nextItem, ...current.filter((item) => item.text !== text)].slice(0, 12);
        });
        setOpen(false);
        if (pathname !== "/") router.push("/");
      },
      startNew: () => {
        setIsNew(true);
        setOpen(false);
        if (pathname !== "/") router.push("/");
      },
    }),
    [activeQuestion, isNew, pathname, recent, router],
  );

  return (
    <QuarterLensContext.Provider value={value}>
      <div className="shell">
        <aside className={open ? "sidebar open" : "sidebar"}>
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>QuarterLens</span>
          </div>
          <button className="new-question" type="button" onClick={value.startNew}>
            <Plus size={18} />
            New Question
          </button>
          <nav className="nav">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? "nav-link active" : "nav-link"}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {recent.length > 0 ? (
          <div className="recent">
            <p>Recent Questions</p>
            <ul>
              {recent.map((item) => (
                <li key={item.text}>
                  <button
                    type="button"
                    className={
                      !isNew && pathname === "/" && item.text === activeQuestion
                        ? "recent-item active"
                        : "recent-item"
                    }
                    onClick={() => value.selectQuestion(item.text)}
                  >
                    <MessageSquare size={15} />
                    <span>
                      <strong>{item.text}</strong>
                      <em>{item.ago}</em>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          ) : null}
        </aside>
        {open ? (
          <button
            className="backdrop"
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
        ) : null}
        <div className="content">
          <button
            className="menu-button"
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          {children}
        </div>
      </div>
    </QuarterLensContext.Provider>
  );
}
