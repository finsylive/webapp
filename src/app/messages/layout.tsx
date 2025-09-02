"use client";

import { ChatLayout } from '@/components/layout/ChatLayout';
import { SharedConversationsList } from '@/components/messages/SharedConversationsList';

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatLayout 
      conversationsList={<SharedConversationsList />}
      showConversations={true}
    >
      {children}
    </ChatLayout>
  );
}