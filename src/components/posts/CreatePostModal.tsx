"use client";

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Hash, X, VideoIcon, Upload, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { type CompressedResult } from '@/utils/mediaCompressor';
import Image from 'next/image';
import { MentionDropdown } from './MentionDropdown';
import { extractCleanUsername } from '@/utils/username';

type CreatePostModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
};

export function CreatePostModal({ isOpen, onClose, onPostCreated }: CreatePostModalProps) {
  const [content, setContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [, setCompressedResults] = useState<CompressedResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<{ isCompressing: boolean; currentFile: string; progress: number }>({ isCompressing: false, currentFile: '', progress: 0 });
  const [postType] = useState<'text' | 'media' | 'poll'>('text');
  const [pollData, setPollData] = useState<{ question: string; options: string[] }>({ question: '', options: ['', ''] });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  
  // Mention state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [mentionedUsers, setMentionedUsers] = useState<Map<string, string>>(new Map()); // username -> userId
  
  if (!isOpen) return null;
  
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setCompressionProgress({ isCompressing: true, currentFile: '', progress: 0 });
    console.log('[CreatePostModal] Processing media files...');
    
    try {
      // Process files one by one to show progress
      const fileArray = Array.from(files);
      const results: CompressedResult[] = [];
      
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const isVideo = file.type.startsWith('video/');
        
        setCompressionProgress({ 
          isCompressing: true, 
          currentFile: file.name, 
          progress: Math.round((i / fileArray.length) * 100) 
        });
        
        console.log(`[CreatePostModal] Processing ${isVideo ? 'video' : 'image'}: ${file.name}`);
        
        // Import and compress individual file
        const { compressMediaFile } = await import('@/utils/mediaCompressor');
        const result = await compressMediaFile(file);
        results.push(result);
        
        // Log compression result immediately
        if (result.wasCompressed) {
          console.log(`[CreatePostModal] ✅ ${file.name} compressed successfully`);
        } else {
          console.log(`[CreatePostModal] ⚠️ ${file.name} not compressed (${result.reason})`);
        }
      }
      
      // Extract compressed files and preview URLs
      const compressedFiles = results.map(r => r.file);
      const previews = results.map(r => r.previewUrl);
      
      setSelectedImages(prev => [...prev, ...compressedFiles]);
      setImagePreviews(prev => [...prev, ...previews]);
      setCompressedResults(prev => [...prev, ...results]);
      
      console.log(`[CreatePostModal] ✅ Completed processing ${results.length} files`);
      
    } catch (error) {
      console.error('[CreatePostModal] Error processing files:', error);
    } finally {
      setIsProcessing(false);
      setCompressionProgress({ isCompressing: false, currentFile: '', progress: 0 });
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setCompressedResults(prev => prev.filter((_, i) => i !== index));
    // Revoke the object URL to avoid memory leaks
    URL.revokeObjectURL(imagePreviews[index]);
  };

  // Poll helper functions
  const addPollOption = () => {
    if (pollData.options.length < 4) {
      setPollData(prev => ({ ...prev, options: [...prev.options, ''] }));
    }
  };

  const removePollOption = (index: number) => {
    if (pollData.options.length > 2) {
      setPollData(prev => ({ 
        ...prev, 
        options: prev.options.filter((_, i) => i !== index) 
      }));
    }
  };

  const updatePollOption = (index: number, value: string) => {
    setPollData(prev => ({ 
      ...prev, 
      options: prev.options.map((option, i) => i === index ? value : option) 
    }));
  };

  const updatePollQuestion = (value: string) => {
    setPollData(prev => ({ ...prev, question: value }));
  };

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
        
        // Calculate dropdown position relative to viewport
        if (textareaRef.current) {
          const textarea = textareaRef.current;
          const rect = textarea.getBoundingClientRect();
          
          // Position below the textarea
          const lines = newContent.substring(0, lastAtIndex).split('\n');
          const lineHeight = 24;
          const cursorY = rect.top + Math.min((lines.length * lineHeight) + 30, 100);
          
          console.log('[CreatePostModal] Mention position:', { top: cursorY, left: rect.left + 10 });
          setMentionPosition({ 
            top: cursorY,
            left: rect.left + 10
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
    
    if (!content.trim() && selectedImages.length === 0 && postType !== 'poll') return;
    
    // Keep content as-is with simple @username format
    const processedContent = content;
    
    // In a real app, this would call an API to create the post with images
    console.log('Creating post:', processedContent);
    console.log('With images:', selectedImages);
    console.log('Mentioned users:', Array.from(mentionedUsers.entries()));
    
    // TODO: Create the actual post and get postId
    // const postId = await createPost(...);
    
    // Send notifications to mentioned users
    if (user && mentionedUsers.size > 0) {
      // Assuming you have a postId after creating the post
      // await notifyMentionedUsers(postId, user.id, Array.from(mentionedUsers.values()));
    }
    
    // Reset form and close modal
    setContent('');
    setSelectedImages([]);
    setImagePreviews([]);
    setCompressedResults([]);
    setMentionedUsers(new Map());
    setPollData({ question: '', options: ['', ''] });
    onClose();
    
    // Notify parent component
    if (onPostCreated) onPostCreated();
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-medium">Create Post</h2>
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
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              <div className="text-lg font-semibold text-muted-foreground">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
            
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleContentChange}
                placeholder="What's on your mind? Use @ to mention someone"
                className="w-full bg-transparent border-none focus:ring-0 resize-none text-card-foreground placeholder:text-muted-foreground min-h-[120px]"
                spellCheck="false"
                autoComplete="off"
                autoFocus
              />
              <MentionDropdown
                searchTerm={mentionSearch}
                onSelectUser={handleSelectUser}
                position={mentionPosition}
                isVisible={showMentionDropdown}
              />
            </div>
          </div>
          
          {/* Image previews */}
          {imagePreviews.length > 0 && (
            <div className="mb-3 grid grid-cols-3 gap-2">
              {imagePreviews.map((preview, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                  {selectedImages[index]?.type?.startsWith('video/') ? (
                    <>
                      <video src={preview} className="w-full h-full object-cover" />
                      <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1.5 py-0.5">
                        <VideoIcon className="h-3 w-3 text-white" />
                      </div>
                    </>
                  ) : (
                    <Image src={preview} alt={`Preview ${index + 1}`} fill className="object-cover" unoptimized />
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 rounded-full p-1"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Compression Progress Indicator */}
          {compressionProgress.isCompressing && (
            <div className="mb-3 p-3 bg-card/50 rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-primary">Processing Media</div>
                  <div className="text-xs text-muted-foreground truncate">{compressionProgress.currentFile}</div>
                </div>
                <div className="text-xs text-muted-foreground">{compressionProgress.progress}%</div>
              </div>
              <div className="mt-2 w-full bg-muted rounded-full h-1">
                <div 
                  className="bg-primary h-1 rounded-full transition-all duration-300" 
                  style={{ width: `${compressionProgress.progress}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {/* Poll Section */}
          {postType === 'poll' && (
            <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border">
              <div className="space-y-3">
                {/* Poll Question */}
                <div>
                  <input
                    type="text"
                    value={pollData.question}
                    onChange={(e) => updatePollQuestion(e.target.value)}
                    placeholder="Ask a question..."
                    className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    maxLength={150}
                    autoFocus
                  />
                  <div className="text-xs text-muted-foreground mt-1">{pollData.question.length}/150</div>
                </div>

                {/* Poll Options */}
                <div className="space-y-2">
                  {pollData.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updatePollOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="flex-1 bg-background border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        maxLength={80}
                      />
                      {pollData.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removePollOption(index)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Add Option Button */}
                {pollData.options.length < 4 && (
                  <button
                    type="button"
                    onClick={addPollOption}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Add Option
                  </button>
                )}
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*,video/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
                disabled={isProcessing || compressionProgress.isCompressing}
              />
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="rounded-full gap-1 px-3"
                aria-label="Add media"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing || compressionProgress.isCompressing || postType === 'poll'}
              >
                {isProcessing || compressionProgress.isCompressing ? (
                  <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Photo/Video</span>
                  </>
                )}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                <Hash className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>
            
            <Button 
              type="submit" 
              disabled={
                (postType === 'text' && !content.trim() && selectedImages.length === 0) ||
                (postType === 'media' && selectedImages.length === 0) ||
                (postType === 'poll' && (!pollData.question.trim() || pollData.options.filter(opt => opt.trim()).length < 2))
              }
              className="rounded-full px-4"
            >
              {postType === 'poll' ? 'Create Poll' : 'Post'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
