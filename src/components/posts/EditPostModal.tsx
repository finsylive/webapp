"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { X } from 'lucide-react';
import { updatePost } from '@/api/posts';
import { MentionDropdown } from './MentionDropdown';
import { notifyMentionedUsers } from '@/utils/mentions';
import { extractCleanUsername } from '@/utils/username';

type EditPostModalProps = {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  initialContent: string;
  userId: string;
  onPostUpdated?: () => void;
};

export function EditPostModal({ 
  isOpen, 
  onClose, 
  postId, 
  initialContent, 
  userId,
  onPostUpdated 
}: EditPostModalProps) {
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Mention state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [mentionedUsers, setMentionedUsers] = useState<Map<string, string>>(new Map()); // username -> userId

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
      setError(null);
    }
  }, [isOpen, initialContent]);

  if (!isOpen) return null;

  // Handle content change and detect mentions
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPosition = e.target.selectionStart;
    setContent(newContent);

    // Check for @ symbol before cursor
    const textBeforeCursor = newContent.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Show dropdown if valid mention context
      const charBeforeAt = lastAtIndex > 0 ? newContent[lastAtIndex - 1] : ' ';
      const isValidMentionStart = charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0;
      
      if (isValidMentionStart && !textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionSearch(textAfterAt);
        setMentionStartIndex(lastAtIndex);
        setShowMentionDropdown(true);
        
        // Calculate dropdown position
        if (textareaRef.current) {
          const textarea = textareaRef.current;
          const rect = textarea.getBoundingClientRect();
          
          setMentionPosition({ 
            top: rect.bottom + 5,
            left: rect.left
          });
        }
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  // Handle user selection from mention dropdown
  const handleSelectUser = (user: {
    id: string;
    username: string;
    full_name?: string;
    avatar_url?: string;
  } | null) => {
    if (!user) {
      setShowMentionDropdown(false);
      return;
    }

    // Extract clean username using utility function
    const username = extractCleanUsername(user);
    
    const beforeMention = content.substring(0, mentionStartIndex);
    const afterMention = content.substring(mentionStartIndex + mentionSearch.length + 1);
    const newContent = `${beforeMention}@${username} ${afterMention}`;
    
    setContent(newContent);
    setMentionedUsers(prev => new Map(prev).set(username, user.id)); // Store username -> userId for notifications
    setShowMentionDropdown(false);
    setMentionSearch('');
    
    // Focus back on textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
      const newCursorPosition = beforeMention.length + username.length + 2;
      textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('Post content cannot be empty');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Keep content as-is with simple @username format
      const processedContent = content;
      
      const { error } = await updatePost(postId, userId, processedContent);
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Send notifications to newly mentioned users
      if (mentionedUsers.size > 0) {
        await notifyMentionedUsers(postId, userId, Array.from(mentionedUsers.values()));
      }
      
      if (onPostUpdated) onPostUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-medium">Edit Post</h2>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full" 
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder="What's on your mind? Use @ to mention someone"
              className="w-full bg-transparent border border-input rounded-lg p-3 focus:ring-2 focus:ring-ring resize-none text-card-foreground placeholder:text-muted-foreground min-h-[150px]"
              autoFocus
              spellCheck="false"
              autoComplete="off"
            />
            <MentionDropdown
              searchTerm={mentionSearch}
              onSelectUser={handleSelectUser}
              position={mentionPosition}
              isVisible={showMentionDropdown}
            />
          </div>
          
          {error && (
            <p className="text-sm text-destructive mt-2">{error}</p>
          )}
          
          <div className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !content.trim()}
            >
              {isSubmitting ? 'Updating...' : 'Update Post'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}