'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { EnrichedConversation } from '@/types/messaging';
import { cn } from '@/utils/cn';

interface ChatRequestApprovalProps {
  conversation: EnrichedConversation;
  currentUserId: string;
  onApprove: (conversationId: string) => Promise<void>;
  onReject: (conversationId: string) => Promise<void>;
  className?: string;
}

export function ChatRequestApproval({
  conversation,
  currentUserId,
  onApprove,
  onReject,
  className
}: ChatRequestApprovalProps) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);

  // Don't show if conversation is not pending or user is not the recipient
  const isRecipient = conversation.other_user_id !== currentUserId; // If we're not the other user, we're the recipient
  const isPending = conversation.status === 'pending';

  if (!isPending || !isRecipient) {
    return null;
  }

  const handleApprove = async () => {
    setLoading('approve');
    try {
      await onApprove(conversation.conversation_id);
    } catch (error) {
      console.error('Error approving request:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    setLoading('reject');
    try {
      await onReject(conversation.conversation_id);
    } catch (error) {
      console.error('Error rejecting request:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={cn(
      "bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-4 mb-4",
      className
    )}>
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
          {conversation.other_avatar_url ? (
            <Image
              src={conversation.other_avatar_url}
              alt={conversation.other_username}
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-lg font-medium text-gray-300">
              {conversation.other_username.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-white">
              {conversation.other_full_name || conversation.other_username}
            </h3>
            {conversation.other_is_verified && (
              <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            <span className="text-sm text-blue-400 font-medium">wants to message you</span>
          </div>

          <p className="text-gray-300 text-sm mb-4">
            @{conversation.other_username} sent you a message request. You can accept or decline this request.
          </p>

          {/* Last message preview if available */}
          {conversation.last_message && (
            <div className="bg-black/20 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-300 italic">
&ldquo;{conversation.last_message}&rdquo;
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleApprove}
              disabled={loading !== null}
              className={cn(
                "flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-sm transition-all",
                "bg-green-600 hover:bg-green-500 text-white",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                loading === 'approve' && "animate-pulse"
              )}
            >
              {loading === 'approve' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Accepting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Accept
                </>
              )}
            </button>

            <button
              onClick={handleReject}
              disabled={loading !== null}
              className={cn(
                "flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-sm transition-all",
                "bg-gray-600 hover:bg-gray-500 text-white",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                loading === 'reject' && "animate-pulse"
              )}
            >
              {loading === 'reject' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Declining...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Decline
                </>
              )}
            </button>
          </div>

          {/* Helper text */}
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-300">
                <p className="font-medium mb-1">About message requests</p>
                <p className="text-blue-200 text-xs">
                  People you don&apos;t follow can send you message requests. 
                  Accepting allows them to message you normally. 
                  Declining will prevent future messages from this person.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Component for when the user has sent a request (waiting for approval)
interface PendingRequestStatusProps {
  conversation: EnrichedConversation;
  currentUserId: string;
  onCancel?: (conversationId: string) => Promise<void>;
  className?: string;
}

export function PendingRequestStatus({
  conversation,
  currentUserId,
  onCancel,
  className
}: PendingRequestStatusProps) {
  const [canceling, setCanceling] = useState(false);

  // Don't show if conversation is not pending or user is not the sender
  const isSender = conversation.other_user_id === currentUserId; // If we're the other user, we're the sender
  const isPending = conversation.status === 'pending';

  if (!isPending || !isSender) {
    return null;
  }

  const handleCancel = async () => {
    if (!onCancel) return;

    setCanceling(true);
    try {
      await onCancel(conversation.conversation_id);
    } catch (error) {
      console.error('Error canceling request:', error);
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className={cn(
      "bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 rounded-lg p-4 mb-4",
      className
    )}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="flex-1">
          <h4 className="font-medium text-white mb-1">Message request sent</h4>
          <p className="text-yellow-200 text-sm">
            Waiting for {conversation.other_full_name || conversation.other_username} to accept your message request.
          </p>
        </div>

        {onCancel && (
          <button
            onClick={handleCancel}
            disabled={canceling}
            className="px-3 py-1 text-sm text-gray-300 hover:text-white bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors disabled:opacity-50"
          >
            {canceling ? 'Canceling...' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  );
}