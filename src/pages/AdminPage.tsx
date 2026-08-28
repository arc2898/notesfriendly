import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Shield, Upload, Trash2, Bell, Send, FileText, Loader2, Plus, FolderOpen, X, CheckSquare, Square, FolderInput, Download, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SUBJECTS, DIVISIONS, Division } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FOLDER_TYPES = [
  { value: "notes", label: "Notes" },
  { value: "labs", label: "Labs" },
  { value: "records", label: "Records" },
  { value: "assignments", label: "Assignments" },
];

interface AdminFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  folder_type: string | null;
  subject_code: string | null;
  division: string | null;
  created_at: string;
}

export default function AdminPage() {
  const { user } = useAuth();
  const [notification, setNotification] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedDivision, setSelectedDivision] = useState<Division | "ALL">("ALL");
  const [selectedFolder, setSelectedFolder] = useState("");
  const [customFolder, setCustomFolder] = useState("");
  const [showCustomFolder, setShowCustomFolder] = useState(false);
  const [comment, setComment] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<{ name: string; status: "pending" | "done" | "error"; error?: string }[]>([]);
  const [files, setFiles] = useState<AdminFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveSubject, setMoveSubject] = useState("");
  const [moveFolder, setMoveFolder] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date");

  const isAdmin = user?.role === "admin" || user?.role === "god";

  const fetchFiles = async () => {
    if (!selectedSubject) {
      setFiles([]);
      return;
    }
    setLoadingFiles(true);
    const { data, error } = await supabase
      .from("admin_files")
      .select("*")
      .eq("subject_code", selectedSubject)
      .order("created_at", { ascending: false });
    if (data) setFiles(data as AdminFile[]);
    if (error) console.error("Fetch files error:", error);
    setLoadingFiles(false);
  };

  useEffect(() => {
    fetchFiles();
  }, [selectedSubject]);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !selectedSubject || (!selectedFolder && !customFolder)) {
      toast.error("Please select subject, folder, and at least one file");
      return;
    }
    if (!user.supabaseId) return;

    const folderType = showCustomFolder ? customFolder.trim().toLowerCase() : selectedFolder;
    if (!folderType) { toast.error("Please select or create a folder"); return; }

    setUploading(true);
    setUploadQueue(selectedFiles.map((f) => ({ name: f.name, status: "pending" })));

    let okCount = 0;
    for (let i = 0; i < selectedFiles.length; i++) {
      const f = selectedFiles[i];
      const filePath = `${selectedSubject}/${folderType}/${Date.now()}_${i}_${f.name}`;
      let attempt = 0;
      let success = false;
      let lastErr = "";
      while (attempt < 3 && !success) {
        const { error: storageError } = await supabase.storage.from("admin-files").upload(filePath, f);
        if (!storageError) { success = true; break; }
        lastErr = storageError.message;
        attempt++;
        await new Promise((r) => setTimeout(r, 300 * attempt));
      }
      if (!success) {
        setUploadQueue((q) => q.map((it, idx) => idx === i ? { ...it, status: "error", error: lastErr } : it));
        continue;
      }
      const { error: dbError } = await supabase.from("admin_files").insert({
        file_name: selectedFiles.length === 1 && comment.trim() ? comment.trim() : f.name,
        file_path: filePath,
        file_size: f.size,
        folder_type: folderType,
        subject_code: selectedSubject,
        division: selectedDivision === "ALL" ? null : selectedDivision,
        uploaded_by: user.supabaseId,
      });
      if (dbError) {
        setUploadQueue((q) => q.map((it, idx) => idx === i ? { ...it, status: "error", error: dbError.message } : it));
        continue;
      }
      okCount++;
      setUploadQueue((q) => q.map((it, idx) => idx === i ? { ...it, status: "done" } : it));
    }

    toast.success(`Uploaded ${okCount} of ${selectedFiles.length}`);
    setSelectedFiles([]);
    setComment("");
    setCustomFolder("");
    setShowCustomFolder(false);
    fetchFiles();
    setUploading(false);
  };

  const handleDelete = async (file: AdminFile) => {
    setDeletingId(file.id);
    try {
      await supabase.storage.from("admin-files").remove([file.file_path]);
      await supabase.from("admin_files").delete().eq("id", file.id);
      toast.success("File deleted");
      fetchFiles();
    } catch (err) {
      toast.error("Delete failed");
    }
    setDeletingId(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} file(s)? This cannot be undone.`)) return;
    setBulkBusy(true);
    const targets = files.filter((f) => selectedIds.has(f.id));
    await supabase.storage.from("admin-files").remove(targets.map((t) => t.file_path));
    await supabase.from("admin_files").delete().in("id", targets.map((t) => t.id));
    toast.success(`Deleted ${targets.length} file(s)`);
    setSelectedIds(new Set());
    setBulkBusy(false);
    fetchFiles();
  };

  const handleBulkMove = async () => {
    if (!moveSubject || !moveFolder || selectedIds.size === 0) return;
    setBulkBusy(true);
    const targets = files.filter((f) => selectedIds.has(f.id));
    let ok = 0;
    for (const t of targets) {
      const newPath = `${moveSubject}/${moveFolder}/${Date.now()}_${t.file_name.replace(/[^\w.-]/g, "_")}`;
      const { error: copyErr } = await supabase.storage.from("admin-files").copy(t.file_path, newPath);
      if (copyErr) continue;
      await supabase.storage.from("admin-files").remove([t.file_path]);
      const { error: updErr } = await supabase.from("admin_files").update({
        subject_code: moveSubject, folder_type: moveFolder, file_path: newPath,
      }).eq("id", t.id);
      if (!updErr) ok++;
    }
    toast.success(`Moved ${ok} of ${targets.length}`);
    setSelectedIds(new Set());
    setMoveOpen(false);
    setBulkBusy(false);
    fetchFiles();
  };

  const handleBulkDownload = async () => {
    const targets = files.filter((f) => selectedIds.has(f.id));
    for (const t of targets) {
      const { data } = await supabase.storage.from("admin-files").createSignedUrl(t.file_path, 3600);
      if (data?.signedUrl) {
        const a = document.createElement("a");
        a.href = data.signedUrl;
        a.download = t.file_name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  };


  const handlePushNotification = () => {
    if (!notification.trim()) return;
    toast.success("Notification sent: " + notification);
    setNotification("");
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Subjects that support file uploads (not posts-only)
  const uploadableSubjects = SUBJECTS.filter(s => s.code !== "SS");

  return (
    <div className="p-4 space-y-6 fade-in max-w-lg mx-auto pb-8">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Admin Panel</h2>
        </div>
        <p className="text-sm text-muted-foreground">Upload files and manage content</p>
      </div>

      {/* Push Notification */}
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Bell className="h-4 w-4 text-primary" />
          Push Notification
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Write notification..."
            value={notification}
            onChange={(e) => setNotification(e.target.value)}
            className="flex-1 h-10 rounded-lg bg-secondary/50 border-border/50"
          />
          <Button size="sm" onClick={handlePushNotification} className="h-10 rounded-lg gap-1">
            <Send className="h-3.5 w-3.5" /> Send
          </Button>
        </div>
      </div>

      {/* File Upload Section */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Upload className="h-4 w-4 text-primary" />
          Upload File
        </div>

        {/* Row 1: Subject + Folder */}
        <div className="flex gap-3">
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="flex-1 h-11 rounded-xl bg-secondary/50 border-border/50">
              <SelectValue placeholder="Select Subject" />
            </SelectTrigger>
            <SelectContent>
              {uploadableSubjects.map((s) => (
                <SelectItem key={s.code} value={s.code}>{s.code} – {s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!showCustomFolder ? (
            <div className="flex gap-1.5 flex-1">
              <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                <SelectTrigger className="flex-1 h-11 rounded-xl bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Select Folder" />
                </SelectTrigger>
                <SelectContent>
                  {FOLDER_TYPES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0 border-border/50"
                onClick={() => setShowCustomFolder(true)} aria-label="Add custom folder">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-1.5 flex-1">
              <Input
                placeholder="New folder name..."
                value={customFolder}
                onChange={(e) => setCustomFolder(e.target.value)}
                className="flex-1 h-11 rounded-xl bg-secondary/50 border-border/50"
              />
              <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0 border-border/50"
                onClick={() => { setShowCustomFolder(false); setCustomFolder(""); }} aria-label="Cancel custom folder">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Division target */}
        <Select value={selectedDivision} onValueChange={(v: any) => setSelectedDivision(v)}>
          <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-border/50">
            <SelectValue placeholder="Target Division" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All divisions (shared)</SelectItem>
            {DIVISIONS.map((d) => (
              <SelectItem key={d} value={d}>{d} only</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Row 2: Comment + File picker (multi) */}
        <div className="flex gap-3">
          <Textarea
            placeholder="Comment (optional) — display name (single file only)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="flex-1 min-h-[80px] rounded-xl bg-secondary/50 border-border/50 resize-none"
          />
          <label className="w-32 h-[80px] rounded-xl border-2 border-dashed border-border/50 bg-secondary/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all shrink-0">
            <Upload className="h-5 w-5 text-muted-foreground mb-1" />
            <span className="text-[10px] text-muted-foreground font-medium text-center px-1">
              {selectedFiles.length > 0 ? `${selectedFiles.length} file(s)` : "Pick files"}
            </span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
            />
          </label>
        </div>

        {/* Selected files list */}
        {selectedFiles.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {selectedFiles.map((f, i) => {
              const queueItem = uploadQueue[i];
              return (
                <div key={i} className="flex items-center gap-2 bg-primary/5 rounded-lg px-3 py-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                  <p className="text-xs text-foreground font-medium truncate flex-1">{f.name}</p>
                  <span className="text-[10px] text-muted-foreground">{formatSize(f.size)}</span>
                  {queueItem?.status === "done" && <Check className="h-3 w-3 text-emerald-500" />}
                  {queueItem?.status === "error" && <AlertCircle className="h-3 w-3 text-rose-500" />}
                  {!uploading && (
                    <button onClick={() => setSelectedFiles((p) => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Upload button */}
        <Button
          onClick={handleUpload}
          disabled={uploading || selectedFiles.length === 0 || !selectedSubject || (!selectedFolder && !customFolder)}
          className="w-full h-11 rounded-xl font-semibold gap-2"
        >
          {uploading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Uploading {uploadQueue.filter((q) => q.status !== "pending").length}/{selectedFiles.length}...</>
          ) : (
            <><Upload className="h-4 w-4" /> Upload {selectedFiles.length || ""} File{selectedFiles.length === 1 ? "" : "s"}</>
          )}
        </Button>
      </div>

      {/* Uploaded Files List */}
      {selectedSubject && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {selectedSubject} Files
            </h3>
          </div>

          {loadingFiles ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : files.length > 0 ? (
            <>
              {/* Bulk toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  placeholder="Search files..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 text-xs flex-1 min-w-[120px]"
                />
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Newest</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="size">Size</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => {
                  if (selectedIds.size === files.length) setSelectedIds(new Set());
                  else setSelectedIds(new Set(files.map((f) => f.id)));
                }}>
                  {selectedIds.size === files.length ? "None" : "All"}
                </Button>
              </div>
              {selectedIds.size > 0 && (
                <div className="sticky top-0 z-10 glass rounded-xl p-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold flex-1">{selectedIds.size} selected</span>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleBulkDownload} disabled={bulkBusy}>
                    <Download className="h-3 w-3" /> Download
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setMoveSubject(selectedSubject); setMoveFolder(""); setMoveOpen(true); }} disabled={bulkBusy}>
                    <FolderInput className="h-3 w-3" /> Move
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive" onClick={handleBulkDelete} disabled={bulkBusy}>
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                {[...files]
                  .filter((f) => !search.trim() || f.file_name.toLowerCase().includes(search.toLowerCase()))
                  .sort((a, b) => {
                    if (sortBy === "name") return a.file_name.localeCompare(b.file_name);
                    if (sortBy === "size") return (b.file_size || 0) - (a.file_size || 0);
                    return b.created_at.localeCompare(a.created_at);
                  })
                  .map((file) => {
                  const checked = selectedIds.has(file.id);
                  return (
                    <div key={file.id} className={`glass rounded-xl p-3 flex items-center gap-3 ${checked ? "ring-2 ring-primary/40" : ""}`}>
                      <button onClick={() => toggleSelect(file.id)} className="shrink-0">
                        {checked ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                      </button>
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{file.file_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {file.folder_type} • {file.division || "All"} • {formatSize(file.file_size)} • {new Date(file.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg hover:bg-destructive/10 shrink-0"
                        onClick={() => handleDelete(file)}
                        disabled={deletingId === file.id}
                        aria-label="Delete file"
                      >
                        {deletingId === file.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-center text-muted-foreground py-6">No files uploaded for {selectedSubject} yet</p>
          )}
        </div>
      )}

      {/* Bulk move dialog */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Move {selectedIds.size} file(s)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={moveSubject} onValueChange={setMoveSubject}>
              <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>{uploadableSubjects.map((s) => <SelectItem key={s.code} value={s.code}>{s.code}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={moveFolder} onValueChange={setMoveFolder}>
              <SelectTrigger><SelectValue placeholder="Folder" /></SelectTrigger>
              <SelectContent>{FOLDER_TYPES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoveOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkMove} disabled={!moveSubject || !moveFolder || bulkBusy}>
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
