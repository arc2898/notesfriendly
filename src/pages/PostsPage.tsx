import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Trash2, Pencil, CornerDownRight, X, Check, ThumbsUp, Heart, ThumbsDown, Laugh, Angry, MessageSquare, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, SUBJECT_COLORS } from "@/lib/constants";
import { toast } from "sonner";
import { PostEditor } from "@/components/PostEditor";
import { PostBody } from "@/components/PostBody";

const REACTIONS: { key: string; Icon: LucideIcon; label: string }[] = [
  { key: "like", Icon: ThumbsUp, label: "Like" },
  { key: "love", Icon: Heart, label: "Love" },
  { key: "laugh", Icon: Laugh, label: "Laugh" },
  { key: "dislike", Icon: ThumbsDown, label: "Dislike" },
  { key: "angry", Icon: Angry, label: "Angry" },
];

interface DbPost {
  id: string;
  subject_code: string;
  author_id: string;
  text: string;
  image_path: string | null;
  created_at: string;
  updated_at: string;
}

interface DbReply {
  id: string;
  post_id: string;
  parent_reply_id: string | null;
  author_id: string;
  text: string;
  created_at: string;
}

interface DbReaction {
  id: string;
  post_id: string | null;
  reply_id: string | null;
  user_id: string;
  emoji: string;
}

interface Profile {
  id: string;
  student_id: string;
  name: string;
}

export default function PostsPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const subject = SUBJECTS.find((s) => s.code === code);
  const [posts, setPosts] = useState<DbPost[]>([]);
  const [replies, setReplies] = useState<DbReply[]>([]);
  const [reactions, setReactions] = useState<DbReaction[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [replyingToReply, setReplyingToReply] = useState<string | null>(null);
  const [replyReplyText, setReplyReplyText] = useState("");

  const fetchData = useCallback(async () => {
    if (!code) return;
    const [postsRes, repliesRes, reactionsRes, profilesRes] = await Promise.all([
      supabase.from("posts").select("*").eq("subject_code", code).order("created_at", { ascending: false }),
      supabase.from("post_replies").select("*"),
      supabase.from("post_reactions").select("*"),
      supabase.from("profiles").select("id, student_id, name"),
    ]);

    if (postsRes.data) setPosts(postsRes.data as DbPost[]);
    if (repliesRes.data) setReplies(repliesRes.data as DbReply[]);
    if (reactionsRes.data) setReactions(reactionsRes.data as DbReaction[]);
    if (profilesRes.data) {
      const map: Record<string, Profile> = {};
      (profilesRes.data as Profile[]).forEach((p) => { map[p.id] = p; });
      setProfiles(map);
    }
  }, [code]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!subject || !user) return null;

  const getAuthorName = (authorId: string) => profiles[authorId]?.student_id || "Unknown";

  const addPost = async (text: string, imagePath: string | null) => {
    if (!user.supabaseId) return;
    const { error } = await supabase.from("posts").insert({
      subject_code: code!,
      author_id: user.supabaseId,
      text,
      image_path: imagePath,
    } as any);
    if (error) {
      toast.error(error.message);
      return;
    }
    fetchData();
  };

  const deletePost = async (id: string) => {
    await supabase.from("posts").delete().eq("id", id);
    fetchData();
    toast.success("Post deleted");
  };

  const editPost = async (id: string, text: string) => {
    await supabase.from("posts").update({ text, updated_at: new Date().toISOString() }).eq("id", id);
    setEditingId(null);
    fetchData();
  };

  const toggleReaction = async (postId: string | null, replyId: string | null, emoji: string) => {
    if (!user.supabaseId) return;
    const existing = reactions.find(
      (r) => r.user_id === user.supabaseId && r.emoji === emoji &&
        (postId ? r.post_id === postId : r.reply_id === replyId)
    );
    if (existing) {
      await supabase.from("post_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("post_reactions").insert({
        post_id: postId,
        reply_id: replyId,
        user_id: user.supabaseId,
        emoji,
      });
    }
    fetchData();
  };

  const addReply = async (postId: string, parentReplyId: string | null, text: string) => {
    if (!text.trim() || !user.supabaseId) return;
    await supabase.from("post_replies").insert({
      post_id: postId,
      parent_reply_id: parentReplyId,
      author_id: user.supabaseId,
      text: text.trim(),
    });
    setReplyingTo(null);
    setReplyText("");
    setReplyingToReply(null);
    setReplyReplyText("");
    fetchData();
  };

  const deleteReply = async (id: string) => {
    await supabase.from("post_replies").delete().eq("id", id);
    fetchData();
    toast.success("Deleted");
  };

  const getPostReplies = (postId: string, parentId: string | null = null): DbReply[] =>
    replies.filter((r) => r.post_id === postId && r.parent_reply_id === parentId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const getReactionCount = (postId: string | null, replyId: string | null, emoji: string) =>
    reactions.filter((r) => (postId ? r.post_id === postId : r.reply_id === replyId) && r.emoji === emoji).length;

  const hasReacted = (postId: string | null, replyId: string | null, emoji: string) =>
    reactions.some((r) => r.user_id === user.supabaseId && r.emoji === emoji &&
      (postId ? r.post_id === postId : r.reply_id === replyId));

  const renderReplies = (postId: string, parentId: string | null, depth: number) => {
    const reps = getPostReplies(postId, parentId);
    if (reps.length === 0) return null;
    return (
      <div className={`space-y-2 ${depth > 0 ? "ml-4 pl-3 border-l-2 border-border/30" : ""}`}>
        {reps.map((reply) => (
          <div key={reply.id} className="space-y-1">
            <div className="glass rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-primary">{getAuthorName(reply.author_id)}</p>
                {reply.author_id === user.supabaseId && (
                  <button onClick={() => deleteReply(reply.id)} className="p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="text-sm text-foreground">{reply.text}</p>
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {REACTIONS.map((r) => {
                  const count = getReactionCount(null, reply.id, r.key);
                  const reacted = hasReacted(null, reply.id, r.key);
                  return (
                    <button key={r.key} onClick={() => toggleReaction(null, reply.id, r.key)} aria-label={r.label}
                      className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-md transition-all ${reacted ? "bg-primary/20 text-primary" : "hover:bg-secondary/50 text-muted-foreground"}`}>
                      <r.Icon className="h-3 w-3" />{count > 0 && <span className="text-[10px]">{count}</span>}
                    </button>
                  );
                })}
                <button onClick={() => setReplyingToReply(replyingToReply === reply.id ? null : reply.id)}
                  className="text-[10px] text-primary font-semibold ml-1 flex items-center gap-0.5">
                  <CornerDownRight className="h-3 w-3" /> Reply
                </button>
              </div>
            </div>
            {replyingToReply === reply.id && (
              <div className="flex gap-1.5 ml-4">
                <Input placeholder="Reply..." value={replyReplyText} onChange={(e) => setReplyReplyText(e.target.value)}
                  className="h-8 text-xs rounded-lg bg-secondary/50 border-border/50" autoFocus />
                <Button size="sm" className="h-8 w-8 p-0 rounded-lg"
                  onClick={() => addReply(postId, reply.id, replyReplyText)}>
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            )}
            {renderReplies(postId, reply.id, depth + 1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4 fade-in max-w-lg mx-auto pb-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0" aria-label="Back to home">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${SUBJECT_COLORS[subject.code]} flex items-center justify-center`}>
          <span className="text-sm font-bold text-primary-foreground">{subject.code.slice(0, 2)}</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">{subject.code} Posts</h2>
          <p className="text-xs text-muted-foreground">{subject.name}</p>
        </div>
      </div>

      <PostEditor onSubmit={addPost} placeholder="Write a post..." submitLabel="Post" />

      {posts.length === 0 && (
        <div className="glass rounded-xl">
          <EmptyState
            icon={MessageSquare}
            title="Be the first to discuss"
            subtitle="No posts in this subject yet"
          />
        </div>
      )}

      <div className="space-y-3">
        {posts.map((post) => (
          <div key={post.id} className="glass rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                  {getAuthorName(post.author_id).slice(0, 2)}
                </div>
                <p className="text-xs font-bold text-primary">{getAuthorName(post.author_id)}</p>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(post.created_at).toLocaleDateString()}
                </span>
              </div>
              {post.author_id === user.supabaseId && (
                <div className="flex gap-1">
                  <button onClick={() => { setEditingId(post.id); setEditText(post.text); }} className="p-1 text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deletePost(post.id)} className="p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {editingId === post.id ? (
              <div className="flex gap-2">
                <Input value={editText} onChange={(e) => setEditText(e.target.value)}
                  className="h-8 text-sm rounded-lg bg-secondary/50 border-border/50" />
                <button onClick={() => editPost(post.id, editText)} className="p-1 text-accent"><Check className="h-4 w-4" /></button>
                <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <PostBody text={post.text} imagePath={post.image_path} />
            )}

            <div className="flex items-center gap-1.5 flex-wrap">
              {REACTIONS.map((r) => {
                const count = getReactionCount(post.id, null, r.key);
                const reacted = hasReacted(post.id, null, r.key);
                return (
                  <button key={r.key} onClick={() => toggleReaction(post.id, null, r.key)} aria-label={r.label}
                    className={`flex items-center gap-1 text-sm px-2 py-0.5 rounded-lg transition-all ${reacted ? "bg-primary/20 text-primary" : "hover:bg-secondary/50 text-muted-foreground"}`}>
                    <r.Icon className="h-3.5 w-3.5" />{count > 0 && <span className="text-[10px]">{count}</span>}
                  </button>
                );
              })}
              <button onClick={() => setReplyingTo(replyingTo === post.id ? null : post.id)}
                className="text-[10px] text-primary font-semibold ml-1 flex items-center gap-0.5">
                <CornerDownRight className="h-3 w-3" /> Reply
              </button>
            </div>

            {replyingTo === post.id && (
              <div className="flex gap-2">
                <Input placeholder="Reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)}
                  className="h-8 text-xs rounded-lg bg-secondary/50 border-border/50" autoFocus />
                <Button size="sm" className="h-8 w-8 p-0 rounded-lg"
                  onClick={() => addReply(post.id, null, replyText)}>
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            )}

            {renderReplies(post.id, null, 0)}
          </div>
        ))}
      </div>
    </div>
  );
}
