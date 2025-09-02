"use client";

import React from 'react';
import { ConversationsList } from './ConversationsList';

// This component ensures we only have one instance of ConversationsList
// that persists across route changes within the chat layout
export const SharedConversationsList = React.memo(function SharedConversationsList() {
  // The context will handle all state management and prevent reloading
  return <ConversationsList />;
});