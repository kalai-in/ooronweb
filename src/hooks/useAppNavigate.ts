import { startTransition, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * App Router replacement for the old router.events-driven full-screen loader.
 *
 * Pages Router gave a routeChangeStart/Complete pair for free via
 * router.events; App Router has no equivalent global navigation-lifecycle
 * event. <Link> clicks and router.push()/replace() calls are wrapped in a
 * React transition by Next's own router, so useTransition()'s `isPending` is
 * the closest true signal that "a navigation is in flight" — it covers the
 * real fetch/render latency, not just a pathname flip.
 *
 * Use `navigate(href)` at the handful of call sites that currently do
 * router.push() by hand (auth guards, language switcher, checkout flow) to
 * get `isPending` wired to that specific navigation. Plain <Link> navigation
 * is covered automatically without any call-site change.
 */
export const useAppNavigate = () => {
  const router = useRouter();
  const [isPending, startNavTransition] = useTransition();

  const navigate = useCallback(
    (href: string) => {
      startNavTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  const replace = useCallback(
    (href: string) => {
      startNavTransition(() => {
        router.replace(href);
      });
    },
    [router],
  );

  return { navigate, replace, isPending };
};

export { startTransition };
