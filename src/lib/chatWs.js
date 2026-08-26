"use client";

import { store } from "@/redux/store";
import { buildApiHeaders } from "@/api/axiosMiddleware";

// pusher-js is NOT imported statically. Layout mounts this module on every page
// load, so a static import put the whole websocket client in the initial bundle
// even though realtime is optional (disabled entirely when the API sets no
// broadcast_driver) and never needed for first paint. It's loaded on demand by
// loadPusher() below instead — off the critical path.
let PusherCtor = null;
let pusherModulePromise = null;

const loadPusher = () => {
  if (PusherCtor) return Promise.resolve(PusherCtor);
  if (!pusherModulePromise) {
    pusherModulePromise = import("pusher-js")
      .then((m) => {
        PusherCtor = m.default ?? m;
        return PusherCtor;
      })
      .catch((err) => {
        // Reset so a later subscribe can retry rather than being stuck on a
        // permanently-rejected promise.
        pusherModulePromise = null;
        log("failed to load pusher-js:", err?.message);
        return null;
      });
  }
  return pusherModulePromise;
};

// ── Broadcast config: driven by the API settings, NOT env ──────────────────

// Backend broadcasts on private-chat.conversation.<id>, so the channel prefix
// is fixed. Hardcoded here (was NEXT_PUBLIC_WS_CHANNEL_PREFIX) since it never
// varies per environment.
const CHANNEL_PREFIX = "chat.conversation.";

// /broadcasting/auth lives UNDER the customer API sub-path (same base axios
// uses), not the app root — the root route rejects the JWT guard with 403.
const AUTH_ENDPOINT = (() => {
  const root = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  const sub = (process.env.NEXT_PUBLIC_API_SUBURL || "").replace(/^\/?|\/$/g, "");
  return sub ? `${root}/${sub}/broadcasting/auth` : `${root}/broadcasting/auth`;
})();

const authHeaders = () => ({
  ...buildApiHeaders(),
  Accept: "application/json",
});


export const log = (...a) => {
  console.log("%c[chatWs]", "color:#6b46c1;font-weight:bold", ...a);
};


const readBroadcastConfig = () => {
  const setting = store.getState()?.Setting?.setting;
  const driver = (setting?.broadcast_driver || "").toLowerCase().trim();
  if (!driver) return null; // realtime disabled

  const cfg = setting?.broadcast_config || {};
  const key = cfg.key || cfg.app_key;
  if (!key) return null; // no key → can't connect

  if (driver === "pusher") {
    return { driver, key, cluster: cfg.cluster || "" };
  }
  // reverb / soketi / any self-hosted websocket driver.
  const scheme = cfg.scheme || cfg.protocol;
  const secure = scheme ? /^https|wss$/i.test(scheme) : true;
  const port = Number(cfg.port) || (secure ? 443 : 80);
  return {
    driver,
    key,
    host: cfg.host || cfg.wsHost,
    port,
    forceTLS: secure,
  };
};

/** True when the current settings enable realtime chat. */
export const isChatWsEnabled = () => !!readBroadcastConfig();

let pusher = null;
// Remember the config we connected with so a settings change (or empty→set)
// forces a reconnect with the new driver/key instead of reusing a stale client.
let activeConfigKey = null;

const configKeyOf = (c) =>
  c ? `${c.driver}|${c.key}|${c.cluster || ""}|${c.host || ""}|${c.port || ""}` : "";

/**
 * Lazily create the shared Pusher client. Returns null when disabled OR when
 * the pusher-js chunk hasn't finished loading yet — callers go through
 * withClient(), which waits for the module and then retries.
 */
const getClient = () => {
  const cfg = readBroadcastConfig();
  if (!cfg) return null;
  // Module still in flight; withClient() re-calls once it resolves.
  if (!PusherCtor) return null;

  const cfgKey = configKeyOf(cfg);
  if (pusher && cfgKey === activeConfigKey) return pusher;
  // Config changed under us → drop the old client and rebuild.
  if (pusher && cfgKey !== activeConfigKey) {
    log("config changed, reconnecting");
    pusher.disconnect();
    pusher = null;
  }

  // Private channels authorise through the app's /broadcasting/auth endpoint,
  // carrying the customer's Bearer token. pusher-js appends socket_id and
  // channel_name to the POST body itself.
  const options = {
    forceTLS: cfg.driver === "pusher" ? true : cfg.forceTLS,
    enabledTransports: ["ws", "wss"],
    disableStats: true,
    channelAuthorization: {
      endpoint: AUTH_ENDPOINT,
      headers: authHeaders(),
    },
  };

  let wsUrl;
  if (cfg.driver === "pusher") {
    // Pusher Cloud: cluster routes to the right edge; no custom host.
    options.cluster = cfg.cluster || "mt1";
    // The URL pusher-js actually dials for the cloud cluster.
    wsUrl = `wss://ws-${options.cluster}.pusher.com/app/${cfg.key}`;
    log("connecting → pusher cloud, cluster:", options.cluster, "key:", cfg.key);
  } else {
    // Self-hosted Reverb/soketi: talk to the configured host:port.
    options.wsHost = cfg.host;
    options.wsPort = cfg.port;
    options.wssPort = cfg.port;
    options.cluster = ""; // irrelevant for self-hosted
    wsUrl = `${cfg.forceTLS ? "wss" : "ws"}://${cfg.host}:${cfg.port}/app/${cfg.key}`;
    log("connecting →", cfg.host + ":" + cfg.port, "driver:", cfg.driver, "key:", cfg.key);
  }
  log("ws url →", wsUrl);
  log("auth endpoint →", AUTH_ENDPOINT);

  pusher = new PusherCtor(cfg.key, options);
  activeConfigKey = cfgKey;

  pusher.connection.bind("state_change", ({ previous, current }) =>
    log("connection:", previous, "→", current)
  );
  pusher.connection.bind("connected", () =>
    log("connected ✓ socket_id:", pusher.connection.socket_id)
  );
  pusher.connection.bind("error", (err) => log("connection error:", err));

  return pusher;
};

/**
 * Run `fn(client)` once the pusher-js chunk has loaded, and return a sync
 * teardown — so subscribe* keep their existing signature (callers use them
 * straight from useEffect and expect an unsubscribe function back).
 *
 * If teardown runs before the chunk arrives, `cancelled` makes the late
 * subscribe a no-op, so an unmount during load can't leak a subscription.
 */
const withClient = (fn) => {
  let cancelled = false;
  let teardown = null;

  // Realtime off in settings → never even fetch the chunk.
  if (!readBroadcastConfig()) return () => {};

  loadPusher().then((ctor) => {
    if (cancelled || !ctor) return;
    const client = getClient();
    if (!client) return;
    teardown = fn(client) || null;
  });

  return () => {
    cancelled = true;
    teardown?.();
    teardown = null;
  };
};

// Private channels are prefixed `private-` by Laravel Echo convention.
export const channelNameFor = (conversationId) =>
  `private-${CHANNEL_PREFIX}${conversationId}`;

/**
 * Subscribe to a conversation's realtime messages.
 *
 * @param {number|string} conversationId
 * @param {(payload:any) => void} onMessage  called with the raw broadcast payload
 * @returns {() => void} unsubscribe (safe no-op when realtime is disabled)
 */
export const subscribeConversation = (conversationId, onMessage) => {
  if (conversationId == null) return () => {};

  return withClient((client) => {
  const name = channelNameFor(conversationId);
  log("subscribe →", name);
  const channel = client.subscribe(name);

  channel.bind("pusher:subscription_succeeded", () =>
    log("subscribed ✓", name)
  );
  channel.bind("pusher:subscription_error", (e) =>
    log("subscription error", name, e)
  );

  // Deliver EVERY channel event to onMessage (skip pusher internal events) so
  // realtime works without depending on the exact broadcast event name. Also
  // logs each event so the real name/payload is visible in the console.
  const globalHandler = (eventName, data) => {
    if (eventName.startsWith("pusher:") || eventName.startsWith("pusher_internal:"))
      return;
    log("event ←", name, eventName, data);
    onMessage?.(data);
  };
  channel.bind_global(globalHandler);

    return () => {
      log("unsubscribe →", name);
      channel.unbind_global(globalHandler);
      client.unsubscribe(name);
    };
  });
};

/**
 * Subscribe to a PUBLIC broadcast channel by exact name.
 *
 * Unlike subscribeConversation this does not prefix `private-`, so it never
 * hits /broadcasting/auth — the caller may be a logged-out visitor. Shares the
 * one Pusher client with chat rather than opening a second socket.
 *
 * @param {string} channelName        exact channel, e.g. "maintenance"
 * @param {string} eventName          exact event, e.g. "maintenance.toggled"
 * @param {(payload:any) => void} onEvent
 * @returns {() => void} unsubscribe (safe no-op when realtime is disabled)
 */
export const subscribePublicChannel = (channelName, eventName, onEvent) => {
  if (!channelName || !eventName) return () => {};

  return withClient((client) => {
    log("subscribe (public) →", channelName, "event:", eventName);
    const channel = client.subscribe(channelName);

    channel.bind("pusher:subscription_error", (e) =>
      log("subscription error", channelName, e)
    );

    // Laravel prefixes broadcast events with "." only when the class implements
    // a custom broadcastAs(); bind both spellings so either convention lands.
    const handler = (data) => {
      log("event ←", channelName, eventName, data);
      onEvent?.(data);
    };
    channel.bind(eventName, handler);
    channel.bind(`.${eventName}`, handler);

    return () => {
      log("unsubscribe (public) →", channelName);
      channel.unbind(eventName, handler);
      channel.unbind(`.${eventName}`, handler);
      client.unsubscribe(channelName);
    };
  });
};

/**
 * Snapshot of the realtime layer, for the dev-only debug badge.
 *
 * Reads the LIVE client if one exists but never creates one, so calling this
 * can't itself open a socket.
 */
export const getWsStatus = () => {
  const cfg = readBroadcastConfig();
  return {
    configured: Boolean(cfg),
    driver: cfg?.driver || null,
    key: cfg?.key || null,
    // `pusher` is null until something subscribes.
    state: pusher?.connection?.state || "idle",
    socketId: pusher?.connection?.socket_id || null,
  };
};

/** Reconnect with a fresh token (call after login / token refresh). */
export const refreshChatWsAuth = () => {
  if (pusher) {
    pusher.disconnect();
    pusher = null;
    activeConfigKey = null;
  }
};

export const disconnectChatWs = () => {
  if (pusher) {
    pusher.disconnect();
    pusher = null;
    activeConfigKey = null;
  }
};
