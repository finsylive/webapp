"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createPortal } from 'react-dom';

type LoginPromptModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  redirectTo?: string;
};

export function LoginPromptModal({
  open,
  onClose,
  title = 'Sign in to continue',
  description = 'You need to sign in to perform this action.',
  redirectTo,
}: LoginPromptModalProps) {
  const { signInWithGoogle } = useAuth();
  const backdropRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-sm bg-background border border-border rounded-2xl shadow-xl p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-5">
          <img src="/logo/green_logo.svg" alt="Ments" className="w-9 h-9" />
          <span className="text-lg font-bold tracking-tight text-foreground">ments</span>
        </div>

        {/* Heading */}
        <h3 className="text-lg font-semibold text-foreground text-center mb-1">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {description}
        </p>

        {/* Google Sign In */}
        <button
          onClick={() => signInWithGoogle(redirectTo)}
          className="group w-full bg-neutral-900 dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white font-semibold text-sm py-3 px-5 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-200 hover:shadow-lg active:scale-[0.98] mb-4"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Cancel */}
        <button
          onClick={onClose}
          className="w-full text-sm text-muted-foreground hover:text-foreground py-2 transition-colors text-center"
        >
          Maybe later
        </button>
      </div>
    </div>,
    document.body,
  );
}

type LoginPromptState = { isOpen: boolean; title: string; description: string };

/**
 * Hook to manage LoginPromptModal state.
 * Usage:
 *   const loginPrompt = useLoginPrompt();
 *   // In handler: if (loginPrompt.requireAuth('Sign in to vote')) return;
 *   // In JSX: <LoginPromptModal {...loginPrompt.modalProps} />
 */
export function useLoginPrompt() {
  const { user } = useAuth();
  const [state, setState] = useState<LoginPromptState>({
    isOpen: false,
    title: '',
    description: '',
  });

  const open = useCallback((title?: string, description?: string) => {
    setState({
      isOpen: true,
      title: title || 'Sign in to continue',
      description: description || 'You need to sign in to perform this action.',
    });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  /**
   * Returns true if user is NOT authenticated (and opens the modal).
   * Use as a guard: if (loginPrompt.requireAuth('Title', 'Desc')) return;
   */
  const requireAuth = useCallback(
    (title?: string, description?: string) => {
      if (!user) {
        open(title, description);
        return true;
      }
      return false;
    },
    [user, open],
  );

  return {
    requireAuth,
    open,
    close,
    modalProps: {
      open: state.isOpen,
      onClose: close,
      title: state.title,
      description: state.description,
    },
  };
}
