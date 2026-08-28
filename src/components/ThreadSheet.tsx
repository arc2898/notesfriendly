import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Reply } from "lucide-react";

interface Msg {
  id: string;
  from_user_id: string;
  text: string;
  reply_to_id?: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootMessage: Msg | null;
  allMessages: Msg[];
  currentUserId: string;
  participantName: string;
}

export default function ThreadSheet({ open, onOpenChange, rootMessage, allMessages, currentUserId, participantName }: Props) {
  if (!rootMessage) return null;
  const replies = allMessages
    .filter((m) => m.reply_to_id === rootMessage.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const renderBubble = (m: Msg, isRoot = false) => {
    const isMe = m.from_user_id === currentUserId;
    return (
      <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"} ${isRoot ? "ring-2 ring-primary/30" : ""}`}>
          <p className="text-[10px] font-semibold opacity-70 mb-0.5">{isMe ? "You" : participantName}</p>
          <p className="whitespace-pre-wrap break-words">{m.text}</p>
          <p className="text-[10px] opacity-60 mt-1">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Reply className="h-4 w-4 text-primary" />
            Thread
            <span className="text-xs font-normal text-muted-foreground">({replies.length} {replies.length === 1 ? "reply" : "replies"})</span>
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {renderBubble(rootMessage, true)}
          {replies.length > 0 && <div className="border-t border-border/30 pt-3" />}
          {replies.map((r) => renderBubble(r))}
          {replies.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No replies yet. Use the Reply action to start a thread.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
