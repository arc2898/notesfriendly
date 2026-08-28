import { useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { User, Lock, IdCard, Save, Moon, Sun, Link as LinkIcon, Paintbrush, Upload, Loader2, GraduationCap, Bell } from "lucide-react";
import { toast } from "sonner";
import { ChatCustomizeSheet } from "@/components/ChatCustomizeSheet";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { CAREER_GOALS } from "@/data/learningContent";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const TARGET_AVATAR_SIZE = 512;

async function downscaleImage(file: File, max: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b || file), "image/jpeg", 0.9);
  });
}

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { prefs, update: updatePrefs } = useUserPreferences();
  const push = usePushNotifications();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [savingBio, setSavingBio] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showChatCustomize, setShowChatCustomize] = useState(false);

  const handleSaveName = async () => {
    if (!name.trim()) return;
    await updateProfile({ name: name.trim() });
    toast.success("Name updated");
  };

  const handleSaveBio = async () => {
    if (bio.length > 280) {
      toast.error("Bio must be 280 characters or less");
      return;
    }
    setSavingBio(true);
    await updateProfile({ bio });
    setSavingBio(false);
    toast.success("Bio saved");
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (newPassword.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    const padded = newPassword + "_nf2026!";
    const { error } = await supabase.auth.updateUser({ password: padded });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password changed");
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    await updateProfile({ avatarUrl: urlInput.trim() });
    setAvatarUrl(urlInput.trim());
    setShowUrlInput(false);
    setUrlInput("");
    toast.success("Profile picture updated");
  };

  const handleDeviceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user?.supabaseId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image must be 5 MB or less");
      return;
    }
    setUploading(true);
    try {
      const blob = await downscaleImage(file, TARGET_AVATAR_SIZE);
      const path = `${user.supabaseId}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = data.publicUrl;
      await updateProfile({ avatarUrl: url });
      setAvatarUrl(url);
      toast.success("Profile picture updated");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    await updateProfile({ avatarUrl: "" });
    setAvatarUrl("");
    toast.success("Profile picture removed");
  };

  return (
    <div className="p-4 space-y-6 fade-in max-w-lg mx-auto">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground">Profile</h2>
        <p className="text-sm text-muted-foreground">Manage your account</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative group">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              className="h-16 w-16 rounded-2xl object-cover"
              onError={() => { setAvatarUrl(""); updateProfile({ avatarUrl: "" }); }}
            />
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="font-bold text-lg text-foreground">{user?.name}</p>
          <p className="text-sm text-muted-foreground">{user?.division} &middot; {user?.role}</p>
          <div className="flex flex-wrap gap-3 mt-1.5">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-[10px] text-primary font-semibold flex items-center gap-0.5 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {uploading ? "Uploading" : "Upload"}
            </button>
            <button
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="text-[10px] text-primary font-semibold flex items-center gap-0.5"
            >
              <LinkIcon className="h-3 w-3" /> URL
            </button>
            {avatarUrl && (
              <button onClick={removeAvatar} className="text-[10px] text-destructive font-semibold">Remove</button>
            )}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleDeviceUpload} />
      </div>

      {showUrlInput && (
        <div className="glass rounded-xl p-3 flex gap-2">
          <Input
            placeholder="Paste image URL..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="h-9 text-xs rounded-lg bg-secondary/50 border-border/50"
          />
          <Button size="sm" onClick={handleUrlSubmit} className="h-9 rounded-lg text-xs">Set</Button>
        </div>
      )}

      {/* Bio */}
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <User className="h-4 w-4 text-primary" /> Bio <span className="text-xs text-muted-foreground font-normal">(optional)</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{bio.length}/280</span>
        </div>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 280))}
          placeholder="Tell us a bit about yourself..."
          className="min-h-[80px] rounded-lg bg-secondary/50 border-border/50 resize-none text-sm"
        />
        <Button size="sm" onClick={handleSaveBio} disabled={savingBio} className="h-9 rounded-lg gap-1 ml-auto block">
          <Save className="h-3.5 w-3.5 inline mr-1" /> {savingBio ? "Saving" : "Save bio"}
        </Button>
      </div>

      {/* Dark Mode */}
      <div className="glass rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {theme === "dark" ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
          <div>
            <p className="text-sm font-medium text-foreground">Dark Mode</p>
            <p className="text-xs text-muted-foreground">{theme === "dark" ? "On" : "Off"}</p>
          </div>
        </div>
        <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
      </div>

      {/* Browser notifications */}
      {push.supported && (
        <div className="glass rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Browser notifications</p>
              <p className="text-xs text-muted-foreground">
                {push.permission === "denied"
                  ? "Blocked in browser settings"
                  : push.enabled
                  ? "Messages and replies"
                  : "Off"}
              </p>
            </div>
          </div>
          <Switch
            checked={push.enabled}
            disabled={push.permission === "denied"}
            onCheckedChange={async (v) => {
              if (v) {
                const ok = await push.enable();
                if (!ok) toast.error("Permission denied");
                else toast.success("Notifications on");
              } else {
                await push.disable();
                toast("Notifications off");
              }
            }}
          />
        </div>
      )}

      <button
        onClick={() => setShowChatCustomize(true)}
        className="w-full glass rounded-xl p-4 flex items-center justify-between hover:bg-accent/30 active:bg-accent/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Paintbrush className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Chat appearance</p>
            <p className="text-xs text-muted-foreground">Wallpaper &amp; bubble style</p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">Customize</span>
      </button>
      <ChatCustomizeSheet open={showChatCustomize} onOpenChange={setShowChatCustomize} />

      {/* Career Goal */}
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <GraduationCap className="h-4 w-4 text-primary" /> Career Goal
          <span className="text-xs text-muted-foreground font-normal">(Learning Hub)</span>
        </div>
        <Select
          value={prefs.career_goal ?? ""}
          onValueChange={(v) => {
            updatePrefs({ career_goal: v || null });
            toast.success("Career goal updated");
          }}
        >
          <SelectTrigger className="h-10 rounded-lg bg-secondary/50 border-border/50">
            <SelectValue placeholder="Select a path..." />
          </SelectTrigger>
          <SelectContent>
            {CAREER_GOALS.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Register No */}
      <div className="glass rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IdCard className="h-4 w-4" /><span>Register Number</span>
        </div>
        <p className="text-sm font-semibold text-foreground">{user?.regNo}</p>
        <p className="text-xs text-muted-foreground">Cannot be changed</p>
      </div>

      {/* Name */}
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <User className="h-4 w-4 text-primary" /> Display Name
        </div>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 h-10 rounded-lg bg-secondary/50 border-border/50"
          />
          <Button size="sm" onClick={handleSaveName} className="h-10 rounded-lg gap-1">
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </div>

      {/* Password */}
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Lock className="h-4 w-4 text-primary" /> Change Password
        </div>
        <Input
          type="password"
          placeholder="New password (min 4 characters)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="h-10 rounded-lg bg-secondary/50 border-border/50"
        />
        <Input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="h-10 rounded-lg bg-secondary/50 border-border/50"
        />
        <Button onClick={handleChangePassword} className="w-full h-10 rounded-lg" disabled={!newPassword}>
          Update Password
        </Button>
      </div>
    </div>
  );
}
