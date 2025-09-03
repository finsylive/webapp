// Core messaging types based on database schema

export interface Conversation {
  id: string
  user1_id: string
  user2_id: string
  last_message: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  reply_to_id?: string
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file'
  media_url?: string
  created_at: string
  read_at?: string
  is_read: boolean
  // Populated relations
  reply_to?: Message
  sender?: UserProfile
}

export interface ChatCategory {
  id: string
  user_id: string
  name: string
  color?: string
  created_at: string
  updated_at: string
  // Calculated fields
  conversation_ids?: string[]
  unread_count?: number
}

export interface ConversationCategory {
  id: string
  conversation_id: string
  category_id: string
  created_at: string
}

// Enhanced conversation with user details and unread counts
export interface EnrichedConversation {
  conversation_id: string
  other_user_id: string
  other_username: string
  other_full_name: string
  other_avatar_url?: string
  other_is_verified: boolean
  last_message?: string
  updated_at: string
  unread_count: number
  status: 'pending' | 'approved' | 'rejected'
  // Category information
  categories?: ChatCategory[]
}

// User profile for messaging context
export interface UserProfile {
  id: string
  username: string
  full_name: string
  avatar_url?: string
  is_verified: boolean
}

// API request/response types
export interface SendMessageRequest {
  conversation_id: string
  content: string
  reply_to_id?: string
  message_type?: 'text' | 'image' | 'video' | 'audio' | 'file'
  media_url?: string
  sender_id?: string // Optional for backward compatibility
}

export interface SendMessageResponse {
  message: Message
}

export interface CreateConversationRequest {
  user1_id: string
  user2_id: string
  initial_message?: string
}

export interface CreateConversationResponse {
  conversation: Conversation
  message?: Message
  was_created: boolean
}

export interface CreateCategoryRequest {
  name: string
  color?: string
  user_id?: string // Optional for backward compatibility
}

export interface CreateCategoryResponse {
  category: ChatCategory
}

export interface AssignCategoryRequest {
  conversation_id: string
  category_id: string
}

// Real-time event types
export interface TypingEvent {
  conversation_id: string
  user_id: string
  username: string
  is_typing: boolean
}

export interface MessageReactionEvent {
  message_id: string
  user_id: string
  reaction: string
}

// Pagination types
export interface MessagePaginationParams {
  limit?: number
  before_message_id?: string
  after_message_id?: string
}

export interface PaginatedMessages {
  messages: Message[]
  has_more: boolean
  next_cursor?: string
  prev_cursor?: string
}

// Utility types for filtering and sorting
export type ConversationFilter = 'all' | 'unread' | 'archived' | string // string for category_id
export type MessageSortOrder = 'asc' | 'desc'

// Error types
export interface MessagingError {
  code: string
  message: string
  details?: Record<string, unknown>
}

// Notification types
export interface MessageNotification {
  id: string
  conversation_id: string
  sender_id: string
  sender_username: string
  content: string
  message_type: string
  created_at: string
}

// Chat request types
export interface ChatRequest {
  conversation_id: string
  requester_id: string
  requester_username: string
  requester_avatar_url?: string
  message: string
  created_at: string
}

// Media upload types
export interface MediaUploadProgress {
  file_name: string
  progress: number
  status: 'uploading' | 'processing' | 'completed' | 'error'
  url?: string
  error?: string
}

// Local state types for UI
export interface ChatUIState {
  selectedConversation?: string
  activeCategory?: string
  isTyping: boolean
  typingUsers: string[]
  pendingReply?: Message
  uploadProgress?: MediaUploadProgress
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error'
}

// Search and filter types
export interface ConversationSearchParams {
  query?: string
  category_id?: string
  status?: Conversation['status']
  has_unread?: boolean
  limit?: number
  offset?: number
}

export interface MessageSearchParams {
  conversation_id: string
  query?: string
  message_type?: Message['message_type']
  sender_id?: string
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}