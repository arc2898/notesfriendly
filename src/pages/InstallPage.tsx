import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, Share, Plus, Check } from "lucide-react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPage() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      toast.success("Installing NotesFriendly");
      setInstalled(true);
    }
    setDeferred(null);
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 fade-in">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Smartphone className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Install app</h2>
          <p className="text-sm text-muted-foreground">Get NotesFriendly on your home screen</p>
        </div>
      </div>

      {installed ? (
        <div className="glass rounded-xl p-6 text-center space-y-2">
          <Check className="h-8 w-8 text-primary mx-auto" />
          <p className="font-semibold text-foreground">Already installed</p>
          <p className="text-sm text-muted-foreground">Open from your home screen.</p>
        </div>
      ) : isIOS ? (
        <div className="glass rounded-xl p-5 space-y-4">
          <p className="text-sm text-foreground font-medium">On iPhone / iPad</p>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="font-bold text-primary">1.</span>
              <span>Tap the <Share className="h-4 w-4 inline mx-1" /> Share button in Safari</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-primary">2.</span>
              <span>Scroll and choose <Plus className="h-4 w-4 inline mx-1" /> "Add to Home Screen"</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-primary">3.</span>
              <span>Tap "Add" — done.</span>
            </li>
          </ol>
        </div>
      ) : deferred ? (
        <Button onClick={install} className="w-full h-12 rounded-xl gap-2">
          <Download className="h-5 w-5" /> Install NotesFriendly
        </Button>
      ) : (
        <div className="glass rounded-xl p-5 space-y-2">
          <p className="text-sm text-foreground font-medium">Install from your browser menu</p>
          <p className="text-xs text-muted-foreground">
            Chrome / Edge: open the menu and choose "Install app" or "Add to Home Screen".
          </p>
        </div>
      )}

      <div className="glass rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-foreground">Why install?</p>
        <ul className="text-xs text-muted-foreground space-y-1.5">
          <li>• Opens fullscreen, no browser UI</li>
          <li>• Faster launches via offline cache</li>
          <li>• Browser notifications for messages and replies</li>
        </ul>
      </div>
    </div>
  );
}
