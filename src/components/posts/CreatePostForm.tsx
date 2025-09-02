"use client";

import { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { createPost } from '@/api/posts';
import { Image as ImageIcon, Send, X, VideoIcon, Upload, BarChart2, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { compressMediaBatch, type CompressedResult } from '@/utils/mediaCompressor';
import { MentionDropdown } from './MentionDropdown';
import { processMentionsInContent, notifyMentionedUsers } from '@/utils/mentions';
import { supabase } from '@/utils/supabase';
import { extractCleanUsername } from '@/utils/username';
import { toProxyUrl } from '@/utils/imageUtils';

type CreatePostFormProps = {
  environmentId: string;
  onPostCreated?: () => void;
};

export function CreatePostForm({ environmentId, onPostCreated }: CreatePostFormProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [compressedResults, setCompressedResults] = useState<CompressedResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<{ isCompressing: boolean; currentFile: string; progress: number }>({ isCompressing: false, currentFile: '', progress: 0 });
  const [postType, setPostType] = useState<'text' | 'media' | 'poll'>('text');
  const [pollData, setPollData] = useState<{ question: string; options: string[] }>({ question: '', options: ['', ''] });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Mention state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [mentionedUsers, setMentionedUsers] = useState<Map<string, string>>(new Map()); // username -> userId

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setCompressionProgress({ isCompressing: true, currentFile: '', progress: 0 });
    console.log('[CreatePostForm] Processing media files...');
    
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
        
        console.log(`[CreatePostForm] Processing ${isVideo ? 'video' : 'image'}: ${file.name}`);
        
        // Import and compress individual file
        const { compressMediaFile } = await import('@/utils/mediaCompressor');
        const result = await compressMediaFile(file);
        results.push(result);
        
        // Log compression result immediately
        if (result.wasCompressed) {
          console.log(`[CreatePostForm] ✅ ${file.name} compressed successfully`);
        } else {
          console.log(`[CreatePostForm] ⚠️ ${file.name} not compressed (${result.reason})`);
        }
      }
      
      // Extract compressed files and preview URLs
      const compressedFiles = results.map(r => r.file);
      const previews = results.map(r => r.previewUrl);
      
      setSelectedImages(prev => [...prev, ...compressedFiles]);
      setImagePreviews(prev => [...prev, ...previews]);
      setCompressedResults(prev => [...prev, ...results]);
      
      console.log(`[CreatePostForm] ✅ Completed processing ${results.length} files`);
      
    } catch (error) {
      console.error('[CreatePostForm] Error processing files:', error);
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
          
          // Position below cursor approximately
          const lines = newContent.substring(0, lastAtIndex).split('\n');
          const lineHeight = 24;
          const cursorY = rect.top + Math.min((lines.length * lineHeight) + 30, 100);
          
          console.log('[CreatePostForm] Mention position:', { top: cursorY, left: rect.left + 10 });
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
  const handleSelectUser = (user: any) => {
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
    
    if (!content.trim() && selectedImages.length === 0) return;
    if (!user) {
      setError('You must be logged in to create a post');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Keep content as-is with simple @username format
      const processedContent = content;
      
      // Determine post type based on whether images are present
      const finalPostType = selectedImages.length > 0 ? 'media' : 'text';
      
      const { data: postData, error } = await createPost(
        user.id,
        environmentId,
        processedContent,
        finalPostType
      );
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Upload media files to storage if media post
      if (selectedImages.length > 0 && postData) {
        console.log('[CreatePostForm] Uploading media files...');
        const { uploadPostMedia } = await import('@/utils/fileUpload');
        const { urls, error: uploadError } = await uploadPostMedia(selectedImages);
        
        if (uploadError) {
          throw new Error(`Media upload failed: ${uploadError}`);
        }
        
        // Save media URLs to post_media table
        if (urls.length > 0) {
          const mediaInserts = urls.map((url, index) => {
            const file = selectedImages[index];
            const isVideo = file.type.startsWith('video/');
            const result = compressedResults[index];
            
            return supabase.from('post_media').insert({
              post_id: postData.id,
              media_url: url,
              media_type: isVideo ? 'video' : 'photo',
              width: result?.width || null,
              height: result?.height || null,
            });
          });
          
          const mediaResults = await Promise.all(mediaInserts);
          const mediaErrors = mediaResults.filter(r => r.error);
          
          if (mediaErrors.length > 0) {
            console.error('[CreatePostForm] Failed to save media records:', mediaErrors);
          } else {
            console.log('[CreatePostForm] Successfully uploaded and saved', urls.length, 'media files');
          }
        }
      }
      
      // Send notifications to mentioned users
      if (postData && mentionedUsers.size > 0) {
        await notifyMentionedUsers(postData.id, user.id, Array.from(mentionedUsers.values()));
      }
      
      setContent('');
      setSelectedImages([]);
      setImagePreviews([]);
      setCompressedResults([]);
      setMentionedUsers(new Map());
      setPollData({ question: '', options: ['', ''] });
      if (onPostCreated) onPostCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="backdrop-blur-xl bg-card border border-border rounded-xl p-4 shadow-sm mb-6">
      <form onSubmit={handleSubmit}>
        {/* Post Type Selection */}
        <div className="mb-3">
          <div className="flex gap-2">
            <button
              type="button"
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition ${
                postType === 'text'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              onClick={() => setPostType('text')}
            >
              Text
            </button>
            <button
              type="button"
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition ${
                postType === 'media'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              onClick={() => setPostType('media')}
            >
              <ImageIcon className="h-3 w-3" />
              Media
            </button>
            <button
              type="button"
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition ${
                postType === 'poll'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              onClick={() => setPostType('poll')}
            >
              <BarChart2 className="h-3 w-3" />
              Poll
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
            {user?.user_metadata?.avatar_url ? (
              <Image 
                src={toProxyUrl(user.user_metadata.avatar_url, { width: 40, quality: 82 })}
                alt={user.user_metadata.full_name || 'User avatar'} 
                width={40}
                height={40}
                className="w-full h-full object-cover"
                sizes="40px"
                loading="lazy"
              />
            ) : (
              <div className="text-lg font-semibold text-muted-foreground">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <div className="relative">
              <textarea
                ref={textareaRef}
                className="w-full min-h-[100px] bg-background border border-input rounded-lg p-3 text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={postType === 'poll' ? 'Add a description (optional). Use @ to mention someone' : "What's on your mind? Use @ to mention someone"}
                value={content}
                onChange={handleContentChange}
                disabled={isSubmitting}
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
            
            {/* Image previews */}
            {imagePreviews.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 mb-3">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                    {selectedImages[index]?.type?.startsWith('video/') ? (
                      <>
                        <video src={preview} className="w-full h-full object-cover" />
                        <div className="absolute top-1 left-1 bg-black/70 rounded-full p-1">
                          <VideoIcon className="h-3 w-3 text-white" />
                        </div>
                        <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded font-medium">VIDEO</div>
                      </>
                    ) : (
                      <>
                        <Image src={preview} alt={`Preview ${index + 1}`} fill className="object-cover" unoptimized />
                        <div className="absolute top-1 left-1 bg-black/70 rounded-full p-1">
                          <ImageIcon className="h-3 w-3 text-white" />
                        </div>
                      </>
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
              <div className="mt-3 p-2 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-primary">Processing Media</div>
                    <div className="text-xs text-muted-foreground truncate">{compressionProgress.currentFile}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{compressionProgress.progress}%</div>
                </div>
                <div className="w-full bg-muted rounded-full h-1">
                  <div 
                    className="bg-primary h-1 rounded-full transition-all duration-300" 
                    style={{ width: `${compressionProgress.progress}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            {/* Poll Section */}
            {postType === 'poll' && (
              <div className="mt-3 p-3 bg-muted/30 rounded-lg border border-border">
                <div className="space-y-3">
                  {/* Poll Question */}
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">Poll Question</label>
                    <input
                      type="text"
                      value={pollData.question}
                      onChange={(e) => updatePollQuestion(e.target.value)}
                      placeholder="Ask a question..."
                      className="w-full bg-background border border-input rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      maxLength={150}
                    />
                    <div className="text-xs text-muted-foreground mt-1">{pollData.question.length}/150</div>
                  </div>

                  {/* Poll Options */}
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">Options</label>
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
                        className="mt-2 flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        Add Option
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {error && (
              <p className="text-sm text-destructive mt-1">{error}</p>
            )}
            
            <div className="flex justify-between items-center mt-3">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*,video/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
                disabled={isSubmitting || isProcessing || compressionProgress.isCompressing}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={isSubmitting || isProcessing || compressionProgress.isCompressing || postType === 'poll'}
                onClick={() => fileInputRef.current?.click()}
              >
                {isProcessing || compressionProgress.isCompressing ? (
                  <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin mr-1" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                {compressionProgress.isCompressing ? 'Processing...' : 'Add Photo/Video'}
              </Button>
              
              <Button
                type="submit"
                variant="default"
                size="sm"
                className="gap-1"
                disabled={
                  isSubmitting ||
                  (postType === 'text' && !content.trim() && selectedImages.length === 0) ||
                  (postType === 'media' && selectedImages.length === 0) ||
                  (postType === 'poll' && (!pollData.question.trim() || pollData.options.filter(opt => opt.trim()).length < 2))
                }
              >
                <Send className="h-4 w-4" />
                {postType === 'poll' ? 'Create Poll' : 'Post'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
