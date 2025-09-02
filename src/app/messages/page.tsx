"use client";

import { useTheme } from '@/context/theme/ThemeContext';
import { MessageCircle } from 'lucide-react';

export default function MessagesPage() {
  const { isDarkMode } = useTheme();

  return (
    <div className="flex flex-col items-center justify-center h-full bg-transparent">
      <div className="w-24 h-24 rounded-full mb-6 flex items-center justify-center border-2 border-dashed border-border/50 bg-card/50 backdrop-blur-sm">
        <MessageCircle className="w-12 h-12 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-bold mb-2 text-foreground">
        Your messages
      </h2>
      <p className="text-center max-w-md text-muted-foreground">
        Send a message to start a chat. Your conversations will appear here.
      </p>
      <button className="mt-6 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-colors shadow-sm hover:shadow-md">
        Send message
      </button>
    </div>
  );
}