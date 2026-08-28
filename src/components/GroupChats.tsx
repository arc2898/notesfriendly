import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ArrowLeft, Plus, Send, Users, X, UserPlus, LogOut, Search, Loader2, MoreVertical, Trash2, FilePlus2, Paintbrush } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useChatTheme, resolveWallpaperBackground, bubbleShapeClasses } from "@/hooks/useChatTheme";
import { ChatCustomizeSheet } from "@/components/ChatCustomizeSheet";
import AutoResizeTextarea from "@/components/AutoResizeTextarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AttachmentPreview,
  ChatAttachment,
  FileMessageCard,
  FileMessagePlaceholder,
  fileUploadAccept,
  uploadChatAttachment,
  validateFile,
} from "@/components/ChatAttachment";

interface ChatGroup {
  id: string;
  name: string;
  created_by: string;
  avatar_url: string | null;
  created_at: string;
}

interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  profile?: { student_id: string; name: string; avatar_url: string | null };
}

interface GroupMessage {
  id: string;
  from_user_id: string;
  text: string;
  group_id: string;
  created_at: string;
  image_url?: string | null;
  attachment_id?: string | null;
}

interface ProfileBasic {
  id: string;
  student_id: string;
  name: string;
  avatar_url: string | null;
  division: string;
}

export default function GroupChats() {
  const { user } = useAuth();
  const { theme: appTheme } = useTheme();
  const { theme: chatTheme } = useChatTheme();
  const [showCustomize, setShowCustomize] = useState(false);
  const wallpaperBg = useMemo(
    () => resolveWallpaperBackground(chatTheme, appTheme === "dark"),
    [chatTheme, appTheme]
  );
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [allProfiles, setAllProfiles] = useState<ProfileBasic[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [profilesMap, setProfilesMap] = useState<Map<string, ProfileBasic>>(new Map());
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, ChatAttachment>>({});
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const fileAttachInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    const { data } = await supabase
      .from("chat_groups")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setGroups(data);
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  // Fetch all profiles for member management
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, student_id, name, avatar_url, division");
      if (data) {
        setAllProfiles(data);
        setProfilesMap(new Map(data.map(p => [p.id, p])));
      }
    };
    fetch();
  }, []);

  // Fetch group messages
  const fetchMessages = useCallback(async () => {
    if (!selectedGroup) return;
    const { data } = await supabase
      .from("messages")
      .select("id, from_user_id, text, group_id, created_at, image_url, attachment_id")
      .eq("group_id", selectedGroup.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
  }, [selectedGroup]);

  // Fetch members
  const fetchMembers = useCallback(async () => {
    if (!selectedGroup) return;
    const { data } = await supabase
      .from("chat_group_members")
      .select("*")
      .eq("group_id", selectedGroup.id);
    if (data) setMembers(data);
  }, [selectedGroup]);

  useEffect(() => { fetchMessages(); fetchMembers(); }, [fetchMessages, fetchMembers]);

  // Fetch attachment metadata for visible messages
  useEffect(() => {
    const ids = messages
      .map((m) => m.attachment_id)
      .filter((id): id is string => !!id && !attachmentsMap[id]);
    if (ids.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("chat_attachments")
        .select("id, file_path, file_name, file_size, mime_type, expires_at, deleted_at")
        .in("id", ids);
      if (data) {
        setAttachmentsMap((prev) => {
          const next = { ...prev };
          data.forEach((a: any) => { next[a.id] = a; });
          return next;
        });
      }
    })();
  }, [messages]);

  // Realtime - listen to all events on this group
  useEffect(() => {
    if (!selectedGroup) return;
    const channel = supabase
      .channel(`group-${selectedGroup.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "messages",
        filter: `group_id=eq.${selectedGroup.id}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newMsg = payload.new as GroupMessage;
          setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        } else if (payload.eventType === "UPDATE") {
          const u = payload.new as GroupMessage & { deleted_at?: string };
          setMessages(prev => u.deleted_at
            ? prev.filter(m => m.id !== u.id)
            : prev.map(m => m.id === u.id ? u : m));
        } else if (payload.eventType === "DELETE") {
          setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedGroup]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Last message per group - single query
  const [groupLastMessages, setGroupLastMessages] = useState<Record<string, string>>({});
  useEffect(() => {
    const fetchLast = async () => {
      if (groups.length === 0) return;
      const ids = groups.map(g => g.id);
      const { data } = await supabase
        .from("messages")
        .select("group_id, text, image_url, attachment_id, created_at")
        .in("group_id", ids)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (!data) return;
      const map: Record<string, string> = {};
      for (const m of data) {
        if (!m.group_id || map[m.group_id]) continue;
        map[m.group_id] = m.text || (m.image_url ? "Image" : m.attachment_id ? "File" : "");
      }
      setGroupLastMessages(map);
    };
    fetchLast();
  }, [groups, messages]);

  const createGroup = async () => {
    if (!newGroupName.trim() || !user?.supabaseId) return;
    setCreating(true);
    try {
      const { data: group, error } = await supabase
        .from("chat_groups")
        .insert({ name: newGroupName.trim(), created_by: user.supabaseId })
        .select()
        .single();
      if (error) throw error;

      // Add creator as member
      await supabase.from("chat_group_members").insert({
        group_id: group.id,
        user_id: user.supabaseId,
      });

      toast.success(`Group "${group.name}" created`);
      setShowCreate(false);
      setNewGroupName("");
      fetchGroups();
    } catch (err: any) {
      toast.error(err.message || "Failed to create group");
    } finally {
      setCreating(false);
    }
  };

  const addMember = async (userId: string) => {
    if (!selectedGroup) return;
    try {
      const { error } = await supabase.from("chat_group_members").insert({
        group_id: selectedGroup.id,
        user_id: userId,
      });
      if (error) throw error;
      toast.success("Member added");
      fetchMembers();
      setShowAddMember(false);
      setMemberSearch("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add member");
    }
  };

  const removeMember = async (userId: string) => {
    if (!selectedGroup) return;
    try {
      await supabase
        .from("chat_group_members")
        .delete()
        .eq("group_id", selectedGroup.id)
        .eq("user_id", userId);
      toast.success("Member removed");
      if (userId === user?.supabaseId) {
        setSelectedGroup(null);
        fetchGroups();
      } else {
        fetchMembers();
      }
    } catch {
      toast.error("Failed to remove member");
    }
  };

  const deleteGroup = async () => {
    if (!selectedGroup) return;
    try {
      await supabase.from("chat_groups").delete().eq("id", selectedGroup.id);
      toast.success("Group deleted");
      setSelectedGroup(null);
      fetchGroups();
    } catch {
      toast.error("Failed to delete group");
    }
  };

  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateFile(file);
    if (err) { toast.error(err); return; }
    setAttachmentFile(file);
  };

  const sendMessage = async () => {
    if ((!message.trim() && !attachmentFile) || !user?.supabaseId || !selectedGroup) return;
    setSending(true);

    const text = message.trim();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // True optimistic insert
    const optimisticMsg: GroupMessage = {
      id: tempId,
      from_user_id: user.supabaseId,
      text,
      group_id: selectedGroup.id,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    // Clear inputs immediately
    setMessage("");
    const pendingAttachment = attachmentFile;
    setAttachmentFile(null);

    try {
      let attachmentId: string | null = null;
      if (pendingAttachment) {
        const att = await uploadChatAttachment(pendingAttachment, user.supabaseId);
        if (!att) throw new Error("Attachment upload failed");
        attachmentId = att.id;
      }
      const { data: inserted, error: insertErr } = await supabase
        .from("messages")
        .insert({
          from_user_id: user.supabaseId,
          to_user_id: null,
          text,
          group_id: selectedGroup.id,
          attachment_id: attachmentId,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;
      if (inserted) {
        const newMsg = inserted as GroupMessage;
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== tempId);
          return withoutTemp.some((m) => m.id === newMsg.id) ? withoutTemp : [...withoutTemp, newMsg];
        });
        // Notify other group members (fire-and-forget)
        const otherMemberIds = members
          .map((m) => m.user_id)
          .filter((uid) => uid !== user.supabaseId);
        if (otherMemberIds.length > 0) {
          const senderName = user.name || user.id;
          const groupName = selectedGroup.name;
          supabase.from("notifications").insert(
            otherMemberIds.map((uid) => ({
              user_id: uid,
              type: "group_message",
              title: `${senderName} in ${groupName}`,
              body: text || (attachmentId ? "Sent a file" : ""),
              related_user_id: user.supabaseId,
            }))
          ).then(() => {});
        }
      }
    } catch (err: any) {
      console.error("[group send]", err);
      // Roll back optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setMessage(text);
      if (pendingAttachment) setAttachmentFile(pendingAttachment);
      toast.error(err?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const isCreator = selectedGroup?.created_by === user?.supabaseId;
  const memberIds = new Set(members.map(m => m.user_id));

  const filteredAddProfiles = allProfiles.filter(p =>
    !memberIds.has(p.id) &&
    p.id !== user?.supabaseId &&
    (p.student_id.toLowerCase().includes(memberSearch.toLowerCase()) ||
     p.name.toLowerCase().includes(memberSearch.toLowerCase()))
  );

  const renderAvatar = (name: string, avatarUrl?: string | null, size = "h-10 w-10") => {
    if (avatarUrl) {
      return <img src={avatarUrl} alt={name} className={`${size} rounded-full object-cover`} />;
    }
    return (
      <div className={`${size} rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-primary-foreground`}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
  };

  // Group conversation view
  if (selectedGroup) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-3 py-2.5 flex items-center gap-3 border-b border-border/50 bg-background">
          <Button variant="ghost" size="icon" onClick={() => setSelectedGroup(null)} className="shrink-0 h-9 w-9 rounded-full" aria-label="Back to chats">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold text-primary-foreground">
            {selectedGroup.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">{selectedGroup.name}</p>
            <p className="text-[11px] text-muted-foreground">{members.length} members</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowCustomize(true)}
            className="h-9 w-9 rounded-full"
            aria-label="Customize chat appearance"
            title="Customize appearance"
          >
            <Paintbrush className="h-4 w-4 text-muted-foreground" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Group options">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowMembers(true)} className="gap-2 text-xs">
                <Users className="h-3.5 w-3.5" /> Members
              </DropdownMenuItem>
              {isCreator && (
                <DropdownMenuItem onClick={() => setShowAddMember(true)} className="gap-2 text-xs">
                  <UserPlus className="h-3.5 w-3.5" /> Add Member
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => removeMember(user?.supabaseId || "")} className="gap-2 text-xs text-destructive">
                <LogOut className="h-3.5 w-3.5" /> Leave Group
              </DropdownMenuItem>
              {isCreator && (
                <DropdownMenuItem onClick={deleteGroup} className="gap-2 text-xs text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Delete Group
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ChatCustomizeSheet open={showCustomize} onOpenChange={setShowCustomize} />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1" style={{ background: wallpaperBg }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground">{selectedGroup.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{members.length} members</p>
              <p className="text-xs text-muted-foreground mt-4">Send a message to start the conversation</p>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isMe = msg.from_user_id === user?.supabaseId;
            const profile = profilesMap.get(msg.from_user_id);
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
            const isFirstInGroup = !prevMsg || prevMsg.from_user_id !== msg.from_user_id;
            const isLastInGroup = !nextMsg || nextMsg.from_user_id !== msg.from_user_id;
            const showAvatar = !isMe && isLastInGroup;

            return (
              <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"} ${isFirstInGroup ? "mt-3" : "mt-0.5"}`}>
                <div className="w-7 shrink-0 flex items-end">
                  {showAvatar && renderAvatar(profile?.name || "?", profile?.avatar_url, "h-7 w-7")}
                </div>
                <div className="max-w-[70%]">
                  {!isMe && isFirstInGroup && (
                    <p className="text-[10px] text-primary font-medium mb-0.5 px-1">
                      {profile?.student_id || "Unknown"}
                    </p>
                  )}
                  {msg.attachment_id && (
                    <div className="mb-1">
                      {attachmentsMap[msg.attachment_id]
                        ? <FileMessageCard attachment={attachmentsMap[msg.attachment_id]} isMe={isMe} />
                        : <FileMessagePlaceholder isMe={isMe} />}
                    </div>
                  )}
                  {msg.text && (
                    <div className={`px-3 py-2 break-words ${
                      isMe
                        ? `bg-primary text-primary-foreground ${bubbleShapeClasses(chatTheme.bubbleShape, true, isLastInGroup)}`
                        : `bg-secondary text-foreground ${bubbleShapeClasses(chatTheme.bubbleShape, false, isLastInGroup)}`
                    }`}>
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                    </div>
                  )}
                  {isLastInGroup && (
                    <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                      <span className="text-[10px] text-muted-foreground/60">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Attachment preview */}
        {attachmentFile && (
          <AttachmentPreview file={attachmentFile} onClear={() => setAttachmentFile(null)} />
        )}

        {/* Input bar */}
        <div className="px-3 py-2 border-t border-border/50 bg-background pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <input ref={fileAttachInputRef} type="file" accept={fileUploadAccept} className="hidden" onChange={handleAttachmentSelect} />
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileAttachInputRef.current?.click()}
              className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center hover:bg-accent active:bg-accent/70 transition-colors"
              title="Attach file"
            >
              <FilePlus2 className="h-5 w-5 text-muted-foreground" />
            </button>
            <AutoResizeTextarea
              placeholder="Message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onSubmit={() => sendMessage()}
              onFocus={() => {
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
                }, 250);
              }}
              maxHeight={140}
              className="flex-1"
            />
            {(message.trim() || attachmentFile) && (
              <button
                type="submit"
                disabled={sending}
                aria-label="Send message"
                className="shrink-0 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            )}
          </form>
        </div>

        {/* Members dialog */}
        <Dialog open={showMembers} onOpenChange={setShowMembers}>
          <DialogContent className="max-w-sm">
            <h3 className="font-bold text-sm mb-3">Members ({members.length})</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {members.map(m => {
                const p = profilesMap.get(m.user_id);
                return (
                  <div key={m.id} className="flex items-center gap-2 p-2 rounded-xl bg-secondary/30">
                    {renderAvatar(p?.name || "?", p?.avatar_url, "h-8 w-8")}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{p?.name || "Unknown"}</p>
                      <p className="text-[10px] text-muted-foreground">{p?.student_id || ""}</p>
                    </div>
                    {selectedGroup?.created_by === m.user_id && (
                      <span className="text-[10px] text-primary font-semibold">Creator</span>
                    )}
                    {isCreator && m.user_id !== user?.supabaseId && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => removeMember(m.user_id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        {/* Add member dialog */}
        <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
          <DialogContent className="max-w-sm">
            <h3 className="font-bold text-sm mb-3">Add Member</h3>
            <Input
              placeholder="Search by name or ID..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="h-9 rounded-xl bg-secondary/50 mb-2"
            />
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {filteredAddProfiles.slice(0, 20).map(p => (
                <button key={p.id} onClick={() => addMember(p.id)}
                  className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-accent/30 transition-colors text-left">
                  {renderAvatar(p.name, p.avatar_url, "h-8 w-8")}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.student_id} · {p.division}</p>
                  </div>
                  <UserPlus className="h-4 w-4 text-primary" />
                </button>
              ))}
              {filteredAddProfiles.length === 0 && (
                <p className="text-xs text-center text-muted-foreground py-4">No users found</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Group list view
  return (
    <div className="flex flex-col h-full">
      {/* Create group button */}
      <div className="px-4 py-3">
        <Button onClick={() => setShowCreate(true)} className="w-full rounded-xl gap-2" variant="outline">
          <Plus className="h-4 w-4" /> Create Group
        </Button>
      </div>

      {/* Groups list */}
      <div className="flex-1 overflow-y-auto">
        {groups.length > 0 ? (
          groups.map(group => (
            <button
              key={group.id}
              onClick={() => setSelectedGroup(group)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-accent/30 active:bg-accent/50 transition-colors text-left"
            >
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-lg font-bold text-primary-foreground shrink-0">
                {group.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{group.name}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {groupLastMessages[group.id] || "No messages yet"}
                </p>
              </div>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No groups yet</p>
            <p className="text-xs text-muted-foreground">Create a group to start chatting</p>
          </div>
        )}
      </div>

      {/* Create group dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <h3 className="font-bold text-sm mb-3">Create Group</h3>
          <Input
            placeholder="Group name..."
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="h-10 rounded-xl bg-secondary/50"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") createGroup(); }}
          />
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={createGroup} disabled={creating || !newGroupName.trim()}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
