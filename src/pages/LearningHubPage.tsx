import { GraduationCap, ExternalLink, Sparkles } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { PHASES, BRANCHES, LANGUAGES, CERTIFICATIONS, RESOURCES } from "@/data/learningContent";

export default function LearningHubPage() {
  const { prefs } = useUserPreferences();
  const goal = (prefs as any)?.career_goal as string | undefined;

  return (
    <div className="p-4 pb-8 max-w-4xl mx-auto fade-in space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Learning Hub</h2>
        </div>
        <p className="text-sm text-muted-foreground">Your cybersecurity mastery path</p>
        {goal && (
          <p className="text-xs text-primary flex items-center gap-1 mt-1">
            <Sparkles className="h-3 w-3" /> Tailored for: {BRANCHES.find((b) => b.id === goal)?.title || goal}
          </p>
        )}
      </div>

      <Tabs defaultValue="phases" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex">
          <TabsTrigger value="phases">Phases</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="languages">Languages</TabsTrigger>
          <TabsTrigger value="certs">Certifications</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="phases" className="mt-4">
          <Accordion type="single" collapsible>
            {PHASES.map((p) => (
              <AccordionItem key={p.id} value={p.id}>
                <AccordionTrigger className="text-sm font-bold">{p.title}</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {p.topics.map((t) => (
                      <div key={t} className="glass rounded-xl p-3 text-sm">{t}</div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        <TabsContent value="branches" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {BRANCHES.map((b) => (
              <div key={b.id} className={`glass rounded-xl p-4 space-y-2 ${goal === b.id ? "ring-2 ring-primary" : ""}`}>
                <p className="font-bold text-sm">{b.title}</p>
                <p className="text-xs text-muted-foreground">{b.subtitle}</p>
                <div className="flex flex-wrap gap-1">
                  {b.skills.map((s) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                </div>
                <p className="text-[11px] text-primary font-semibold">{b.salary}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="languages" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LANGUAGES.map((l) => (
              <div key={l.name} className="glass rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm">{l.name}</p>
                  <Badge variant={l.priority === "MUST" ? "default" : "outline"} className="text-[10px]">{l.priority}</Badge>
                </div>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map((i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= l.proficiency ? "bg-primary" : "bg-muted"}`} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{l.useCase}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="certs" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CERTIFICATIONS.map((c) => (
              <div key={c.name} className="glass rounded-xl p-4 space-y-2">
                <p className="font-bold text-sm">{c.name}</p>
                <div className="flex gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{c.level}</Badge>
                  <Badge variant="outline" className="text-[10px]">{c.difficulty}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="resources" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RESOURCES.map((r) => (
              <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer"
                 className="glass rounded-xl p-4 hover:bg-accent/30 transition-colors flex items-start gap-3">
                <ExternalLink className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-sm">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
