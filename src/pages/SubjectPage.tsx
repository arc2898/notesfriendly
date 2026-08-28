import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { SUBJECTS, SUBJECT_COLORS } from "@/lib/constants";
import { ArrowLeft, FileText, FlaskConical, BookOpen, ClipboardList, Download, Loader2, Eye, X, Image as ImageIcon, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Star, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useBookmarks } from "@/hooks/useBookmarks";
import { EmptyState } from "@/components/EmptyState";

interface AdminFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  folder_type: string | null;
  subject_code: string | null;
  created_at: string;
}

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];

function getFileExt(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

function isImageFile(name: string) {
  return IMAGE_EXTS.includes(getFileExt(name));
}

async function getSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from("admin-files").createSignedUrl(filePath, 3600);
  if (error || !data?.signedUrl) return "";
  return data.signedUrl;
}

export default function SubjectPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const subject = SUBJECTS.find((s) => s.code === code);
  const [files, setFiles] = useState<AdminFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<AdminFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const { log } = useActivityLog();
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const { isBookmarked, toggle: toggleBookmark, bookmarks } = useBookmarks();
  const [tab, setTab] = useState<"files" | "favorites">("files");

  // All image files for navigation
  const imageFiles = files.filter((f) => isImageFile(f.file_name));

  useEffect(() => {
    if (!subject) return;
    log("view_subject", subject.code, `/subject/${subject.code}`);

    const fetchFiles = async () => {
      setLoading(true);
      const stored = (typeof window !== "undefined" ? localStorage.getItem("god_active_division") : null) as "CS" | "BS" | "IT" | null;
      const div = (user?.role === "god" && stored) ? stored : (user?.division || "CS");
      const { data, error } = await supabase
        .from("admin_files")
        .select("*")
        .eq("subject_code", subject.code)
        .or(`division.is.null,division.eq.${div}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching files:", error);
      } else {
        const filesList = data || [];
        setFiles(filesList);
        // Generate signed URLs for image thumbnails
        const imageEntries = filesList.filter((f) => isImageFile(f.file_name));
        const urls: Record<string, string> = {};
        await Promise.all(
          imageEntries.map(async (f) => {
            urls[f.id] = await getSignedUrl(f.file_path);
          })
        );
        setSignedUrls(urls);
      }
      setLoading(false);
    };

    fetchFiles();
  }, [subject, user?.division]);

  if (!subject) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Subject not found.
        <Button variant="link" onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  // SS is posts-only subject
  if (subject.code === "SS") {
    return <Navigate to={`/posts/${subject.code}`} replace />;
  }

  const handleDownload = async (file: AdminFile) => {
    try {
      setDownloading(file.id);
      log("download_file", `${file.file_name} (${file.subject_code})`, `/subject/${code}`);

      const { data, error } = await supabase.storage
        .from("admin-files")
        .download(file.file_path);

      if (error) {
        toast.error("Failed to download file");
        return;
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Downloaded: ${file.file_name}`);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(null);
    }
  };

  const handlePreview = (file: AdminFile) => {
    log("preview_file", `${file.file_name} (${file.subject_code})`, `/subject/${code}`);

    if (isImageFile(file.file_name)) {
      setPreviewFile(file);
      setZoom(1);
      // Get a fresh signed URL for preview
      getSignedUrl(file.file_path).then(setPreviewUrl);
    } else {
      // For PDFs and other files, download and open in new tab
      supabase.storage.from("admin-files").download(file.file_path).then(({ data, error }) => {
        if (error) {
          toast.error("Failed to preview file");
          return;
        }
        const ext = getFileExt(file.file_name);
        const mimeMap: Record<string, string> = {
          pdf: "application/pdf",
          txt: "text/plain",
          doc: "application/msword",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        };
        const blob = new Blob([data], { type: mimeMap[ext] || "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      });
    }
  };

  const navigatePreview = (direction: "prev" | "next") => {
    if (!previewFile) return;
    const idx = imageFiles.findIndex((f) => f.id === previewFile.id);
    if (idx === -1) return;
    const newIdx = direction === "prev" ? idx - 1 : idx + 1;
    if (newIdx >= 0 && newIdx < imageFiles.length) {
      const nextFile = imageFiles[newIdx];
      setPreviewFile(nextFile);
      setZoom(1);
      getSignedUrl(nextFile.file_path).then(setPreviewUrl);
    }
  };

  const currentImageIndex = previewFile ? imageFiles.findIndex((f) => f.id === previewFile.id) : -1;
  const hasPrev = currentImageIndex > 0;
  const hasNext = currentImageIndex < imageFiles.length - 1;

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFolderIcon = (type: string | null) => {
    switch (type) {
      case "notes": return FileText;
      case "labs": return FlaskConical;
      case "records": return BookOpen;
      case "assignments": return ClipboardList;
      default: return FileText;
    }
  };

  const groupedFiles = files.reduce((acc, file) => {
    const type = file.folder_type || "other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(file);
    return acc;
  }, {} as Record<string, AdminFile[]>);

  const folderLabels: Record<string, string> = {
    notes: "Notes",
    labs: subject.labName || "Lab",
    records: "Records",
    assignments: "Assignments",
    other: "Other Files",
  };

  return (
    <div className="p-4 space-y-5 fade-in max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0 rounded-xl" aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${SUBJECT_COLORS[subject.code]} flex items-center justify-center shadow-lg`}>
          <BookOpen className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">{subject.code}</h2>
          <p className="text-sm text-muted-foreground">{subject.name}</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-2 rounded-xl">
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="favorites" className="gap-1.5">
            <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
            Favorites
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : files.length > 0 ? (
            <div className="space-y-4">
              {Object.entries(groupedFiles).map(([type, typeFiles]) => {
                const FolderIcon = getFolderIcon(type);
                return (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <FolderIcon className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        {folderLabels[type] || type}
                      </h3>
                      <span className="text-xs text-muted-foreground/70">({typeFiles.length})</span>
                    </div>
                    <div className="space-y-2">
                      {typeFiles.map((file) => {
                        const isImage = isImageFile(file.file_name);
                        const thumbUrl = isImage ? signedUrls[file.id] : null;
                        const starred = isBookmarked(file.file_path);
                        return (
                          <div key={file.id} className="glass rounded-xl overflow-hidden">
                            {isImage && thumbUrl && (
                              <div
                                className="w-full h-40 bg-muted/30 cursor-pointer relative group"
                                onClick={() => handlePreview(file)}
                              >
                                <img
                                  src={thumbUrl}
                                  alt={file.file_name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center">
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-full p-2">
                                    <ZoomIn className="h-5 w-5 text-foreground" />
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="p-3.5 flex items-center gap-3">
                              {!isImage && (
                                <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
                                  <FileText className="h-5 w-5 text-primary" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">{file.file_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(file.file_size)}
                                  {file.file_size ? " • " : ""}
                                  {new Date(file.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-9 w-9 rounded-lg hover:text-yellow-400 transition-all"
                                  onClick={() =>
                                    toggleBookmark({
                                      subject_code: subject.code,
                                      folder_type: file.folder_type || "other",
                                      file_name: file.file_name,
                                      file_path: file.file_path,
                                    })
                                  }
                                  aria-label={starred ? "Remove bookmark" : "Bookmark"}
                                >
                                  <Star
                                    className={`h-4 w-4 transition-colors ${
                                      starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                                    }`}
                                  />
                                </Button>
                                {!isImage && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 rounded-lg hover:bg-accent/10"
                                    onClick={() => handlePreview(file)}
                                    aria-label="Preview file"
                                  >
                                    <Eye className="h-4 w-4 text-accent" />
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-9 w-9 rounded-lg hover:bg-primary/10"
                                  onClick={() => handleDownload(file)}
                                  disabled={downloading === file.id}
                                  aria-label="Download file"
                                >
                                  {downloading === file.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Download className="h-4 w-4 text-primary" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={FolderOpen}
              title="No materials uploaded yet"
              subtitle="Admin will upload soon"
            />
          )}
        </TabsContent>

        <TabsContent value="favorites" className="mt-4">
          {bookmarks.length === 0 ? (
            <EmptyState
              icon={Star}
              title="No favorites yet"
              subtitle="Star any file to find it here across all subjects"
            />
          ) : (
            <div className="space-y-2">
              {bookmarks.map((b) => (
                <div key={b.id} className="glass rounded-xl p-3.5 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate text-foreground">{b.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.subject_code} / {b.folder_type}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-lg"
                    onClick={() =>
                      toggleBookmark({
                        subject_code: b.subject_code,
                        folder_type: b.folder_type,
                        file_name: b.file_name,
                        file_path: b.file_path,
                      })
                    }
                    aria-label="Remove bookmark"
                  >
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-lg hover:bg-primary/10"
                    onClick={async () => {
                      const { data } = await supabase.storage
                        .from("admin-files")
                        .download(b.file_path);
                      if (!data) return toast.error("Failed");
                      const url = URL.createObjectURL(data);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = b.file_name;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    aria-label="Download"
                  >
                    <Download className="h-4 w-4 text-primary" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => { setPreviewFile(null); setZoom(1); }}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] p-0 rounded-2xl overflow-hidden bg-background/95 backdrop-blur-xl border-border/50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate pr-4">{previewFile?.file_name}</p>
              {imageFiles.length > 1 && (
                <p className="text-[10px] text-muted-foreground">{currentImageIndex + 1} of {imageFiles.length}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-lg"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                disabled={zoom <= 0.5}
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-lg"
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                disabled={zoom >= 3}
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-lg"
                onClick={() => { setPreviewFile(null); setZoom(1); }}
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-center p-4 max-h-[75vh] overflow-auto relative">
            {/* Prev/Next navigation */}
            {hasPrev && (
              <button
                onClick={() => navigatePreview("prev")}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5 text-foreground" />
              </button>
            )}
            {hasNext && (
              <button
                onClick={() => navigatePreview("next")}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5 text-foreground" />
              </button>
            )}
            {previewFile && (
              <img
                src={previewUrl}
                alt={previewFile.file_name}
                className="max-w-full max-h-[70vh] object-contain rounded-lg transition-transform duration-200"
                style={{ transform: `scale(${zoom})` }}
              />
            )}
          </div>
          {/* Download from preview */}
          {previewFile && (
            <div className="px-4 pb-3 flex justify-center">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-2 text-xs"
                onClick={() => handleDownload(previewFile)}
                disabled={downloading === previewFile.id}
              >
                {downloading === previewFile.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Download
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
