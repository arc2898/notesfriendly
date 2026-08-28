import { ThumbsUp, ThumbsDown, Heart, Flame, Star, Laugh, SmilePlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { REACTION_TYPES, ReactionType, MessageReactionRow } from "@/hooks/useMessageReactions";

const ICONS: Record<ReactionType, typeof ThumbsUp> = {
  thumbs_up: ThumbsUp,
  thumbs_down: ThumbsDown,
  heart: Heart,
  flame: Flame,
  star: Star,
  laugh: Laugh,
};

interface Props {
  messageId: string;
  reactions: MessageReactionRow[];
  currentUserId: string;
  onToggle: (r: ReactionType) => void;
  isMe?: boolean;
}

export default function ReactionBar({ reactions, currentUserId, onToggle, isMe }: Props) {
  // Group reactions by type
  const counts: Record<string, { count: number; mine: boolean }> = {};
  reactions.forEach((r) => {
    if (!counts[r.reaction]) counts[r.reaction] = { count: 0, mine: false };
    counts[r.reaction].count += 1;
    if (r.user_id === currentUserId) counts[r.reaction].mine = true;
  });
  const active = Object.keys(counts);

  return (
    <div className={`flex items-center gap-1 mt-1 flex-wrap ${isMe ? "justify-end" : "justify-start"}`}>
      {active.map((rType) => {
        const Icon = ICONS[rType as ReactionType];
        if (!Icon) return null;
        const { count, mine } = counts[rType];
        return (
          <button
            key={rType}
            onClick={() => onToggle(rType as ReactionType)}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
              mine
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-muted/50 border-border/40 text-muted-foreground hover:bg-muted"
            }`}
          >
            <Icon className="h-3 w-3" />
            <span>{count}</span>
          </button>
        );
      })}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="opacity-0 group-hover:opacity-100 inline-flex items-center justify-center h-5 w-5 rounded-full bg-background border border-border/40 hover:bg-accent transition-opacity"
            aria-label="Add reaction"
          >
            <SmilePlus className="h-3 w-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1" align={isMe ? "end" : "start"}>
          <div className="flex gap-1">
            {REACTION_TYPES.map((rType) => {
              const Icon = ICONS[rType];
              const mine = counts[rType]?.mine;
              return (
                <button
                  key={rType}
                  onClick={() => onToggle(rType)}
                  className={`h-8 w-8 rounded-full flex items-center justify-center hover:bg-accent transition-colors ${mine ? "bg-primary/15 text-primary" : ""}`}
                  title={rType.replace("_", " ")}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
