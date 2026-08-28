import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Sticky banner that appears when the device goes offline.
 * Sits below the app header. Uses the browser online/offline events.
 */
export default function OfflineIndicator() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ y: -32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -32, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="sticky top-14 z-30 w-full"
        >
          <div className="mx-auto max-w-2xl px-4 py-2 flex items-center justify-center gap-2 bg-destructive text-destructive-foreground text-xs font-medium shadow-md">
            <WifiOff className="h-3.5 w-3.5" />
            You're offline — messages will send when reconnected
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
