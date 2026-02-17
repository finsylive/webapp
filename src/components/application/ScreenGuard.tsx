'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ScreenGuardProps {
  active: boolean;
  onTabSwitch: () => void;
}

export default function ScreenGuard({ active, onTabSwitch }: ScreenGuardProps) {
  const [showWarning, setShowWarning] = useState(false);

  // Prevent browser navigation
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);

  // Detect tab switches
  const handleVisibilityChange = useCallback(() => {
    if (!active) return;
    if (document.hidden) {
      onTabSwitch();
      setShowWarning(true);
    }
  }, [active, onTabSwitch]);

  useEffect(() => {
    if (!active) return;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [active, handleVisibilityChange]);

  // Prevent back navigation
  useEffect(() => {
    if (!active) return;
    window.history.pushState(null, '', window.location.href);
    const handler = () => {
      window.history.pushState(null, '', window.location.href);
      setShowWarning(true);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [active]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle className="h-7 w-7 text-amber-500" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2">
          Stay Focused!
        </h3>
        <p className="text-sm text-muted-foreground mb-1">
          You switched away from this tab during your application.
        </p>
        <p className="text-xs text-muted-foreground mb-5">
          Tab switches are tracked and visible to the hiring team. Please stay on this page until you complete your application.
        </p>
        <button
          onClick={() => setShowWarning(false)}
          className="w-full rounded-xl bg-foreground text-background px-6 py-3 text-sm font-semibold hover:opacity-90 transition"
        >
          Continue Application
        </button>
      </div>
    </div>
  );
}
