import { useCallback, useEffect, useState } from "react";
import { useUserPreferences } from "@/hooks/useUserPreferences";

type Permission = "default" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const { prefs, update } = useUserPreferences();
  const [permission, setPermission] = useState<Permission>(() =>
    typeof Notification === "undefined" ? "unsupported" : (Notification.permission as Permission)
  );

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setPermission(Notification.permission as Permission);
  }, []);

  const enable = useCallback(async () => {
    if (typeof Notification === "undefined") return false;
    let perm: Permission = Notification.permission as Permission;
    if (perm === "default") {
      perm = (await Notification.requestPermission()) as Permission;
    }
    setPermission(perm);
    if (perm === "granted") {
      await update({ push_enabled: true } as any);
      return true;
    }
    return false;
  }, [update]);

  const disable = useCallback(async () => {
    await update({ push_enabled: false } as any);
  }, [update]);

  return {
    permission,
    enabled: !!(prefs as any).push_enabled && permission === "granted",
    pushTypes: ((prefs as any).push_types as string[] | undefined) ?? ["message", "post_reply", "mention"],
    enable,
    disable,
    supported: permission !== "unsupported",
  };
}
