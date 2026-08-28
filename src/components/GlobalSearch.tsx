import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  FileText,
  MessageCircle,
  BookOpen,
  X,
  Star,
  Clock,
  CalendarDays,
  Trash2,
  Filter,
  Save,
} from "lucide-react";
import { SUBJECTS } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserPreferences } from "@/hooks/useUserPreferences";

const SUBJECT_CODES = ["EP", "DS", "DEVC", "EG", "BEEE", "IT", "SS", "NNSCS"];
const TYPE_OPTIONS = ["notes", "labs", "assignments", "posts", "chats", "attendance"] as const;
type TypeFilter = (typeof TYPE_OPTIONS)[number] | null;

const RECENT_KEY = "nf:recent-searches";
function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveRecent(q: string) {
  if (!q.trim()) return;
  const list = [q, ...loadRecent().filter((x) => x !== q)].slice(0, 10);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

interface SearchResult {
  type: "subject" | "file" | "chat-user" | "page" | "message" | "post" | "attendance";
  title: string;
  subtitle?: string;
  url: string;
  icon: React.ReactNode;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [subjectFilters, setSubjectFilters] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [chatUsers, setChatUsers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { prefs, saveSearch, removeSavedSearch } = useUserPreferences();

  // Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) setRecent(loadRecent());
  }, [open]);

  // Load core lookup data on open
  useEffect(() => {
    if (!open || !user?.supabaseId) return;
    (async () => {
      const [filesRes, usersRes] = await Promise.all([
        supabase.from("admin_files").select("id, file_name, subject_code, folder_type").limit(500),
        supabase
          .from("profiles")
          .select("id, student_id, name, division")
          .neq("id", user.supabaseId)
          .limit(200),
      ]);
      if (filesRes.data) setFiles(filesRes.data);
      if (usersRes.data) setChatUsers(usersRes.data);
    })();
  }, [open, user?.supabaseId]);

  // Live query for messages/posts/attendance when query length >=2
  useEffect(() => {
    if (!open || !user?.supabaseId) return;
    if (query.trim().length < 2) {
      setMessages([]);
      setPosts([]);
      setAttendance([]);
      return;
    }
    const q = query.trim();
    const t = setTimeout(async () => {
      const runMessages = async () => {
        if (typeFilter && typeFilter !== "chats") return { data: [] as any[] };
        return await supabase
          .from("messages")
          .select("id, text, from_user_id, to_user_id, group_id, created_at")
          .ilike("text", `%${q}%`)
          .is("deleted_at", null)
          .or(`from_user_id.eq.${user.supabaseId},to_user_id.eq.${user.supabaseId}`)
          .limit(8);
      };
      const runPosts = async () => {
        if (typeFilter && typeFilter !== "posts") return { data: [] as any[] };
        let pq = supabase
          .from("posts")
          .select("id, text, subject_code, author_id, created_at")
          .ilike("text", `%${q}%`)
          .limit(8);
        if (subjectFilters.length) pq = pq.in("subject_code", subjectFilters);
        return await pq;
      };
      const runAttendance = async () => {
        if (typeFilter && typeFilter !== "attendance") return { data: [] as any[] };
        const dateMatch = q.match(/\d{4}-\d{2}-\d{2}/);
        const statusKw = ["present", "absent", "cancelled", "late"].find((s) => q.toLowerCase().includes(s));
        if (!dateMatch && !statusKw) return { data: [] as any[] };
        let aq = supabase
          .from("attendance_records")
          .select("id, date, status, subject_id")
          .eq("user_id", user.supabaseId!)
          .order("date", { ascending: false })
          .limit(8);
        if (dateMatch) aq = aq.eq("date", dateMatch[0]);
        if (statusKw) aq = aq.eq("status", statusKw as any);
        return await aq;
      };

      const [mRes, pRes, aRes] = await Promise.all([runMessages(), runPosts(), runAttendance()]);
      setMessages(mRes?.data || []);
      setPosts(pRes?.data || []);
      setAttendance(aRes?.data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [query, typeFilter, subjectFilters, open, user?.supabaseId]);

  const userById = useMemo(() => {
    const m: Record<string, any> = {};
    chatUsers.forEach((u) => (m[u.id] = u));
    return m;
  }, [chatUsers]);

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim() && !subjectFilters.length && !typeFilter) return [];
    const q = query.toLowerCase();
    const res: SearchResult[] = [];

    if (!typeFilter) {
      // pages
      [
        { title: "Home", url: "/" },
        { title: "Chats", url: "/chats" },
        { title: "Attendance", url: "/attendance" },
        { title: "Timetable", url: "/timetable" },
        { title: "Profile", url: "/profile" },
      ].forEach((p) => {
        if (q && p.title.toLowerCase().includes(q)) {
          res.push({
            type: "page",
            title: p.title,
            url: p.url,
            icon: <BookOpen className="h-4 w-4 text-primary" />,
          });
        }
      });

      // subjects
      SUBJECTS.forEach((s) => {
        if (subjectFilters.length && !subjectFilters.includes(s.code)) return;
        if (!q || s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) {
          res.push({
            type: "subject",
            title: s.code,
            subtitle: s.name,
            url: s.code === "SS" || s.code === "NNSCS" ? `/posts/${s.code}` : `/subject/${s.code}`,
            icon: <BookOpen className="h-4 w-4 text-primary" />,
          });
        }
      });

      // chat users
      chatUsers.forEach((u) => {
        if (q && (u.student_id.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))) {
          res.push({
            type: "chat-user",
            title: u.name,
            subtitle: `${u.student_id} • ${u.division}`,
            url: "/chats",
            icon: <MessageCircle className="h-4 w-4 text-primary" />,
          });
        }
      });
    }

    // files (notes/labs/assignments)
    if (!typeFilter || ["notes", "labs", "assignments"].includes(typeFilter)) {
      files.forEach((f) => {
        if (subjectFilters.length && !subjectFilters.includes(f.subject_code)) return;
        if (typeFilter && f.folder_type !== typeFilter) return;
        if (
          !q ||
          f.file_name.toLowerCase().includes(q) ||
          (f.subject_code || "").toLowerCase().includes(q)
        ) {
          res.push({
            type: "file",
            title: f.file_name,
            subtitle: `${f.subject_code || ""} / ${f.folder_type || ""}`,
            url: `/subject/${f.subject_code}`,
            icon: <FileText className="h-4 w-4 text-primary" />,
          });
        }
      });
    }

    // chat messages
    if (!typeFilter || typeFilter === "chats") {
      messages.forEach((m) => {
        const otherId = m.from_user_id === user?.supabaseId ? m.to_user_id : m.from_user_id;
        const other = userById[otherId];
        res.push({
          type: "message",
          title: m.text.slice(0, 80),
          subtitle: other ? `${other.name} • ${new Date(m.created_at).toLocaleDateString()}` : new Date(m.created_at).toLocaleDateString(),
          url: `/chats?messageId=${m.id}${other ? `&with=${other.id}` : ""}`,
          icon: <MessageCircle className="h-4 w-4 text-primary" />,
        });
      });
    }

    // posts
    if (!typeFilter || typeFilter === "posts") {
      posts.forEach((p) => {
        if (subjectFilters.length && !subjectFilters.includes(p.subject_code)) return;
        res.push({
          type: "post",
          title: p.text.slice(0, 80),
          subtitle: `${p.subject_code} • ${new Date(p.created_at).toLocaleDateString()}`,
          url: `/posts/${p.subject_code}`,
          icon: <FileText className="h-4 w-4 text-primary" />,
        });
      });
    }

    // attendance
    if (!typeFilter || typeFilter === "attendance") {
      attendance.forEach((a) => {
        res.push({
          type: "attendance",
          title: `${a.status.toUpperCase()} on ${a.date}`,
          subtitle: "Attendance record",
          url: `/attendance?date=${a.date}`,
          icon: <CalendarDays className="h-4 w-4 text-primary" />,
        });
      });
    }

    return res.slice(0, 30);
  }, [query, subjectFilters, typeFilter, files, chatUsers, messages, posts, attendance, userById, user?.supabaseId]);

  const go = useCallback(
    (url: string) => {
      if (query.trim()) saveRecent(query.trim());
      navigate(url);
      setOpen(false);
    },
    [navigate, query]
  );

  const toggleSubject = (code: string) =>
    setSubjectFilters((p) => (p.includes(code) ? p.filter((x) => x !== code) : [...p, code]));

  const applyRecent = (q: string) => setQuery(q);
  const clearRecent = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecent([]);
  };

  const onSaveCurrent = async () => {
    if (!query.trim()) return;
    await saveSearch({ query: query.trim(), subjects: subjectFilters, type: typeFilter });
  };

  const applySaved = (id: string) => {
    const s = prefs.saved_searches.find((x) => x.id === id);
    if (!s) return;
    setQuery(s.query);
    setSubjectFilters(s.subjects);
    setTypeFilter((s.type as TypeFilter) || null);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open global search"
        className="flex items-center gap-2 h-9 px-3 rounded-lg bg-secondary/50 border border-border/50 text-muted-foreground text-sm hover:bg-secondary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border/50 bg-background px-1.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div className="fixed inset-0 bg-background/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <aside className="hidden md:flex w-52 shrink-0 border-r border-border flex-col bg-secondary/30">
          <div className="p-3 border-b border-border/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Recent
              {recent.length > 0 && (
                <button onClick={clearRecent} className="ml-auto text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </p>
          </div>
          <div className="overflow-y-auto flex-1 max-h-[280px]">
            {recent.length === 0 && (
              <p className="text-xs text-muted-foreground/60 p-3">No recent searches</p>
            )}
            {recent.map((q, i) => (
              <button
                key={i}
                onClick={() => applyRecent(q)}
                className="w-full text-left text-xs px-3 py-2 hover:bg-secondary/60 truncate text-foreground"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="p-3 border-y border-border/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Star className="h-3 w-3" /> Saved
            </p>
          </div>
          <div className="overflow-y-auto flex-1">
            {prefs.saved_searches.length === 0 && (
              <p className="text-xs text-muted-foreground/60 p-3">Save a query for quick access</p>
            )}
            {prefs.saved_searches.map((s) => (
              <div key={s.id} className="group flex items-center hover:bg-secondary/60">
                <button
                  onClick={() => applySaved(s.id)}
                  className="flex-1 text-left text-xs px-3 py-2 truncate text-foreground"
                >
                  {s.query}
                </button>
                <button
                  onClick={() => removeSavedSearch(s.id)}
                  className="p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-3 px-4 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subjects, files, chats, posts, attendance..."
              className="flex-1 h-12 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) saveRecent(query.trim());
              }}
            />
            <button
              onClick={() => setShowFilters((f) => !f)}
              className={`p-1.5 rounded-md transition-colors ${
                showFilters || subjectFilters.length || typeFilter
                  ? "bg-primary/15 text-primary"
                  : "hover:bg-secondary/50 text-muted-foreground"
              }`}
              aria-label="Toggle filters"
            >
              <Filter className="h-4 w-4" />
            </button>
            {query.trim() && (
              <button
                onClick={onSaveCurrent}
                className="p-1.5 hover:bg-secondary/50 rounded-md text-muted-foreground"
                aria-label="Save search"
                title="Save search"
              >
                <Save className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-secondary/50 rounded-md">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {showFilters && (
            <div className="border-b border-border/50 px-3 py-2 space-y-2 bg-secondary/20">
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mr-1">
                  Subject
                </span>
                {SUBJECT_CODES.map((c) => {
                  const on = subjectFilters.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => toggleSubject(c)}
                      className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
                        on
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:bg-secondary/60 text-muted-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mr-1">
                  Type
                </span>
                {TYPE_OPTIONS.map((t) => {
                  const on = typeFilter === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(on ? null : t)}
                      className={`text-[11px] px-2 py-0.5 rounded-md border capitalize transition-colors ${
                        on
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:bg-secondary/60 text-muted-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
                {(subjectFilters.length > 0 || typeFilter) && (
                  <button
                    onClick={() => {
                      setSubjectFilters([]);
                      setTypeFilter(null);
                    }}
                    className="ml-auto text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="max-h-[55vh] overflow-y-auto p-2">
            {!query.trim() && !subjectFilters.length && !typeFilter && (
              <p className="text-xs text-muted-foreground text-center py-8">
                Start typing or pick a filter above
              </p>
            )}
            {(query.trim() || subjectFilters.length || typeFilter) && results.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No results found</p>
            )}
            {results.map((r, i) => {
              const matchIndex = query
                ? r.title.toLowerCase().indexOf(query.toLowerCase())
                : -1;
              return (
                <button
                  key={`${r.type}-${i}`}
                  onClick={() => go(r.url)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-secondary/50 transition-colors"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {r.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {matchIndex >= 0 && query ? (
                        <>
                          {r.title.slice(0, matchIndex)}
                          <mark className="bg-primary/30 text-foreground rounded px-0.5">
                            {r.title.slice(matchIndex, matchIndex + query.length)}
                          </mark>
                          {r.title.slice(matchIndex + query.length)}
                        </>
                      ) : (
                        r.title
                      )}
                    </p>
                    {r.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground capitalize bg-secondary/50 px-2 py-0.5 rounded-md shrink-0">
                    {r.type.replace("-", " ")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
