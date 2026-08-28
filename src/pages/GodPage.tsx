import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Eye, Users, ShieldCheck, ShieldOff, Key, Activity, ArrowLeftRight, Lock, RotateCcw, Sprout, ScrollText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfileWithRole {
  id: string;
  student_id: string;
  division: string;
  name: string;
  isAdmin: boolean;
  lastSignIn?: string;
}

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  details: string | null;
  page: string | null;
  created_at: string;
  profile?: { student_id: string; name: string };
}

export default function GodPage() {
  const { user } = useAuth();
  const [searchUser, setSearchUser] = useState("");
  const [viewDivision, setViewDivision] = useState<"CS" | "BS" | "IT">(user?.division || "CS");
  const [users, setUsers] = useState<ProfileWithRole[]>([]);
  const [adminCount, setAdminCount] = useState(0);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [tab, setTab] = useState<"users" | "passwords" | "logs">("users");
  const [seeding, setSeeding] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState("");
  const [seedCredentials, setSeedCredentials] = useState<{ id: string; password: string }[]>([]);
  const [bulkResetOpen, setBulkResetOpen] = useState(false);
  const [bulkConfirmText, setBulkConfirmText] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (tab === "logs") fetchLogs();
  }, [tab]);

  const fetchUsers = async () => {
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("id, student_id, division, name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const adminIds = new Set(
      (rolesRes.data || []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id)
    );

    let authUsers: any[] = [];
    try {
      const { data } = await supabase.functions.invoke("god-reset-password", {
        body: { action: "list_users" },
      });
      authUsers = data?.users || [];
    } catch {}

    const authMap = new Map(authUsers.map((u: any) => [u.id, u]));

    const mapped = (profilesRes.data || []).map((p: any) => ({
      ...p,
      isAdmin: adminIds.has(p.id),
      lastSignIn: authMap.get(p.id)?.last_sign_in || null,
    }));

    setUsers(mapped);
    setAdminCount(adminIds.size);
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    const { data: logsData } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (logsData && logsData.length > 0) {
      const userIds = [...new Set((logsData as any[]).map((l: any) => l.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, student_id, name")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      setLogs(
        (logsData as any[]).map((l: any) => ({
          ...l,
          profile: profileMap.get(l.user_id) || { student_id: "?", name: "Unknown" },
        }))
      );
    } else {
      setLogs([]);
    }
    setLogsLoading(false);
  };

  if (!user || user.role !== "god") {
    return <Navigate to="/" replace />;
  }

  const filteredUsers = users
    .filter((u) => u.division === viewDivision)
    .filter((u) =>
      u.student_id.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.name.toLowerCase().includes(searchUser.toLowerCase())
    );

  const filteredLogs = logs.filter(
    (l) =>
      !logFilter ||
      l.profile?.student_id.toLowerCase().includes(logFilter.toLowerCase()) ||
      l.action.toLowerCase().includes(logFilter.toLowerCase()) ||
      (l.details || "").toLowerCase().includes(logFilter.toLowerCase())
  );

  const promoteUser = async (userId: string) => {
    await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
    toast.success("Promoted to admin");
    fetchUsers();
  };

  const demoteUser = async (userId: string) => {
    await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
    toast.success("Demoted to student");
    fetchUsers();
  };

  const resetPassword = async (userId: string) => {
    if (!newPassword.trim()) {
      toast.error("Enter a new password");
      return;
    }
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("god-reset-password", {
        body: { action: "reset_password", userId, newPassword: newPassword.trim() },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Password reset successfully. The password is NOT stored — share it securely with the student.");
      setResetUserId(null);
      setNewPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setResetting(false);
    }
  };

  const bulkResetAllToUsername = async () => {
    setBulkRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("god-reset-password", {
        body: { action: "reset_all_to_username" },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`Reset ${data.updated} passwords (skipped ${data.skipped}). Each student's password is now their student ID.`);
      setBulkResetOpen(false);
      setBulkConfirmText("");
    } catch (err: any) {
      toast.error(err.message || "Bulk reset failed");
    } finally {
      setBulkRunning(false);
    }
  };

  const switchDivision = () => {
    setViewDivision((prev) => (prev === "CS" ? "BS" : prev === "BS" ? "IT" : "CS"));
  };

  const seedAllUsers = async () => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-users", { body: {} });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`Seeded ${data.created} users (${data.skipped} already existed)`);
      if (data.credentials && data.credentials.length > 0) {
        setSeedCredentials(data.credentials);
      }
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const downloadCredentials = () => {
    const csv = "Student ID,Password\n" + seedCredentials.map((c) => `${c.id},${c.password}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_credentials.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getActionLabel = (action: string) => {
    const map: Record<string, string> = {
      login: "Logged in",
      view_subject: "Viewed subject",
      download_file: "Downloaded file",
      preview_file: "Previewed file",
      send_message: "Sent message",
      view_chat: "Opened chat",
      view_profile: "Viewed profile",
      god_reset_password: "Reset password",
      god_list_users: "Listed all users",
      god_seed_users: "Seeded users",
    };
    return map[action] || action;
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="p-4 space-y-6 fade-in max-w-lg mx-auto">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Eye className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">God Panel</h2>
        </div>
        <p className="text-sm text-muted-foreground">Full control over users and admins</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: "users" as const, icon: Users, label: "Users" },
          { id: "passwords" as const, icon: Key, label: "Passwords" },
          { id: "logs" as const, icon: ScrollText, label: "Activity" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === t.id ? "bg-primary text-primary-foreground shadow-md" : "glass text-muted-foreground"
            }`}
          >
            <t.icon className="h-4 w-4 inline mr-1.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Seed Credentials Modal */}
      {seedCredentials.length > 0 && (
        <div className="glass rounded-xl p-4 space-y-3 border-2 border-primary/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">New Credentials Generated</p>
            <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={downloadCredentials}>
              Download CSV
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            These passwords are shown <strong>only once</strong>. Download or copy them now — they are NOT stored anywhere.
          </p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {seedCredentials.map((c) => (
              <div key={c.id} className="flex justify-between text-xs font-mono bg-secondary/50 rounded-lg px-3 py-1.5">
                <span className="text-foreground">{c.id}</span>
                <span className="text-muted-foreground">{c.password}</span>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="w-full text-xs text-destructive"
            onClick={() => setSeedCredentials([])}>
            I've saved these — dismiss
          </Button>
        </div>
      )}

      {/* Activity Logs Tab */}
      {tab === "logs" ? (
        <div className="space-y-3">
          <Input
            placeholder="Filter by user, action, or details..."
            value={logFilter}
            onChange={(e) => setLogFilter(e.target.value)}
            className="h-10 rounded-xl bg-secondary/50 border-border/50"
          />

          {logsLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredLogs.map((l) => (
                <div key={l.id} className="glass rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {l.profile?.student_id.slice(0, 2) || "??"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {l.profile?.student_id} — {l.profile?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{getActionLabel(l.action)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      {formatTime(l.created_at)}
                    </div>
                  </div>
                  {l.details && (
                    <p className="text-xs text-muted-foreground/80 pl-9 truncate">{l.details}</p>
                  )}
                  {l.page && (
                    <p className="text-[10px] text-muted-foreground/50 pl-9">{l.page}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-center text-muted-foreground py-8">No activity logs yet</p>
          )}
        </div>
      ) : (
        <>
          {/* Division switch */}
          <button onClick={switchDivision}
            className="w-full glass rounded-xl p-4 flex items-center gap-3 hover:scale-[1.01] active:scale-[0.99] transition-transform">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-foreground">Switch Division</p>
              <p className="text-xs text-muted-foreground">Currently viewing: <span className="text-primary font-bold">{viewDivision}</span></p>
            </div>
            <div className="flex gap-1">
              {(["CS", "BS", "IT"] as const).map((d) => (
                <span key={d} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  viewDivision === d ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}>{d}</span>
              ))}
            </div>
          </button>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass rounded-xl p-3 text-center">
              <Users className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-lg font-bold text-foreground">{filteredUsers.length}</p>
              <p className="text-[10px] text-muted-foreground">{viewDivision} Users</p>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <ShieldCheck className="h-5 w-5 mx-auto text-accent mb-1" />
              <p className="text-lg font-bold text-foreground">{adminCount}</p>
              <p className="text-[10px] text-muted-foreground">Admins</p>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <Activity className="h-5 w-5 mx-auto text-destructive mb-1" />
              <p className="text-lg font-bold text-foreground">{users.length}</p>
              <p className="text-[10px] text-muted-foreground">Total Users</p>
            </div>
          </div>

          {/* Seed button */}
          {users.length < 181 && (
            <Button onClick={seedAllUsers} disabled={seeding} className="w-full rounded-xl gap-2" variant="outline">
              <Sprout className="h-4 w-4" />
              {seeding ? "Seeding all 181 users..." : `Seed All Users (${181 - users.length} remaining)`}
            </Button>
          )}

          {/* Search */}
          <Input placeholder={`Search ${viewDivision} users...`} value={searchUser}
            onChange={(e) => setSearchUser(e.target.value)}
            className="h-10 rounded-xl bg-secondary/50 border-border/50" />

          {tab === "passwords" && (
            <div className="glass rounded-xl p-3 space-y-2 border-2 border-destructive/30">
              {!bulkResetOpen ? (
                <Button onClick={() => setBulkResetOpen(true)} variant="outline" className="w-full rounded-lg gap-2 text-destructive border-destructive/40 hover:bg-destructive/10">
                  <RotateCcw className="h-4 w-4" /> Reset ALL passwords to student ID
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-foreground">
                    This sets every student's password to their own student ID (e.g. CS01 / BS15). Type <span className="font-mono font-bold">RESET</span> to confirm.
                  </p>
                  <div className="flex gap-2">
                    <Input value={bulkConfirmText} onChange={(e) => setBulkConfirmText(e.target.value)}
                      placeholder="Type RESET" className="h-9 text-xs rounded-lg bg-secondary/50 border-border/50 flex-1" />
                    <Button size="sm" disabled={bulkConfirmText !== "RESET" || bulkRunning}
                      onClick={bulkResetAllToUsername} className="h-9 rounded-lg text-xs">
                      {bulkRunning ? "Resetting..." : "Confirm"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setBulkResetOpen(false); setBulkConfirmText(""); }}
                      className="h-9 rounded-lg text-xs">Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User list */}
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {filteredUsers.map((u) => (
              <div key={u.id} className="glass rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {u.student_id.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.student_id} — {u.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {u.isAdmin ? "Admin" : "Student"}
                        {u.lastSignIn && ` • Last: ${new Date(u.lastSignIn).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {tab === "users" && (
                      u.isAdmin ? (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => demoteUser(u.id)}>
                          <ShieldOff className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-accent" onClick={() => promoteUser(u.id)}>
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </Button>
                      )
                    )}
                    {tab === "passwords" && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-primary"
                        onClick={() => setResetUserId(resetUserId === u.id ? null : u.id)}>
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {tab === "passwords" && (
                  <div className="flex items-center gap-2 pl-10">
                    <Key className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground italic">
                      Passwords are securely hashed — use Reset to set a new one
                    </span>
                  </div>
                )}

                {tab === "passwords" && resetUserId === u.id && (
                  <div className="flex gap-2 pt-1">
          <Input
                      type="text"
                      placeholder="New password (min 4 chars)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-8 text-xs rounded-lg bg-secondary/50 border-border/50 flex-1"
                    />
                    <Button size="sm" className="h-8 rounded-lg text-xs px-3" disabled={resetting}
                      onClick={() => resetPassword(u.id)}>
                      <Lock className="h-3 w-3 mr-1" />
                      {resetting ? "..." : "Reset"}
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <p className="text-xs text-center text-muted-foreground py-4">No users found in {viewDivision} division yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
