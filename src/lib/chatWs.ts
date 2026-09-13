"use client";

import { store } from "@/redux/store";
import { buildApiHeaders } from "@/api/axiosMiddleware";

// Pusher client/channel shapes are whatever pusher-js's default export
// constructs at runtime; typed as `any` here rather than pulling in the
// library's own types, since this module loads it dynamically (see below)
// and only touches a handful of methods.
type PusherClient = any;
type PusherChannel = any;

// pusher-js is NOT imported statically. Layout mounts this module on every page
// load, so a static import put the whole websocket client in the initial bundle
// even though realtime is optional (disabled entirely when the API sets no
// broadcast_driver) and never needed for first paint. It's loaded on demand by
// loadPusher() below instead — off the critical path.
let PusherCtor: any = null;
let pusherModulePromise: Promise<any> | null = null;

const loadPusher = (): Promise<any> => {
  if (PusherCtor) return Promise.resolve(PusherCtor);
  if (!pusherModulePromise) {
    pusherModulePromise = import("pusher-js")
      .then((m: any) => {
        PusherCtor = m.default ?? m;
        return PusherCtor;
      })
      .catch((err: any) => {
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
const AUTH_ENDPOINT: string = (() => {
  const root = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  const sub = (process.env.NEXT_PUBLIC_API_SUBURL || "").replace(/^\/?|\/$/g, "");
  return sub ? `${root}/${sub}/broadcasting/auth` : `${root}/broadcasting/auth`;
})();

const authHeaders = () => ({
  ...buildApiHeaders(),
  Accept: "application/json",
});


export const log = (...a: any[]) => {
  console.log("%c[chatWs]", "color:#6b46c1;font-weight:bold", ...a);
};

interface PusherBaseConfig {
  driver: string;
  key: string;
}
interface PusherCloudConfig extends PusherBaseConfig {
  driver: "pusher";
  cluster: string;
}
interface SelfHostedConfig extends PusherBaseConfig {
  host: any;
  port: number;
  forceTLS: boolean;
}
type BroadcastConfig = PusherCloudConfig | SelfHostedConfig;

const readBroadcastConfig = (): BroadcastConfig | null => {
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
export const isChatWsEnabled = (): boolean => !!readBroadcastConfig();

let pusher: PusherClient | null = null;
// Remember the config we connected with so a settings change (or empty→set)
// forces a reconnect with the new driver/key instead of reusing a stale client.
let activeConfigKey: string | null = null;

const configKeyOf = (c?: BroadcastConfig | null): string =>
  c
    ? `${c.driver}|${c.key}|${(c as any).cluster || ""}|${(c as any).host || ""}|${
        (c as any).port || ""
      }`
    : "";

/**
 * Lazily create the shared Pusher client. Returns null when disabled OR when
 * the pusher-js chunk hasn't finished loading yet — callers go through
 * withClient(), which waits for the module and then retries.
 */
const getClient = (): PusherClient | null => {
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
  const options: any = {
    forceTLS: cfg.driver === "pusher" ? true : (cfg as SelfHostedConfig).forceTLS,
    enabledTransports: ["ws", "wss"],
    disableStats: true,
    channelAuthorization: {
      endpoint: AUTH_ENDPOINT,
      headers: authHeaders(),
    },
  };

  let wsUrl: string;
  if (cfg.driver === "pusher") {
    // Pusher Cloud: cluster routes to the right edge; no custom host.
    options.cluster = (cfg as PusherCloudConfig).cluster || "mt1";
    // The URL pusher-js actually dials for the cloud cluster.
    wsUrl = `wss://ws-${options.cluster}.pusher.com/app/${cfg.key}`;
    log("connecting → pusher cloud, cluster:", options.cluster, "key:", cfg.key);
  } else {
    // Self-hosted Reverb/soketi: talk to the configured host:port.
    const selfHosted = cfg as SelfHostedConfig;
    options.wsHost = selfHosted.host;
    options.wsPort = selfHosted.port;
    options.wssPort = selfHosted.port;
    options.cluster = ""; // irrelevant for self-hosted
    wsUrl = `${selfHosted.forceTLS ? "wss" : "ws"}://${selfHosted.host}:${selfHosted.port}/app/${cfg.key}`;
    log("connecting →", selfHosted.host + ":" + selfHosted.port, "driver:", cfg.driver, "key:", cfg.key);
  }
  log("ws url →", wsUrl);
  log("auth endpoint →", AUTH_ENDPOINT);

  pusher = new PusherCtor(cfg.key, options);
  activeConfigKey = cfgKey;

  pusher.connection.bind(
    "state_change",
    ({ previous, current }: { previous: string; current: string }) =>
      log("connection:", previous, "→", current)
  );
  pusher.connection.bind("connected", () =>
    log("connected ✓ socket_id:", pusher.connection.socket_id)
  );
  pusher.connection.bind("error", (err: any) => log("connection error:", err));

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
type Teardown = () => void;

const withClient = (fn: (client: PusherClient) => Teardown | void): Teardown => {
  let cancelled = false;
  let teardown: Teardown | null = null;

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
export const channelNameFor = (conversationId: number | string): string =>
  `private-${CHANNEL_PREFIX}${conversationId}`;

/**
 * Subscribe to a conversation's realtime messages.
 *
 * @param {number|string} conversationId
 * @param {(payload:any) => void} onMessage  called with the raw broadcast payload
 * @returns {() => void} unsubscribe (safe no-op when realtime is disabled)
 */
export const subscribeConversation = (
  conversationId: number | string | null | undefined,
  onMessage?: (payload: any) => void
): Teardown => {
  if (conversationId == null) return () => {};

  return withClient((client) => {
  const name = channelNameFor(conversationId);
  log("subscribe →", name);
  const channel: PusherChannel = client.subscribe(name);

  channel.bind("pusher:subscription_succeeded", () =>
    log("subscribed ✓", name)
  );
  channel.bind("pusher:subscription_error", (e: any) =>
    log("subscription error", name, e)
  );

  // Deliver EVERY channel event to onMessage (skip pusher internal events) so
  // realtime works without depending on the exact broadcast event name. Also
  // logs each event so the real name/payload is visible in the console.
  const globalHandler = (eventName: string, data: any) => {
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
export const subscribePublicChannel = (
  channelName: string,
  eventName: string,
  onEvent?: (payload: any) => void
): Teardown => {
  if (!channelName || !eventName) return () => {};

  return withClient((client) => {
    log("subscribe (public) →", channelName, "event:", eventName);
    const channel: PusherChannel = client.subscribe(channelName);

    channel.bind("pusher:subscription_error", (e: any) =>
      log("subscription error", channelName, e)
    );

    // Laravel prefixes broadcast events with "." only when the class implements
    // a custom broadcastAs(); bind both spellings so either convention lands.
    const handler = (data: any) => {
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
export interface WsStatus {
  configured: boolean;
  driver: string | null;
  key: string | null;
  state: string;
  socketId: string | null;
}

export const getWsStatus = (): WsStatus => {
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
export const refreshChatWsAuth = (): void => {
  if (pusher) {
    pusher.disconnect();
    pusher = null;
    activeConfigKey = null;
  }
};

export const disconnectChatWs = (): void => {
  if (pusher) {
    pusher.disconnect();
    pusher = null;
    activeConfigKey = null;
  }
};
