import { FileText, FileArchive, Film, Music, FileImage, Download, File as FileIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChatAttachment {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  expires_at: string;
  deleted_at: string | null;
}

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB
const LARGE_THRESHOLD = 50 * 1024 * 1024; // 50 MB

const ACCEPTED_EXT = [
  "pdf", "pptx", "ppt", "doc", "docx", "xls", "xlsx", "txt", "csv",
  "zip", "7z", "rar", "tar", "gz",
  "mp4", "mov", "webm", "mkv", "avi",
  "mp3", "wav", "m4a", "ogg",
  "jpg", "jpeg", "png", "webp", "gif", "heic",
];

export const fileUploadAccept = ACCEPTED_EXT.map((e) => `.${e}`).join(",");

export function getRetentionDays(size: number): number {
  return size > LARGE_THRESHOLD ? 3 : 7;
}

export function computeExpiresAt(size: number): string {
  const days = getRetentionDays(size);
  return new Date(Date.now() + days * 86400 * 1000).toISOString();
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_SIZE) return "File too large (max 100 MB)";
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ACCEPTED_EXT.includes(ext)) return `File type .${ext} not allowed`;
  return null;
}

export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function iconFor(mime: string, name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (mime.startsWith("image/")) return <FileImage className="h-6 w-6" />;
  if (mime.startsWith("video/")) return <Film className="h-6 w-6" />;
  if (mime.startsWith("audio/")) return <Music className="h-6 w-6" />;
  if (["zip", "7z", "rar", "tar", "gz"].includes(ext)) return <FileArchive className="h-6 w-6" />;
  if (["pdf", "doc", "docx", "txt", "ppt", "pptx", "xls", "xlsx", "csv"].includes(ext)) return <FileText className="h-6 w-6" />;
  return <FileIcon className="h-6 w-6" />;
}

interface FileMessageCardProps {
  attachment: ChatAttachment;
  isMe: boolean;
}

export function FileMessageCard({ attachment, isMe }: FileMessageCardProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(true);
  const expired = !!attachment.deleted_at || new Date(attachment.expires_at) < new Date();

  useEffect(() => {
    if (expired) { setResolving(false); return; }
    let cancelled = false;
    setResolving(true);
    (async () => {
      const { data } = await supabase.storage
        .from("chat-files")
        .createSignedUrl(attachment.file_path, 3600);
      if (!cancelled) {
        if (data?.signedUrl) setSignedUrl(data.signedUrl);
        setResolving(false);
      }
    })();
    return () => { cancelled = true; };
  }, [attachment.file_path, expired]);

  const isImage = attachment.mime_type.startsWith("image/");
  const isVideo = attachment.mime_type.startsWith("video/");
  const isAudio = attachment.mime_type.startsWith("audio/");

  if (expired) {
    return (
      <div className={`px-3 py-2.5 rounded-2xl border border-dashed border-border/60 bg-muted/30 max-w-[260px] ${isMe ? "ml-auto" : ""}`}>
        <p className="text-[11px] text-muted-foreground italic">File expired</p>
        <p className="text-xs font-medium text-foreground/70 truncate">{attachment.file_name}</p>
        <p className="text-[10px] text-muted-foreground">{formatBytes(attachment.file_size)}</p>
      </div>
    );
  }

  if (isImage && signedUrl) {
    return (
      <a href={signedUrl} target="_blank" rel="noreferrer" className="block">
        <img src={signedUrl} alt={attachment.file_name} className="max-w-full max-h-52 rounded-2xl object-cover" />
      </a>
    );
  }

  if (isVideo && signedUrl) {
    return (
      <video src={signedUrl} controls className="max-w-full max-h-60 rounded-2xl bg-black" />
    );
  }

  if (isAudio && signedUrl) {
    return (
      <div className={`px-3 py-2 rounded-2xl ${isMe ? "bg-primary/15" : "bg-secondary"} max-w-[280px]`}>
        <p className="text-[11px] font-medium text-foreground truncate mb-1">{attachment.file_name}</p>
        <audio src={signedUrl} controls className="w-full h-8" />
      </div>
    );
  }

  const handleDownload = async () => {
    if (!signedUrl) return;
    setLoading(true);
    try {
      const a = document.createElement("a");
      a.href = signedUrl;
      a.download = attachment.file_name;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setLoading(false);
    }
  };

  const days = getRetentionDays(attachment.file_size);
  const daysLeft = Math.max(0, Math.ceil((new Date(attachment.expires_at).getTime() - Date.now()) / 86400000));

  return (
    <button
      onClick={handleDownload}
      disabled={!signedUrl || loading || resolving}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl max-w-[280px] text-left transition-colors disabled:opacity-60 ${
        isMe
          ? "bg-primary/15 hover:bg-primary/25 text-foreground"
          : "bg-secondary hover:bg-secondary/80 text-foreground"
      }`}
    >
      <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${isMe ? "bg-primary/20" : "bg-background/60"}`}>
        {loading || resolving ? <Loader2 className="h-5 w-5 animate-spin" /> : iconFor(attachment.mime_type, attachment.file_name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{attachment.file_name}</p>
        <p className="text-[10px] text-muted-foreground">
          {formatBytes(attachment.file_size)} · {resolving ? "preparing…" : `expires in ${daysLeft}d`}
        </p>
      </div>
      <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="sr-only">Retention: {days} days</span>
    </button>
  );
}

/** Skeleton placeholder while attachment metadata is being fetched */
export function FileMessagePlaceholder({ isMe }: { isMe: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl max-w-[280px] animate-pulse ${
      isMe ? "bg-primary/10" : "bg-secondary/70"
    }`}>
      <div className={`shrink-0 h-10 w-10 rounded-xl ${isMe ? "bg-primary/20" : "bg-background/60"}`} />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-32 bg-muted-foreground/20 rounded" />
        <div className="h-2 w-20 bg-muted-foreground/15 rounded" />
      </div>
    </div>
  );
}

interface AttachmentPreviewProps {
  file: File;
  onClear: () => void;
}

export function AttachmentPreview({ file, onClear }: AttachmentPreviewProps) {
  const days = getRetentionDays(file.size);
  return (
    <div className="px-3 pt-2">
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-secondary/60 border border-border/40">
        <div className="shrink-0 h-9 w-9 rounded-lg bg-background flex items-center justify-center">
          {iconFor(file.type, file.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate text-foreground">{file.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {formatBytes(file.size)} · expires in {days} days
          </p>
        </div>
        <button onClick={onClear} className="shrink-0 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-bold">
          ×
        </button>
      </div>
    </div>
  );
}

/** Upload helper: stores file, inserts chat_attachments row, returns row id */
export async function uploadChatAttachment(
  file: File,
  uploaderId: string
): Promise<{ id: string; file_path: string } | null> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${uploaderId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("chat-files")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) {
    console.error("upload err", upErr);
    return null;
  }

  const { data: row, error: insErr } = await supabase
    .from("chat_attachments")
    .insert({
      uploader_id: uploaderId,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || "application/octet-stream",
      expires_at: computeExpiresAt(file.size),
    })
    .select("id, file_path")
    .single();

  if (insErr || !row) {
    console.error("insert att err", insErr);
    await supabase.storage.from("chat-files").remove([path]);
    return null;
  }
  return row;
}
