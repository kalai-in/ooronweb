import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
  type MessagePayload,
} from "firebase/messaging";
import { setFcmToken } from "@/redux/slices/userSlice";
import { createStickyNote } from "./stickynote";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
let messaging: Messaging | null = null;

const getMessagingInstance = async (): Promise<Messaging | null> => {
  if (messaging) return messaging;
  if (typeof window === "undefined") return null;

  try {
    const isSupportedBrowser = await isSupported();
    if (isSupportedBrowser) {
      messaging = getMessaging(app);
      return messaging;
    } else {
      if (typeof window !== "undefined" && sessionStorage.getItem("hide-unsupported-browser-note") !== "true") {
        console.log("Firebase Messaging is not supported in this browser.");
        createStickyNote();
      }
      return null;
    }
  } catch (err) {
    console.error("Error checking messaging support:", err);
    return null;
  }
};

export const registerServiceWorker = (): void => {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/firebase-messaging-sw.js")
      .then((registration) => {
        console.log(
          "Service Worker registration successful, scope is:",
          registration.scope
        );
      })
      .catch((err) => {
        console.error("Service Worker registration failed:", err);
      });
  }
};

/**
 * Retrieve the FCM token.
 *
 * `dispatch` is the redux dispatch function. `opts.prompt` controls whether it
 * may SHOW the browser permission dialog. Default false: the token is only
 * fetched when the user has already granted permission.
 *
 * Prompting is opt-in because calling Notification.requestPermission() during
 * page load fails Lighthouse's "Requests the notification permission on page
 * load" audit — and is bad UX besides. A dialog with no context is reflexively
 * dismissed, and a denial is sticky: the browser won't ask again, so the site
 * loses push for good. Pass { prompt: true } from a real user gesture (a
 * "Enable notifications" control), never from an effect on mount.
 */
// Returns the token on success so a caller in a user-gesture handler (e.g.
// "Continue with Google") can use it immediately, without waiting on a
// redux re-render. Returns null on any early-out or failure; existing
// fire-and-forget callers are unaffected since they don't use the value.
export const fetchToken = async (
  dispatch: (action: any) => void,
  { prompt = false }: { prompt?: boolean } = {},
): Promise<string | null> => {
  try {
    if (typeof Notification === "undefined") return null;

    const messagingInstance = await getMessagingInstance();
    if (!messagingInstance) {
      console.log("Messaging not initialized, can't fetch token.");
      return null;
    }

    // "default" means undecided — asking here is what triggers the dialog.
    if (Notification.permission !== "granted") {
      if (!prompt || Notification.permission === "denied") return null;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.log("Unable to get permission to notify.");
        return null;
      }
    }

    const currentToken = await getToken(messagingInstance, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });

    if (currentToken) {
      dispatch(setFcmToken({ data: currentToken }));
      return currentToken;
    }
    console.log(
      "No registration token available. Request permission to generate one."
    );
    return null;
  } catch (err) {
    console.error("An error occurred while retrieving token.", err);
    return null;
  }
};

// Subscribe to EVERY foreground FCM message (not just the first). Returns an
// unsubscribe function. A Promise settles once, so the old Promise-based version
// only ever delivered the first message; use a callback instead.
export const onMessageListener = (
  callback?: (payload: MessagePayload) => void,
): (() => void) => {
  let unsubscribe = () => {};
  getMessagingInstance().then((messagingInstance) => {
    if (messagingInstance) {
      unsubscribe = onMessage(messagingInstance, (payload) => {
        console.log("Foreground message received. ", payload);
        callback?.(payload);
      });
    }
  });
  return () => unsubscribe();
};

export { app, auth };
