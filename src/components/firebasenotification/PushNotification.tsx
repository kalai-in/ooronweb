"use client";

import { useEffect, type ReactNode } from "react";
import { useDispatch } from "react-redux";

// @/utils/firebase is NOT imported statically. This component wraps the whole
// app in Layout, so a top-level import pulled the Firebase SDK (app + auth +
// messaging) into the initial bundle of every page — a large parse/execute cost
// on the critical path for something that does no work at all until after the
// first paint. It is imported inside the effect instead, which runs post-paint
// and puts Firebase in its own lazily-fetched chunk.

interface PushNotificationLayoutProps {
  children: ReactNode;
}

const PushNotificationLayout = ({ children }: PushNotificationLayoutProps) => {
  const dispatch = useDispatch();

  useEffect(() => {
    // Cleanup may run before the dynamic import resolves (fast unmount, route
    // change). `cancelled` stops a listener being registered after teardown,
    // and `unsubscribe` is captured so the late-arriving one still gets undone.
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    import("@/utils/firebase")
      .then(({ fetchToken, onMessageListener, registerServiceWorker }) => {
        if (cancelled) return;
        registerServiceWorker();
        // No { prompt: true } here. Asking for notification permission on mount
        // fails Lighthouse's "Requests the notification permission on page load"
        // audit and burns the one chance to ask on a visitor who has no context
        // yet — a denial is permanent. This only picks the token back up for
        // users who already granted it; prompting belongs behind a user gesture.
        fetchToken(dispatch);
        // Fires for EVERY foreground message, not just the first.
        unsubscribe = onMessageListener((payload) => {
          const note = payload?.notification || payload?.data;
          // Guard the constructor: it throws if permission isn't granted.
          if (
            note?.title &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            new Notification(note.title, {
              body: note.body,
              icon: note.icon,
            });
          }
        });
        if (cancelled) {
          // Unmounted while onMessageListener was being set up.
          unsubscribe?.();
          unsubscribe = null;
        }
      })
      .catch((err) => console.error("Failed to load firebase:", err?.message));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [dispatch]);

  return <>{children}</>;
};

export default PushNotificationLayout;
