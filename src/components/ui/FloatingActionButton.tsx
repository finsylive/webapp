"use client";

import { Plus } from 'lucide-react';
import { useState } from 'react';

type FloatingActionButtonProps = {
  onClick: () => void;
};

export function FloatingActionButton({ onClick }: FloatingActionButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      className={`fixed bottom-24 right-4 md:bottom-20 md:right-8 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center ${isPressed ? 'scale-95' : ''}`}
      style={{
        boxShadow: isPressed ? 'var(--shadow-elevation-low)' : 'var(--shadow-elevation-high)',
        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
      }}
      aria-label="Create new post"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
