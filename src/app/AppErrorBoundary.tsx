 "use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Dev-mode Turbopack Fast Refresh can hot-swap a component tree while a Radix
// portal (dropdown/menu) has content mounted outside React's normal subtree,
// corrupting fiber reconciliation ("Cannot read properties of null (reading
// 'removeChild')"). That crash unmounts the whole app to a dead white/stuck
// screen, forcing a manual hard reload after every edit. It doesn't happen in
// production builds (no Fast Refresh there) — this boundary only exists to
// make the dev-mode glitch self-heal instead of soft-locking the page.
class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Recover on the next tick — most of these crashes are a one-off commit
    // glitch, not a persistently broken state, so simply re-rendering the
    // tree clears it without a full page reload.
    setTimeout(() => this.setState({ hasError: false }), 0);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default AppErrorBoundary;
