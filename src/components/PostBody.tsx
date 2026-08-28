import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  text: string;
  imagePath?: string | null;
}

const signedUrlCache = new Map<string, { url: string; expires: number }>();

async function getSignedUrl(path: string): Promise<string | null> {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expires > Date.now()) return cached.url;
  const { data } = await supabase.storage.from("chat-images").createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  signedUrlCache.set(path, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export function PostBody({ text, imagePath }: Props) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!imagePath) { setImgUrl(null); return; }
    getSignedUrl(imagePath).then((u) => { if (active) setImgUrl(u); });
    return () => { active = false; };
  }, [imagePath]);

  // Highlight @mentions with primary color
  const rendered = text?.replace(/(^|\s)(@\w{2,30})/g, "$1**$2**") ?? "";

  return (
    <div className="space-y-2">
      {text && (
        <div className="prose prose-sm prose-invert max-w-none text-sm text-foreground break-words [&_p]:my-1 [&_a]:text-primary [&_strong]:text-primary [&_code]:bg-secondary [&_code]:px-1 [&_code]:rounded [&_pre]:bg-secondary [&_pre]:p-2 [&_pre]:rounded-lg [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
              ),
            }}
          >
            {rendered}
          </ReactMarkdown>
        </div>
      )}
      {imgUrl && (
        <img
          src={imgUrl}
          alt=""
          loading="lazy"
          className="w-full max-h-96 object-cover rounded-xl"
        />
      )}
    </div>
  );
}
