import { forwardRef, useEffect, useRef, useImperativeHandle, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface AutoResizeTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> {
  /** Maximum height in pixels before scrolling kicks in. Default 140. */
  maxHeight?: number;
  /** Minimum height in pixels. Default 40 (matches h-10). */
  minHeight?: number;
  /** Submit on Enter (Shift+Enter inserts newline). Default true. */
  submitOnEnter?: boolean;
  onSubmit?: () => void;
}

/**
 * Textarea that grows with its content up to maxHeight, then becomes scrollable.
 * Drop-in replacement for <Input> in chat composers — preserves Instagram-like UX.
 */
const AutoResizeTextarea = forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  (
    { className, value, onChange, onKeyDown, maxHeight = 140, minHeight = 40, submitOnEnter = true, onSubmit, ...props },
    ref
  ) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    const resize = () => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      const next = Math.min(el.scrollHeight, maxHeight);
      el.style.height = `${Math.max(next, minHeight)}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    };

    useEffect(() => { resize(); }, [value, maxHeight, minHeight]);

    return (
      <textarea
        ref={innerRef}
        rows={1}
        value={value}
        onChange={(e) => { onChange?.(e); resize(); }}
        onKeyDown={(e) => {
          if (submitOnEnter && e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit?.();
          }
          onKeyDown?.(e);
        }}
        className={cn(
          // Base look matches our chat Input style — pill at one line, rounds nicely as it grows
          "flex w-full resize-none bg-secondary/50 border border-border/50 px-4 py-2 text-sm leading-snug",
          "rounded-3xl placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50 scrollbar-hide",
          className
        )}
        style={{ minHeight, maxHeight }}
        {...props}
      />
    );
  }
);
AutoResizeTextarea.displayName = "AutoResizeTextarea";

export default AutoResizeTextarea;
