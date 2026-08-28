import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import {
  WALLPAPER_PRESETS,
  SOLID_COLORS,
  useChatTheme,
  resolveWallpaperBackground,
  type BubbleShape,
} from "@/hooks/useChatTheme";
import { Check, Paintbrush, RotateCcw, Upload, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ChatCustomizeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHAPES: { id: BubbleShape; name: string; sample: string }[] = [
  { id: "rounded", name: "Rounded", sample: "rounded-2xl rounded-br-md" },
  { id: "square", name: "Square", sample: "rounded-md" },
  { id: "minimal", name: "Minimal", sample: "rounded-2xl rounded-br-sm" },
];

const MAX_WALLPAPER_BYTES = 5 * 1024 * 1024;

export function ChatCustomizeSheet({ open, onOpenChange }: ChatCustomizeSheetProps) {
  const { theme: chatTheme, setTheme, reset } = useChatTheme();
  const { theme: appTheme } = useTheme();
  const { user } = useAuth();
  const isDark = appTheme === "dark";
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUploadWallpaper = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user?.supabaseId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > MAX_WALLPAPER_BYTES) {
      toast.error("Image must be 5 MB or less");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.supabaseId}/wallpaper-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-wallpapers")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("chat-wallpapers").getPublicUrl(path);
      setTheme({ wallpaperKind: "custom", wallpaperId: "custom", customUrl: data.publicUrl });
      toast.success("Wallpaper updated");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const clearCustom = () => {
    setTheme({ wallpaperKind: "preset", wallpaperId: "default", customUrl: undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-5 pt-5 pb-3 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Paintbrush className="h-4 w-4 text-primary" />
            Chat appearance
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Applies to all your conversations on this device.
          </p>
        </div>

        <div className="px-5 py-4 space-y-6">
          {/* Wallpapers */}
          <section>
            <h3 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
              Wallpaper
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {WALLPAPER_PRESETS.map((preset) => {
                const selected =
                  chatTheme.wallpaperKind === "preset" && chatTheme.wallpaperId === preset.id;
                const bg = isDark && preset.darkValue ? preset.darkValue : preset.value;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      setTheme({ wallpaperKind: "preset", wallpaperId: preset.id })
                    }
                    className={`relative aspect-square rounded-xl border-2 overflow-hidden transition-all ${
                      selected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border/50 hover:border-border"
                    }`}
                    style={{ background: bg }}
                    aria-label={preset.name}
                  >
                    {selected && (
                      <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    <span className="absolute bottom-1 left-1.5 right-1.5 text-[10px] font-medium text-foreground/80 drop-shadow-sm bg-background/60 backdrop-blur-sm rounded px-1 py-0.5 text-center truncate">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Custom wallpaper from device */}
          <section>
            <h3 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
              From your device
            </h3>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUploadWallpaper}
            />
            <div className="flex items-center gap-3">
              {chatTheme.wallpaperKind === "custom" && chatTheme.customUrl ? (
                <button
                  type="button"
                  onClick={() =>
                    setTheme({
                      wallpaperKind: "custom",
                      wallpaperId: "custom",
                      customUrl: chatTheme.customUrl,
                    })
                  }
                  className="relative h-20 w-20 rounded-xl border-2 border-primary ring-2 ring-primary/30 overflow-hidden shrink-0"
                  style={{ background: `center / cover no-repeat url("${chatTheme.customUrl}")` }}
                  aria-label="Current custom wallpaper"
                >
                  <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="h-3 w-3" />
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="h-20 w-20 rounded-xl border-2 border-dashed border-border/60 bg-secondary/30 flex items-center justify-center text-muted-foreground hover:border-primary/40 transition-colors shrink-0"
                  aria-label="Upload wallpaper"
                >
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                </button>
              )}
              <div className="flex-1 space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Pick any photo from your device.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="h-8 text-xs gap-1"
                  >
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {chatTheme.wallpaperKind === "custom" ? "Replace" : "Upload"}
                  </Button>
                  {chatTheme.wallpaperKind === "custom" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearCustom}
                      className="h-8 text-xs gap-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Solid colors */}
          <section>
            <h3 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
              Solid color
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {SOLID_COLORS.map((color) => {
                const selected =
                  chatTheme.wallpaperKind === "color" && chatTheme.wallpaperId === color.id;
                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() =>
                      setTheme({ wallpaperKind: "color", wallpaperId: color.id })
                    }
                    className={`relative aspect-square rounded-xl border-2 transition-all ${
                      selected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border/50 hover:border-border"
                    }`}
                    style={{ background: `hsl(${color.hsl})` }}
                    aria-label={color.name}
                  >
                    {selected && (
                      <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Bubble shape */}
          <section>
            <h3 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
              Bubble shape
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {SHAPES.map((shape) => {
                const selected = chatTheme.bubbleShape === shape.id;
                return (
                  <button
                    key={shape.id}
                    type="button"
                    onClick={() => setTheme({ bubbleShape: shape.id })}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-border bg-secondary/20"
                    }`}
                  >
                    <div
                      className={`h-7 w-14 bg-primary text-primary-foreground ${shape.sample} flex items-center justify-center text-[9px]`}
                    >
                      Hi
                    </div>
                    <span className="text-[11px] font-medium text-foreground">{shape.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Live preview */}
          <section>
            <h3 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
              Preview
            </h3>
            <div
              className="rounded-xl border border-border/50 p-3 space-y-1.5 min-h-[120px]"
              style={{ background: resolveWallpaperBackground(chatTheme, isDark) }}
            >
              <div className="flex">
                <div
                  className={`max-w-[70%] px-3 py-2 bg-secondary text-foreground text-[13px] ${
                    SHAPES.find((s) => s.id === chatTheme.bubbleShape)?.sample
                  }`}
                >
                  Hey, how's it going?
                </div>
              </div>
              <div className="flex justify-end">
                <div
                  className={`max-w-[70%] px-3 py-2 bg-primary text-primary-foreground text-[13px] ${
                    SHAPES.find((s) => s.id === chatTheme.bubbleShape)?.sample
                  }`}
                >
                  Looking great!
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 bg-background/95 backdrop-blur px-5 py-3 border-t border-border/50 flex justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-xs">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
