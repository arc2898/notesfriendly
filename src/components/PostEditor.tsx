import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Image as ImageIcon, X, Bold, Italic, Code, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  onSubmit: (text: string, imagePath: string | null) => Promise<void> | void;
  placeholder?: string;
  submitLabel?: string;
}

interface MentionMatch {
  start: number;
  query: string;
}

interface MentionItem {
  id: string;
  student_id: string;
  name: string;
}

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIM = 1600;

async function downscale(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const ratio = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * ratio);
  const h = Math.round(bmp.height * ratio);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bmp, 0, 0, w, h);
  return new Promise<Blob>((res) => c.toBlob((b) => res(b || file), "image/jpeg", 0.85));
}

function findMention(text: string, caret: number): MentionMatch | null {
  const before = text.slice(0, caret);
  const m = /(?:^|\s)@(\w{0,20})$/.exec(before);
  if (!m) return null;
  return { start: caret - m[1].length - 1, query: m[1] };
}

export function PostEditor({ onSubmit, placeholder = "Share something...", submitLabel = "Post" }: Props) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mention, setMention] = useState<MentionMatch | null>(null);
  const [suggestions, setSuggestions] = useState<MentionItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Debounced mention lookup
  useEffect(() => {
    if (!mention) { setSuggestions([]); return; }
    const q = mention.query;
    const t = setTimeout(async () => {
      const query = supabase
        .from("profiles")
        .select("id, student_id, name")
        .limit(6);
      const { data } = q.length
        ? await query.or(`name.ilike.%${q}%,student_id.ilike.%${q}%`)
        : await query;
      setSuggestions((data as MentionItem[]) || []);
    }, 150);
    return () => clearTimeout(t);
  }, [mention?.query]);

  const wrap = (left: string, right: string = left) => {
    const el = taRef.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const sel = text.slice(start, end) || "text";
    const next = text.slice(0, start) + left + sel + right + text.slice(end);
    setText(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + left.length, start + left.length + sel.length);
    }, 0);
  };

  const onTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value.slice(0, 4000);
    setText(v);
    setMention(findMention(v, e.target.selectionStart));
  };

  const insertMention = (item: MentionItem) => {
    if (!mention || !taRef.current) return;
    const token = `@${item.student_id} `;
    const next = text.slice(0, mention.start) + token + text.slice(taRef.current.selectionStart);
    setText(next);
    setMention(null);
    setSuggestions([]);
    const pos = mention.start + token.length;
    setTimeout(() => {
      taRef.current?.focus();
      taRef.current?.setSelectionRange(pos, pos);
    }, 0);
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user?.supabaseId) return;
    if (!file.type.startsWith("image/")) return toast.error("Pick an image");
    if (file.size > MAX_BYTES) return toast.error("Image must be 5 MB or less");
    setUploading(true);
    try {
      const blob = await downscale(file);
      const path = `posts/${user.supabaseId}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("chat-images").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (error) throw error;
      setImagePath(path);
      const { data } = await supabase.storage.from("chat-images").createSignedUrl(path, 600);
      setImagePreview(data?.signedUrl || null);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async () => {
    if (imagePath) await supabase.storage.from("chat-images").remove([imagePath]);
    setImagePath(null);
    setImagePreview(null);
  };

  const handleSubmit = async () => {
    if (!text.trim() && !imagePath) return;
    setSubmitting(true);
    try {
      await onSubmit(text.trim(), imagePath);
      setText("");
      setImagePath(null);
      setImagePreview(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-3 space-y-2.5 relative">
      <div className="flex items-center gap-1">
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => wrap("**")} aria-label="Bold">
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => wrap("_")} aria-label="Italic">
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => wrap("`")} aria-label="Inline code">
          <Code className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Attach image"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
        </Button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
      </div>
      <Textarea
        ref={taRef}
        value={text}
        onChange={onTextChange}
        onKeyUp={(e) => setMention(findMention(text, (e.target as HTMLTextAreaElement).selectionStart))}
        onBlur={() => setTimeout(() => setMention(null), 150)}
        placeholder={placeholder}
        className="min-h-[80px] rounded-xl bg-secondary/50 border-border/50 resize-none text-sm"
      />
      {mention && suggestions.length > 0 && (
        <div className="absolute left-3 right-3 z-20 glass rounded-xl border border-border/50 shadow-lg max-h-56 overflow-auto">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertMention(s); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/40 text-sm"
            >
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                {(s.name || s.student_id).slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-foreground">{s.name || s.student_id}</p>
                <p className="truncate text-[10px] text-muted-foreground">@{s.student_id}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {imagePreview && (
        <div className="relative rounded-xl overflow-hidden">
          <img src={imagePreview} alt="" className="w-full max-h-64 object-cover" />
          <button
            type="button"
            onClick={removeImage}
            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center"
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          Markdown &middot; @mentions &middot; {text.length}/4000
        </span>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={submitting || (!text.trim() && !imagePath)}
          className="rounded-lg gap-1.5"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
