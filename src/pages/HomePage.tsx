import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SUBJECTS, SEMESTERS, SUBJECT_COLORS, DIVISIONS, type Division } from "@/lib/constants";
import { Calendar, BookOpen, FlaskConical, FileText, ClipboardList, MessageSquare, Sparkles, Bell, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationsPopup } from "@/components/NotificationsPopup";
import { useActiveDivision, writeGodDivision } from "@/hooks/useActiveDivision";

import { EmptyState } from "@/components/EmptyState";

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { division: activeDivision, isGod } = useActiveDivision();
  const activeSem = SEMESTERS.find((s) => s.enabled);

  const pickDivision = (d: Division) => {
    if (isGod) writeGodDivision(d);
    navigate(`/${d.toLowerCase()}`);
  };

  // For god with no selection yet, show compressed division picker instead of subjects
  const godNeedsPick = isGod && !activeDivision;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="p-4 pb-8 space-y-6 fade-in w-full max-w-3xl mx-auto">
      {/* Greeting + quick actions */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{getGreeting()}</p>
          <h2 className="text-2xl font-bold text-foreground truncate">
            {user?.name}
          </h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="rounded-lg text-xs font-medium border-primary/30 text-primary bg-primary/5">
              {isGod ? (activeDivision ? `${activeDivision} (God)` : "God · No Class") : `${user?.division} Division`}
            </Badge>
            <Badge variant="secondary" className="rounded-lg text-xs font-medium">
              {activeSem?.label || "Sem 2"}
            </Badge>
            {isGod && activeDivision && (
              <button
                onClick={() => { writeGodDivision(null); navigate("/"); }}
                className="text-[10px] text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                title="Switch class"
              >
                <ArrowLeftRight className="h-3 w-3" /> Switch
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl gap-2 glass border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
            onClick={() => navigate("/timetable")}
          >
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium hidden sm:inline">Time Table</span>
          </Button>
          <NotificationsPopup />
        </div>
      </div>

      {isGod && (
        <div className="flex gap-2">
          {DIVISIONS.map((d) => (
            <button
              key={d}
              onClick={() => pickDivision(d)}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                activeDivision === d
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "glass text-muted-foreground hover:text-foreground"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {/* Semesters */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {SEMESTERS.map((sem) => (
          <Badge
            key={sem.id}
            variant={sem.enabled ? "default" : "secondary"}
            className={`shrink-0 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer transition-all ${
              sem.enabled 
                ? "shadow-md hover:shadow-lg" 
                : "opacity-40 cursor-not-allowed"
            }`}
          >
            {sem.label}
          </Badge>
        ))}
      </div>

      {/* Timetable widget hidden — use the "Time Table" button above */}

      {/* Subjects Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Subjects
        </h3>
        {godNeedsPick ? (
          <div className="glass rounded-xl p-6 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground">Pick a class to view its subjects</p>
            <p className="text-xs text-muted-foreground">As god you can switch between CS, BS and IT anytime.</p>
          </div>
        ) : SUBJECTS.length === 0 ? (
          <EmptyState icon={BookOpen} title="No subjects for this semester" />
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {SUBJECTS.map((subject, idx) => (
            <button
              key={subject.code}
              onClick={() => navigate(`/subject/${subject.code}`)}
              className="glass rounded-xl p-4 text-left space-y-3 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${SUBJECT_COLORS[subject.code]} flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow`}>
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">{subject.code}</p>
                <p className="text-xs text-muted-foreground truncate">{subject.name}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {subject.code === "SS" ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-md">
                    <MessageSquare className="h-3 w-3" /> Posts
                  </span>
                ) : (
                  <>
                    {subject.hasNotes && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-md">
                        <FileText className="h-3 w-3" /> Notes
                      </span>
                    )}
                    {subject.hasLabs && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-md">
                        <FlaskConical className="h-3 w-3" /> Lab
                      </span>
                    )}
                    {subject.hasAssignments && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-md">
                        <ClipboardList className="h-3 w-3" /> Assign
                      </span>
                    )}
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
        )}
      </div>

      {/* Latest Updates */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Latest Updates</h3>
        <div className="glass rounded-xl p-4 space-y-3 border-l-4 border-l-primary">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-md">
              <Bell className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Welcome to NotesFriendly!</p>
              <p className="text-xs text-muted-foreground mt-0.5">Start exploring your subjects and materials.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
