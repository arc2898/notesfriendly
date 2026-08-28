import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, SUBJECT_COLORS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import {
  Calendar as CalendarIcon,
  Check,
  X as XIcon,
  Minus,
  Plus,
  Trash2,
  TrendingUp,
  Target,
  AlertTriangle,
  MoreVertical,
  Loader2,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import SubjectComplianceRing from "@/components/SubjectComplianceRing";
import AttendanceMonthGrid from "@/components/AttendanceMonthGrid";

interface Subject {
  id: string;
  user_id: string;
  code: string;
  name: string;
  threshold: number;
  color: string | null;
}

type Status = "present" | "absent" | "cancelled";

interface AttRecord {
  id: string;
  user_id: string;
  subject_id: string;
  date: string; // YYYY-MM-DD
  status: Status;
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateToStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calOpen, setCalOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newThreshold, setNewThreshold] = useState(75);
  const [seeding, setSeeding] = useState(false);

  const dateStr = dateToStr(selectedDate);

  // Load subjects + records
  const loadAll = async () => {
    if (!user?.supabaseId) return;
    setLoading(true);
    const [{ data: subj }, { data: recs }] = await Promise.all([
      supabase.from("user_subjects").select("*").eq("user_id", user.supabaseId).order("created_at"),
      supabase.from("attendance_records").select("*").eq("user_id", user.supabaseId),
    ]);
    if (subj) setSubjects(subj as Subject[]);
    if (recs) setRecords(recs as AttRecord[]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [user?.supabaseId]);

  // Seed defaults from SUBJECTS
  const seedDefaults = async () => {
    if (!user?.supabaseId) return;
    setSeeding(true);
    const rows = SUBJECTS.filter((s) => s.code !== "SS").map((s) => ({
      user_id: user.supabaseId!,
      code: s.code,
      name: s.name,
      threshold: 75,
      color: SUBJECT_COLORS[s.code] || "from-blue-500 to-cyan-400",
    }));
    const { error } = await supabase.from("user_subjects").insert(rows);
    if (error) toast.error(error.message);
    else toast.success("Default subjects added");
    await loadAll();
    setSeeding(false);
  };

  // Mark attendance
  const mark = async (subjectId: string, status: Status) => {
    if (!user?.supabaseId) return;
    const existing = records.find((r) => r.subject_id === subjectId && r.date === dateStr);
    if (existing && existing.status === status) {
      // toggle off → delete
      const prev = records;
      setRecords((p) => p.filter((r) => r.id !== existing.id));
      const { error } = await supabase.from("attendance_records").delete().eq("id", existing.id);
      if (error) { setRecords(prev); toast.error(error.message); }
      return;
    }
    if (existing) {
      const prev = records;
      setRecords((p) => p.map((r) => r.id === existing.id ? { ...r, status } : r));
      const { error } = await supabase.from("attendance_records")
        .update({ status }).eq("id", existing.id);
      if (error) { setRecords(prev); toast.error(error.message); }
      return;
    }
    // Insert new — optimistic
    const tempId = `temp-${Date.now()}`;
    const optimistic: AttRecord = { id: tempId, user_id: user.supabaseId, subject_id: subjectId, date: dateStr, status };
    setRecords((p) => [...p, optimistic]);
    const { data, error } = await supabase.from("attendance_records")
      .insert({ user_id: user.supabaseId, subject_id: subjectId, date: dateStr, status })
      .select().single();
    if (error) {
      setRecords((p) => p.filter((r) => r.id !== tempId));
      toast.error(error.message);
    } else if (data) {
      setRecords((p) => p.map((r) => r.id === tempId ? (data as AttRecord) : r));
    }
  };

  const addSubject = async () => {
    if (!user?.supabaseId) return;
    const code = newSubjectCode.trim().toUpperCase();
    const name = newSubjectName.trim();
    if (!code || !name) { toast.error("Code and name required"); return; }
    const { error } = await supabase.from("user_subjects").insert({
      user_id: user.supabaseId,
      code,
      name,
      threshold: newThreshold,
      color: "from-violet-500 to-purple-400",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Subject added");
    setNewSubjectCode(""); setNewSubjectName(""); setNewThreshold(75);
    setAddOpen(false);
    await loadAll();
  };

  const deleteSubject = async (id: string) => {
    if (!confirm("Delete this subject and all its attendance records?")) return;
    const prev = subjects;
    setSubjects((p) => p.filter((s) => s.id !== id));
    const { error } = await supabase.from("user_subjects").delete().eq("id", id);
    if (error) { setSubjects(prev); toast.error(error.message); return; }
    toast.success("Subject deleted");
    setRecords((p) => p.filter((r) => r.subject_id !== id));
  };

  // Stats per subject
  const statsBySubject = useMemo(() => {
    const map: Record<string, { present: number; absent: number; total: number; pct: number }> = {} as any;
    subjects.forEach((s) => {
      const recs = records.filter((r) => r.subject_id === s.id && r.status !== "cancelled");
      const present = recs.filter((r) => r.status === "present").length;
      const absent = recs.filter((r) => r.status === "absent").length;
      const total = present + absent;
      const pct = total === 0 ? 0 : Math.round((present / total) * 1000) / 10;
      (map as any)[s.id] = { present, absent, total, pct };
    });
    return map as any as { [k: string]: { present: number; absent: number; total: number; pct: number } };
  }, [subjects, records]);

  // Calendar marked dates: dates with any record
  const datesWithRecords = useMemo(() => {
    const set = new Set(records.map((r) => r.date));
    return Array.from(set).map((d) => new Date(d + "T00:00:00"));
  }, [records]);

  const overallPct = useMemo(() => {
    let p = 0, t = 0;
    Object.values(statsBySubject).forEach((s: any) => { p += s.present; t += s.total; });
    return t === 0 ? 0 : Math.round((p / t) * 1000) / 10;
  }, [statsBySubject]);

  // Bunk math for selected subject (helper)
  const bunkAdvice = (s: Subject) => {
    const st = (statsBySubject as any)[s.id] || { present: 0, total: 0 };
    const target = s.threshold;
    if (st.total === 0) return `Mark some classes to see advice`;
    const currentPct = (st.present / st.total) * 100;
    if (currentPct >= target) {
      // can bunk: maximum x such that present/(total+x) >= target/100
      const max = Math.floor((st.present * 100 / target) - st.total);
      return max <= 0
        ? `At goal — attend next class to stay safe`
        : `You can skip ${max} more class${max === 1 ? "" : "es"} and stay at ${target}%`;
    } else {
      // need to attend: smallest y such that (present+y)/(total+y) >= target/100
      const y = Math.ceil((target * st.total - 100 * st.present) / (100 - target));
      return `Attend next ${y} class${y === 1 ? "" : "es"} in a row to reach ${target}%`;
    }
  };

  const recordFor = (subjectId: string) => records.find((r) => r.subject_id === subjectId && r.date === dateStr);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-8 space-y-5 max-w-2xl mx-auto fade-in">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Attendance</p>
        <h2 className="text-2xl font-bold text-foreground">Track your classes</h2>
      </div>

      {/* Overall + Date picker */}
      <div className="flex gap-3 items-stretch">
        <div className="flex-1 glass rounded-xl p-4 border-l-4 border-l-primary">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <TrendingUp className="h-3.5 w-3.5" /> Overall
          </div>
          <p className={`text-3xl font-bold mt-1 ${overallPct >= 75 ? "text-emerald-500" : overallPct >= 60 ? "text-amber-500" : "text-rose-500"}`}>
            {overallPct}%
          </p>
        </div>
        <Dialog open={calOpen} onOpenChange={setCalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-auto px-4 rounded-xl glass border-border/50 flex-col gap-1">
              <CalendarIcon className="h-5 w-5 text-primary" />
              <span className="text-xs font-semibold">{selectedDate.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Pick date</DialogTitle></DialogHeader>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => { if (d) { setSelectedDate(d); setCalOpen(false); } }}
              modifiers={{ marked: datesWithRecords }}
              modifiersClassNames={{ marked: "ring-2 ring-primary/50 ring-offset-1 ring-offset-background rounded-md" }}
            />
            <Button variant="ghost" size="sm" onClick={() => { setSelectedDate(new Date()); setCalOpen(false); }}>
              Jump to today
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* At-risk banner */}
      {subjects.some((s) => {
        const st: any = (statsBySubject as any)[s.id];
        return st && st.total > 0 && st.pct < s.threshold;
      }) && (
        <div className="rounded-xl bg-rose-500/10 border-l-4 border-rose-500 p-3 flex gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-700 dark:text-rose-300">
            <p className="font-bold">At risk in: {subjects.filter((s) => {
              const st: any = (statsBySubject as any)[s.id];
              return st && st.total > 0 && st.pct < s.threshold;
            }).map((s) => s.code).join(", ")}</p>
            <p>Attend the next class to start recovering.</p>
          </div>
        </div>
      )}

      {/* Compliance rings */}
      {subjects.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
          {subjects.map((s) => {
            const st: any = (statsBySubject as any)[s.id] || { pct: 0, present: 0, total: 0 };
            return (
              <div key={s.id} className="snap-start">
                <SubjectComplianceRing
                  code={s.code}
                  name={s.name}
                  pct={st.pct}
                  threshold={s.threshold}
                  present={st.present}
                  total={st.total}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Month grid */}
      {subjects.length > 0 && (
        <AttendanceMonthGrid
          records={records as any}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      )}

      {/* Empty state */}
      {subjects.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center space-y-4">
          <BookOpen className="h-10 w-10 mx-auto text-primary" />
          <div>
            <p className="font-semibold text-foreground">No subjects yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add the default subject set to get started</p>
          </div>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button onClick={seedDefaults} disabled={seeding}>
              {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add default subjects
            </Button>
            <Button variant="outline" onClick={() => setAddOpen(true)}>
              Add custom subject
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {dateStr === todayStr() ? "Today" : selectedDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)} className="text-primary">
              <Plus className="h-4 w-4 mr-1" /> Subject
            </Button>
          </div>

          {subjects.map((s) => {
            const stat = (statsBySubject as any)[s.id] || { present: 0, absent: 0, total: 0, pct: 0 };
            const today = recordFor(s.id);
            const pctColor = stat.pct >= s.threshold ? "text-emerald-500" : stat.pct >= 60 ? "text-amber-500" : "text-rose-500";
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${s.color || "from-primary to-accent"} flex items-center justify-center shrink-0 shadow-md`}>
                    <BookOpen className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{s.code}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.name}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Subject options">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => deleteSubject(s.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete subject
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className={`font-bold ${pctColor}`}>{stat.pct}%</span>
                      <span className="text-muted-foreground">{stat.present}/{stat.total}</span>
                      <Badge variant="outline" className="rounded-md text-[10px] gap-1">
                        <Target className="h-2.5 w-2.5" /> {s.threshold}%
                      </Badge>
                    </div>
                    <p className={`text-[11px] mt-1 ${stat.pct < s.threshold ? "text-rose-500" : "text-muted-foreground"}`}>
                      {stat.pct < s.threshold && stat.total > 0 && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                      {bunkAdvice(s)}
                    </p>
                  </div>
                </div>

                {/* Action row */}
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={today?.status === "present" ? "default" : "outline"}
                    size="sm"
                    onClick={() => mark(s.id, "present")}
                    className={today?.status === "present" ? "bg-emerald-500 hover:bg-emerald-600 text-white border-0" : ""}
                  >
                    <Check className="h-4 w-4 mr-1" /> Present
                  </Button>
                  <Button
                    variant={today?.status === "absent" ? "default" : "outline"}
                    size="sm"
                    onClick={() => mark(s.id, "absent")}
                    className={today?.status === "absent" ? "bg-rose-500 hover:bg-rose-600 text-white border-0" : ""}
                  >
                    <XIcon className="h-4 w-4 mr-1" /> Absent
                  </Button>
                  <Button
                    variant={today?.status === "cancelled" ? "default" : "outline"}
                    size="sm"
                    onClick={() => mark(s.id, "cancelled")}
                    className={today?.status === "cancelled" ? "bg-muted-foreground text-background border-0" : ""}
                  >
                    <Minus className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add subject dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add subject</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Code</label>
              <Input value={newSubjectCode} onChange={(e) => setNewSubjectCode(e.target.value)} placeholder="e.g. MATH" maxLength={12} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Name</label>
              <Input value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} placeholder="Mathematics" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Min %</label>
              <Input type="number" min={1} max={100} value={newThreshold} onChange={(e) => setNewThreshold(Math.max(1, Math.min(100, parseInt(e.target.value) || 75)))} />
            </div>
            <Button onClick={addSubject} className="w-full">Add subject</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
