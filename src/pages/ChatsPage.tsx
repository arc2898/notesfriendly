import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Send, ArrowLeft, MessageCircle, ImagePlus, X, Pencil, Trash2, Reply, Check, CheckCheck, Paperclip, MoreVertical, Users, FilePlus2, Loader2, Paintbrush } from "lucide-react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import GroupChats from "@/components/GroupChats";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useChatTheme, resolveWallpaperBackground, bubbleShapeClasses } from "@/hooks/useChatTheme";
import { ChatCustomizeSheet } from "@/components/ChatCustomizeSheet";
import AutoResizeTextarea from "@/components/AutoResizeTextarea";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useLongPress } from "@/hooks/useLongPress";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import ChatListSkeleton from "@/components/ChatListSkeleton";
import PinchZoomImage from "@/components/PinchZoomImage";
import {
  AttachmentPreview,
  ChatAttachment,
  FileMessageCard,
  FileMessagePlaceholder,
  fileUploadAccept,
  uploadChatAttachment,
  validateFile,
} from "@/components/ChatAttachment";
import ThreadSheet from "@/components/ThreadSheet";
import ReactionBar from "@/components/ReactionBar";
import { useMessageReactions } from "@/hooks/useMessageReactions";

interface ChatUser {
  id: string;
  student_id: string;
  division: string;
  name: string;
  avatar_url: string | null;
}

interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string | null;
  text: string;
  image_url?: string | null;
  reply_to_id?: string | null;
  edited_at?: string | null;
  is_read?: boolean;
  deleted_at?: string | null;
  created_at: string;
  attachment_id?: string | null;
  group_id?: string | null;
}

interface MessageRowProps {
  isMe: boolean;
  isFirstInGroup: boolean;
  onLongPress: () => void;
  onSwipeReply: () => void;
  children: React.ReactNode;
}
function MessageRow({ isMe, isFirstInGroup, onLongPress, onSwipeReply, children }: MessageRowProps) {
  const lp = useLongPress(onLongPress);
  const x = useMotionValue(0);
  // Reply icon opacity grows as the user swipes
  const replyOpacity = useTransform(x, isMe ? [-80, -20, 0] : [0, 20, 80], isMe ? [1, 0, 0] : [0, 0, 1]);
  const replyScale = useTransform(x, isMe ? [-80, 0] : [0, 80], isMe ? [1, 0.6] : [0.6, 1]);

  return (
    <div className={`relative ${isFirstInGroup ? "mt-3" : "mt-0.5"}`}>
      {/* Swipe-to-reply icon (peeks out behind the bubble) */}
      <motion.div
        style={{ opacity: replyOpacity, scale: replyScale }}
        className={`absolute top-1/2 -translate-y-1/2 ${isMe ? "right-2" : "left-2"} pointer-events-none`}
      >
        <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
          <Reply className="h-4 w-4 text-primary" />
        </div>
      </motion.div>
      <motion.div
        drag="x"
        dragConstraints={{ left: isMe ? -80 : 0, right: isMe ? 0 : 80 }}
        dragElastic={0.18}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={(_, info) => {
          const triggered = isMe ? info.offset.x < -60 : info.offset.x > 60;
          if (triggered) onSwipeReply();
          animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
        }}
        className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"} group select-none touch-pan-y`}
        {...lp}
      >
        {children}
      </motion.div>
    </div>
  );
}

export default function ChatsPage() {
  const { user } = useAuth();
  const { theme: appTheme } = useTheme();
  const { theme: chatTheme } = useChatTheme();
  const [showCustomize, setShowCustomize] = useState(false);
  const wallpaperBg = useMemo(
    () => resolveWallpaperBackground(chatTheme, appTheme === "dark"),
    [chatTheme, appTheme]
  );
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [chatTab, setChatTab] = useState<"dms" | "groups">("dms");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [activeDivision, setActiveDivision] = useState<"CS" | "BS" | "IT">(user?.division || "CS");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [signedImageUrls, setSignedImageUrls] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileAttachInputRef = useRef<HTMLInputElement>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, ChatAttachment>>({});
  const [actionSheetMsg, setActionSheetMsg] = useState<Message | null>(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [threadRoot, setThreadRoot] = useState<Message | null>(null);

  // Reply counts (children) for current conversation
  const replyCounts = useMemo(() => {
    const map: Record<string, number> = {};
    messages.forEach((m) => {
      if (m.reply_to_id) map[m.reply_to_id] = (map[m.reply_to_id] || 0) + 1;
    });
    return map;
  }, [messages]);

  const visibleMessageIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const reactions = useMessageReactions(visibleMessageIds);

  // Auto-open conversation from search palette (?messageId=...&with=<userId>)
  useEffect(() => {
    const withId = searchParams.get("with");
    const msgId = searchParams.get("messageId");
    if (!withId || !allUsers.length) return;
    const u = allUsers.find((x) => x.id === withId);
    if (u && (!selectedUser || selectedUser.id !== u.id)) setSelectedUser(u);
    if (msgId) {
      setHighlightId(msgId);
      setTimeout(() => {
        const el = document.querySelector(`[data-msg-id="${msgId}"]`) as HTMLElement | null;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
      setTimeout(() => setHighlightId(null), 2000);
      // Strip params after handling
      const next = new URLSearchParams(searchParams);
      next.delete("messageId");
      next.delete("with");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, allUsers, selectedUser, setSearchParams]);

  // Resolve chat image path to a signed URL
  const resolveImageUrl = async (imageUrl: string): Promise<string> => {
    if (imageUrl.startsWith("http")) return imageUrl;
    const { data } = await supabase.storage.from("chat-images").createSignedUrl(imageUrl, 3600);
    return data?.signedUrl || "";
  };

  // Resolve signed URLs for all messages with images
  useEffect(() => {
    const resolve = async () => {
      const newUrls: Record<string, string> = {};
      const toResolve = messages.filter((m) => m.image_url && !signedImageUrls[m.id]);
      await Promise.all(
        toResolve.map(async (m) => {
          newUrls[m.id] = await resolveImageUrl(m.image_url!);
        })
      );
      if (Object.keys(newUrls).length > 0) {
        setSignedImageUrls((prev) => ({ ...prev, ...newUrls }));
      }
    };
    resolve();
  }, [messages]);

  // Fetch attachment metadata for messages with attachment_id
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

  // Fetch all profiles (except self)
  const fetchUsers = useCallback(async () => {
    if (!user?.id) return;
    setUsersLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, student_id, division, name, avatar_url")
      .neq("student_id", user.id);
    if (data) setAllUsers(data as ChatUser[]);
    setUsersLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Fetch all user's DM messages (exclude group chats)
  const fetchAllMessages = useCallback(async () => {
    if (!user?.supabaseId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`from_user_id.eq.${user.supabaseId},to_user_id.eq.${user.supabaseId}`)
      .is("group_id", null)
      .order("created_at", { ascending: true });
    if (data) setAllMessages(data as Message[]);
  }, [user?.supabaseId]);

  useEffect(() => { fetchAllMessages(); }, [fetchAllMessages]);

  // Fetch conversation messages
  const fetchConvo = useCallback(async () => {
    if (!selectedUser || !user?.supabaseId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(from_user_id.eq.${user.supabaseId},to_user_id.eq.${selectedUser.id}),and(from_user_id.eq.${selectedUser.id},to_user_id.eq.${user.supabaseId})`
      )
      .is("group_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Message[]);
  }, [selectedUser, user?.supabaseId]);

  useEffect(() => {
    fetchConvo();
  }, [fetchConvo]);

  // Mark incoming messages as read when conversation is open
  useEffect(() => {
    if (!selectedUser || !user?.supabaseId) return;
    const unreadIds = messages
      .filter((m) => m.to_user_id === user.supabaseId && !m.is_read)
      .map((m) => m.id);
    if (unreadIds.length > 0) {
      supabase
        .from("messages")
        .update({ is_read: true })
        .in("id", unreadIds)
        .then(() => {
          setMessages((prev) => prev.map((m) => unreadIds.includes(m.id) ? { ...m, is_read: true } : m));
        });
    }
  }, [messages, selectedUser, user?.supabaseId]);

  // Realtime subscription (DMs only)
  useEffect(() => {
    if (!user?.supabaseId) return;
    const channel = supabase
      .channel("dm-messages-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as Message;
            if (newMsg.group_id) return;
            if (newMsg.from_user_id !== user.supabaseId && newMsg.to_user_id !== user.supabaseId) return;
            setAllMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
            if (
              selectedUser &&
              ((newMsg.from_user_id === user.supabaseId && newMsg.to_user_id === selectedUser.id) ||
                (newMsg.from_user_id === selectedUser.id && newMsg.to_user_id === user.supabaseId))
            ) {
              if (!newMsg.deleted_at) {
                setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
              }
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Message;
            if (updated.group_id) return;
            setMessages((prev) =>
              updated.deleted_at
                ? prev.filter((m) => m.id !== updated.id)
                : prev.map((m) => m.id === updated.id ? updated : m)
            );
            setAllMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m));
          } else if (payload.eventType === "DELETE") {
            const oldMsg = payload.old as Message;
            setMessages((prev) => prev.filter((m) => m.id !== oldMsg.id));
            setAllMessages((prev) => prev.filter((m) => m.id !== oldMsg.id));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.supabaseId, selectedUser]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Last message per user
  const lastMsgTime = useMemo(() => {
    const map: Record<string, string> = {};
    allMessages.forEach((m) => {
      if (m.deleted_at) return;
      const other = m.from_user_id === user?.supabaseId ? m.to_user_id : m.from_user_id;
      if (!map[other] || m.created_at > map[other]) {
        map[other] = m.created_at;
      }
    });
    return map;
  }, [allMessages, user?.supabaseId]);

  // Unread count per user
  const unreadCounts = useMemo(() => {
    const map: Record<string, number> = {};
    allMessages.forEach((m) => {
      if (m.to_user_id === user?.supabaseId && !m.is_read && !m.deleted_at) {
        map[m.from_user_id] = (map[m.from_user_id] || 0) + 1;
      }
    });
    return map;
  }, [allMessages, user?.supabaseId]);

  const sortedDivisionUsers = useMemo(() => {
    const divUsers = allUsers
      .filter((u) => u.division === activeDivision)
      .filter((u) =>
        u.student_id.toLowerCase().includes(search.toLowerCase()) ||
        u.name.toLowerCase().includes(search.toLowerCase())
      );

    return divUsers.sort((a, b) => {
      const aTime = lastMsgTime[a.id];
      const bTime = lastMsgTime[b.id];
      if (aTime && bTime) return bTime.localeCompare(aTime);
      if (aTime) return -1;
      if (bTime) return 1;
      return a.student_id.localeCompare(b.student_id);
    });
  }, [allUsers, activeDivision, search, lastMsgTime]);

  const getLastMessage = (userId: string) => {
    const msgs = allMessages.filter(
      (m) =>
        !m.deleted_at &&
        ((m.from_user_id === user?.supabaseId && m.to_user_id === userId) ||
        (m.from_user_id === userId && m.to_user_id === user?.supabaseId))
    );
    if (msgs.length === 0) return null;
    const last = msgs[msgs.length - 1];
    if (last.image_url) return "Image";
    if (last.attachment_id) return "File";
    return last.text;
  };

  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateFile(file);
    if (err) { toast.error(err); return; }
    setAttachmentFile(file);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  const sendMessage = async () => {
    if ((!message.trim() && !imageFile && !attachmentFile) || !user?.supabaseId || !selectedUser) return;
    setSending(true);

    const text = message.trim();
    const replyId = replyTo?.id || null;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const localImagePreview = imageFile ? URL.createObjectURL(imageFile) : null;

    // True optimistic insert — show bubble instantly
    const optimisticMsg: Message = {
      id: tempId,
      from_user_id: user.supabaseId,
      to_user_id: selectedUser.id,
      text: text || "",
      image_url: null,
      reply_to_id: replyId,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    if (localImagePreview) {
      setSignedImageUrls((prev) => ({ ...prev, [tempId]: localImagePreview }));
    }

    // Clear inputs immediately so the UI feels snappy
    setMessage("");
    setReplyTo(null);
    const pendingImage = imageFile;
    const pendingAttachment = attachmentFile;
    clearImage();
    setAttachmentFile(null);

    try {
      let imageUrl: string | null = null;
      let attachmentId: string | null = null;

      if (pendingImage) {
        const ext = pendingImage.name.split(".").pop() || "jpg";
        const path = `${user.supabaseId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("chat-images")
          .upload(path, pendingImage);
        if (uploadErr) throw uploadErr;
        imageUrl = path;
      }

      if (pendingAttachment) {
        const att = await uploadChatAttachment(pendingAttachment, user.supabaseId);
        if (!att) throw new Error("Attachment upload failed");
        attachmentId = att.id;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("messages")
        .insert({
          from_user_id: user.supabaseId,
          to_user_id: selectedUser.id,
          text: text || "",
          image_url: imageUrl,
          attachment_id: attachmentId,
          reply_to_id: replyId,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      // Swap optimistic message for the real one
      if (inserted) {
        const newMsg = inserted as Message;
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== tempId);
          return withoutTemp.some((m) => m.id === newMsg.id) ? withoutTemp : [...withoutTemp, newMsg];
        });
        setAllMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        // Move local preview URL onto the real id (if any)
        if (localImagePreview && imageUrl) {
          setSignedImageUrls((prev) => {
            const next = { ...prev };
            delete next[tempId];
            next[newMsg.id] = localImagePreview;
            return next;
          });
        }
      }

      // Create notification (fire-and-forget)
      const senderName = user.name || user.id;
      supabase.from("notifications").insert({
        user_id: selectedUser.id,
        type: "message",
        title: `New message from ${senderName}`,
        body: text || (attachmentId ? "Sent a file" : imageUrl ? "Sent an image" : ""),
        related_user_id: user.supabaseId,
      }).then(() => {});
    } catch (err: any) {
      console.error("[dm send]", err);
      // Roll back the optimistic message and restore inputs
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setSignedImageUrls((prev) => {
        const next = { ...prev };
        delete next[tempId];
        return next;
      });
      if (localImagePreview) URL.revokeObjectURL(localImagePreview);
      setMessage(text);
      if (pendingImage) {
        setImageFile(pendingImage);
        setImagePreview(URL.createObjectURL(pendingImage));
      }
      if (pendingAttachment) setAttachmentFile(pendingAttachment);
      toast.error(err?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const editMessage = async (msg: Message) => {
    setEditingMessage(msg);
    setEditText(msg.text);
  };

  const saveEdit = async () => {
    if (!editingMessage || !editText.trim()) return;
    await supabase
      .from("messages")
      .update({ text: editText.trim(), edited_at: new Date().toISOString() })
      .eq("id", editingMessage.id);
    setMessages((prev) =>
      prev.map((m) => m.id === editingMessage.id ? { ...m, text: editText.trim(), edited_at: new Date().toISOString() } : m)
    );
    setEditingMessage(null);
    setEditText("");
  };

  const deleteMessage = async (msgId: string) => {
    await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", msgId);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  };

  const getReplyPreview = (replyId: string) => {
    const original = messages.find((m) => m.id === replyId);
    if (!original) return null;
    return original;
  };

  const renderAvatar = (chatUser: ChatUser | null, size = "h-8 w-8") => {
    if (!chatUser) return null;
    if (chatUser.avatar_url) {
      return (
        <img
          src={chatUser.avatar_url}
          alt={chatUser.name}
          className={`${size} rounded-full object-cover`}
        />
      );
    }
    return (
      <div className={`${size} rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] font-bold text-primary-foreground`}>
        {chatUser.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  const currentUserAsChatUser: ChatUser | null = user ? {
    id: user.supabaseId || "",
    student_id: user.id,
    division: user.division,
    name: user.name,
    avatar_url: user.avatarUrl || null,
  } : null;

  // Image preview dialog (with pinch-to-zoom)
  const imageDialog = (
    <Dialog open={!!viewImage} onOpenChange={() => setViewImage(null)}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] p-2 bg-background/95">
        {viewImage && <PinchZoomImage src={viewImage} alt="Full size" />}
      </DialogContent>
    </Dialog>
  );

  // Edit dialog
  const editDialog = (
    <Dialog open={!!editingMessage} onOpenChange={() => setEditingMessage(null)}>
      <DialogContent className="max-w-sm">
        <div className="space-y-3">
          <h3 className="font-bold text-sm">Edit Message</h3>
          <Input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="rounded-xl"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setEditingMessage(null)}>Cancel</Button>
            <Button size="sm" onClick={saveEdit} disabled={!editText.trim()}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Long-press action sheet (mobile-friendly)
  const actionSheet = (
    <Dialog open={!!actionSheetMsg} onOpenChange={() => setActionSheetMsg(null)}>
      <DialogContent className="max-w-xs p-2 gap-0">
        {actionSheetMsg && (() => {
          const m = actionSheetMsg;
          const mIsMe = m.from_user_id === user?.supabaseId;
          return (
            <div className="flex flex-col">
              <button
                onClick={() => { setReplyTo(m); setActionSheetMsg(null); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent text-sm text-left"
              >
                <Reply className="h-4 w-4" /> Reply
              </button>
              {m.text && (
                <button
                  onClick={() => { navigator.clipboard?.writeText(m.text); toast.success("Copied"); setActionSheetMsg(null); }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent text-sm text-left"
                >
                  <Check className="h-4 w-4" /> Copy text
                </button>
              )}
              {mIsMe && m.text && (
                <button
                  onClick={() => { editMessage(m); setActionSheetMsg(null); }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent text-sm text-left"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </button>
              )}
              {mIsMe && (
                <button
                  onClick={() => { deleteMessage(m.id); setActionSheetMsg(null); }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent text-sm text-left text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              )}
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );

  if (selectedUser) {
    return (
      <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-lg mx-auto">
        {imageDialog}
        {editDialog}
        {actionSheet}
        <ThreadSheet
          open={!!threadRoot}
          onOpenChange={(o) => !o && setThreadRoot(null)}
          rootMessage={threadRoot as any}
          allMessages={messages as any}
          currentUserId={user?.supabaseId || ""}
          participantName={selectedUser.name}
        />

        {/* Header */}
        <div className="px-3 py-2.5 flex items-center gap-2 border-b border-border/50 bg-background">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedUser(null); clearImage(); setReplyTo(null); }} className="shrink-0 h-10 w-10 rounded-full" aria-label="Back to chat list">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {renderAvatar(selectedUser, "h-9 w-9")}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">{selectedUser.name}</p>
            <p className="text-[11px] text-muted-foreground">{selectedUser.student_id}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowCustomize(true)}
            className="shrink-0 h-9 w-9 rounded-full"
            aria-label="Customize chat appearance"
            title="Customize appearance"
          >
            <Paintbrush className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        <ChatCustomizeSheet open={showCustomize} onOpenChange={setShowCustomize} />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1" style={{ background: wallpaperBg }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              {renderAvatar(selectedUser, "h-16 w-16")}
              <p className="mt-3 font-semibold text-foreground">{selectedUser.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{selectedUser.student_id} · {selectedUser.division}</p>
              <p className="text-xs text-muted-foreground mt-4">Send a message to start chatting</p>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isMe = msg.from_user_id === user?.supabaseId;
            const sender = isMe ? currentUserAsChatUser : selectedUser;
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
            const showAvatar = !isMe && (!nextMsg || nextMsg.from_user_id !== msg.from_user_id);
            const isFirstInGroup = !prevMsg || prevMsg.from_user_id !== msg.from_user_id;
            const isLastInGroup = !nextMsg || nextMsg.from_user_id !== msg.from_user_id;
            const replyOriginal = msg.reply_to_id ? getReplyPreview(msg.reply_to_id) : null;

            return (
              <MessageRow key={msg.id} isMe={isMe} isFirstInGroup={isFirstInGroup} onLongPress={() => setActionSheetMsg(msg)} onSwipeReply={() => setReplyTo(msg)}>
                {/* Avatar */}
                <div className="w-7 shrink-0 flex items-end">
                  {showAvatar && !isMe && renderAvatar(sender, "h-7 w-7")}
                </div>

                {/* Message bubble */}
                <div className={`max-w-[70%] relative`}>
                  {/* Reply preview */}
                  {replyOriginal && (
                    <div className={`mb-1 px-3 py-1.5 rounded-lg bg-muted/50 border-l-2 border-primary/40 text-[11px] text-muted-foreground ${isMe ? "ml-auto" : ""}`}>
                      <span className="font-medium text-foreground/70">
                        {replyOriginal.from_user_id === user?.supabaseId ? "You" : selectedUser.name}
                      </span>
                      <p className="truncate">{replyOriginal.text || (replyOriginal.attachment_id ? "File" : "Image")}</p>
                    </div>
                  )}

                  {/* File attachment */}
                  {msg.attachment_id && (
                    <div className="mb-1">
                      {attachmentsMap[msg.attachment_id]
                        ? <FileMessageCard attachment={attachmentsMap[msg.attachment_id]} isMe={isMe} />
                        : <FileMessagePlaceholder isMe={isMe} />}
                    </div>
                  )}

                  {/* Image */}
                  {msg.image_url && (
                    signedImageUrls[msg.id] ? (
                      <button onClick={() => setViewImage(signedImageUrls[msg.id])} className="block mb-0.5">
                        <img
                          src={signedImageUrls[msg.id]}
                          alt="Shared"
                          className={`max-w-full max-h-52 object-cover cursor-pointer hover:opacity-90 transition-opacity ${bubbleShapeClasses(chatTheme.bubbleShape, isMe, isLastInGroup)}`}
                        />
                      </button>
                    ) : (
                      <div className={`mb-0.5 h-40 w-40 bg-muted/40 animate-pulse flex items-center justify-center ${bubbleShapeClasses(chatTheme.bubbleShape, isMe, isLastInGroup)}`}>
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
                      </div>
                    )
                  )}

                  {/* Text bubble */}
                  {msg.text && (
                    <div className={`px-3 py-2 break-words ${
                      isMe
                        ? `bg-primary text-primary-foreground ${bubbleShapeClasses(chatTheme.bubbleShape, true, isLastInGroup)}`
                        : `bg-secondary text-foreground ${bubbleShapeClasses(chatTheme.bubbleShape, false, isLastInGroup)}`
                    }`}>
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                    </div>
                  )}

                  {/* Meta row: time + edited + read receipt */}
                  {isLastInGroup && (
                    <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                      <span className="text-[10px] text-muted-foreground/60">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {msg.edited_at && (
                        <span className="text-[10px] text-muted-foreground/50">· edited</span>
                      )}
                      {isMe && (
                        msg.is_read
                          ? <CheckCheck className="h-3 w-3 text-primary" />
                          : <Check className="h-3 w-3 text-muted-foreground/50" />
                      )}
                    </div>
                  )}

                  {/* Reactions */}
                  <ReactionBar
                    messageId={msg.id}
                    reactions={reactions.byMessage[msg.id] || []}
                    currentUserId={user?.supabaseId || ""}
                    onToggle={(reaction) => reactions.toggle(msg.id, reaction)}
                    isMe={isMe}
                  />

                  {/* Thread pill */}
                  {replyCounts[msg.id] > 0 && (
                    <button
                      onClick={() => setThreadRoot(msg)}
                      className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 hover:bg-primary/20 text-[10px] text-primary font-semibold ${isMe ? "ml-auto" : ""}`}
                    >
                      <Reply className="h-3 w-3" /> {replyCounts[msg.id]} {replyCounts[msg.id] === 1 ? "reply" : "replies"}
                    </button>
                  )}
                  <div className={`absolute top-0 ${isMe ? "-left-8" : "-right-8"} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-7 w-7 rounded-full bg-background border border-border/50 shadow-sm flex items-center justify-center hover:bg-accent transition-colors">
                          <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isMe ? "start" : "end"} className="w-36">
                        <DropdownMenuItem onClick={() => setReplyTo(msg)} className="gap-2 text-xs">
                          <Reply className="h-3.5 w-3.5" /> Reply
                        </DropdownMenuItem>
                        {isMe && msg.text && (
                          <DropdownMenuItem onClick={() => editMessage(msg)} className="gap-2 text-xs">
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                        )}
                        {isMe && (
                          <DropdownMenuItem onClick={() => deleteMessage(msg.id)} className="gap-2 text-xs text-destructive">
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </MessageRow>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply bar */}
        {replyTo && (
          <div className="px-4 py-2 border-t border-border/30 bg-muted/30 flex items-center gap-2">
            <Reply className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-primary">
                Replying to {replyTo.from_user_id === user?.supabaseId ? "yourself" : selectedUser.name}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">{replyTo.text || "Image"}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="shrink-0">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Image preview strip */}
        {imagePreview && (
          <div className="px-4 pt-2">
            <div className="relative inline-block">
              <img src={imagePreview} alt="Preview" className="h-20 rounded-xl object-cover border border-border/50" />
              <button onClick={clearImage} className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-md">
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* File attachment preview */}
        {attachmentFile && (
          <AttachmentPreview file={attachmentFile} onClear={() => setAttachmentFile(null)} />
        )}

        {/* Input bar - Instagram style */}
        <div className="px-3 py-2 border-t border-border/50 bg-background pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          <input ref={fileAttachInputRef} type="file" accept={fileUploadAccept} className="hidden" onChange={handleAttachmentSelect} />
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileAttachInputRef.current?.click()}
              className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center hover:bg-accent active:bg-accent/70 transition-colors"
              title="Attach file (PDF, ZIP, MP4, etc.)"
            >
              <FilePlus2 className="h-5 w-5 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center hover:bg-accent active:bg-accent/70 transition-colors"
              title="Attach image"
            >
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="flex-1 relative">
              <AutoResizeTextarea
                ref={inputRef}
                placeholder="Message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onSubmit={() => sendMessage()}
                onFocus={() => {
                  // When mobile keyboard opens, scroll latest message into view
                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
                  }, 250);
                }}
                maxHeight={140}
              />
            </div>
            {(message.trim() || imageFile || attachmentFile) ? (
              <button
                type="submit"
                disabled={sending}
                aria-label="Send message"
                className="shrink-0 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            ) : null}
          </form>
        </div>
      </div>
    );
  }

  // Chat list view - Instagram style
  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{user?.name || "Messages"}</h2>
      </div>

      {/* DMs / Groups tabs */}
      <div className="px-4 pb-3 flex gap-2">
        <button
          onClick={() => setChatTab("dms")}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
            chatTab === "dms"
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageCircle className="h-4 w-4 inline mr-1.5" />
          DMs
        </button>
        <button
          onClick={() => setChatTab("groups")}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
            chatTab === "groups"
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4 inline mr-1.5" />
          Groups
        </button>
      </div>

      {chatTab === "groups" ? (
        <GroupChats />
      ) : (
      <>
      {/* Division tabs */}
      <div className="px-4 pb-3 flex gap-2">
        {(["CS", "BS", "IT"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setActiveDivision(d)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeDivision === d
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-full bg-secondary/50 border-0 text-sm"
          />
        </div>
      </div>

      {/* User list */}
      <DmListScroll
        loading={usersLoading}
        users={sortedDivisionUsers}
        onRefresh={async () => { await Promise.all([fetchUsers(), fetchAllMessages()]); }}
        onPick={setSelectedUser}
        renderAvatar={renderAvatar}
        unreadCounts={unreadCounts}
        lastMsgTime={lastMsgTime}
        getLastMessage={getLastMessage}
      />
      </>
      )}
    </div>
  );
}

interface DmListScrollProps {
  loading: boolean;
  users: ChatUser[];
  onRefresh: () => Promise<void>;
  onPick: (u: ChatUser) => void;
  renderAvatar: (u: ChatUser | null, size?: string) => React.ReactNode;
  unreadCounts: Record<string, number>;
  lastMsgTime: Record<string, string>;
  getLastMessage: (id: string) => string | null;
}
function DmListScroll({ loading, users, onRefresh, onPick, renderAvatar, unreadCounts, lastMsgTime, getLastMessage }: DmListScrollProps) {
  const { ref, pullPx, refreshing, threshold } = usePullToRefresh<HTMLDivElement>(onRefresh);
  const ready = pullPx >= threshold;

  return (
    <div
      ref={ref}
      className="flex-1 overflow-y-auto overscroll-contain"
      style={{ touchAction: "pan-y" }}
    >
      {/* Pull indicator */}
      {(pullPx > 0 || refreshing) && (
        <div
          className="flex items-center justify-center text-muted-foreground"
          style={{ height: refreshing ? 48 : Math.min(pullPx, 80) }}
        >
          <Loader2
            className={`h-5 w-5 ${refreshing || ready ? "animate-spin text-primary" : ""}`}
            style={!refreshing ? { transform: `rotate(${pullPx * 4}deg)` } : undefined}
          />
        </div>
      )}

      {loading ? (
        <ChatListSkeleton />
      ) : users.length > 0 ? (
        users.map((chatUser) => {
          const lastMsg = getLastMessage(chatUser.id);
          const unread = unreadCounts[chatUser.id] || 0;
          return (
            <button
              key={chatUser.id}
              onClick={() => onPick(chatUser)}
              className="w-full px-4 py-3 flex items-center gap-3 min-h-[64px] hover:bg-accent/30 active:bg-accent/50 transition-colors text-left"
            >
              <div className="relative shrink-0">
                {renderAvatar(chatUser, "h-14 w-14")}
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-5 w-5 bg-primary rounded-full text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm ${unread > 0 ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
                    {chatUser.name}
                  </p>
                  {lastMsgTime[chatUser.id] && (
                    <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                      {formatTime(lastMsgTime[chatUser.id])}
                    </span>
                  )}
                </div>
                <p className={`text-xs truncate mt-0.5 ${unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {lastMsg || chatUser.student_id}
                </p>
              </div>
            </button>
          );
        })
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full border-2 border-muted-foreground/20 flex items-center justify-center mb-4">
            <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No students found</p>
          <p className="text-xs text-muted-foreground">Try a different search or division</p>
        </div>
      )}
    </div>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
