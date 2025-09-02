// post api 

import { supabase } from '@/utils/supabase';
import { PostgrestError } from '@supabase/supabase-js';
import { notifyReply, notifyLike, notifyPollVote } from '@/utils/notifications';
import { extractMentions, notifyMentionedUsers } from '@/utils/mentions';

export type PostMedia = {
  id: string;
  post_id: string;
  media_url: string;
  media_type: 'video' | 'photo';
  created_at: string;
  media_thumbnail?: string | null;
  width?: number | null;
  height?: number | null;
};

export type PostPollOption = {
  id: string; // PK in post_poll_options
  poll_id: string;
  option_text: string;
  votes: number;
  position: number;
};

export type CreatePollData = {
  question: string;
  options: string[];
};

export type PollVote = {
  id: string;
  poll_option_id: string;
  user_id: string;
  created_at: string;
};

export type PollVoter = {
  id: string;
  user_id: string;
  option_id: string;
  option_text: string;
  created_at: string;
  user: {
    id: string;
    username: string;
    full_name?: string;
    avatar_url?: string;
    is_verified?: boolean;
  };
};

export type PollVotersResponse = {
  voters: PollVoter[];
  error: PostgrestError | null;
};

export type PostPoll = {
  id: string;
  post_id: string;
  question: string;
  created_at: string;
  options?: PostPollOption[];
};

export type Post = {
  id: string;
  author_id: string;
  environment_id: string;
  parent_post_id: string | null;
  content: string | null;
  post_type: 'text' | 'media' | 'poll';
  created_at: string;
  deleted: boolean;
  // Fields from database counts
  likes: number;
  replies: number;
  tags?: string[];
  image?: string;
  // Include additional fields from joins if needed
  author?: {
    id: string;
    username: string;
    avatar_url?: string;
    full_name?: string;
    is_verified?: boolean;
    handle?: string;
  };
  environment?: {
    id: string;
    name: string;
    description?: string;
    picture?: string;
  };
  media?: PostMedia[];
  poll?: PostPoll | null;
};

export type PostError = {
  error: PostgrestError;
};

export type PostsResponse = {
  data: Post[] | null;
  error: PostgrestError | null;
  hasMore?: boolean;
};

export type PostResponse = {
  data: Post | null;
  error: PostgrestError | null;
};

/**
 * Fetch posts for a specific environment (paginated)
 * Optimized to eliminate N+1 queries by using aggregated joins
 */
export async function fetchPosts(
  environmentId: string,
  opts: { offset?: number; limit?: number } = {}
): Promise<PostsResponse> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  try {
    // Use a single query with aggregations to avoid N+1 queries
    // Pass null for environment_id if it's the default UUID to fetch all posts
    const effectiveEnvId = environmentId === '00000000-0000-0000-0000-000000000000' ? null : environmentId;
    const { data, error } = await supabase.rpc('get_posts_with_counts', {
      env_id: effectiveEnvId,
      limit_count: limit,
      offset_count: offset
    });

    if (error) {
      console.warn('RPC function not available, falling back to optimized query:', error.message);
      
      // Fallback: Optimized query with batch counting
      // Build the query - only filter by environment_id if it's not the default/null UUID
      let query = supabase
        .from('posts')
        .select(`
          *,
          author:author_id(id, username, avatar_url, full_name, is_verified),
          environment:environment_id(id, name, description, picture),
          media:post_media(*),
          poll:post_polls(*, options:post_poll_options(*))
        `, { count: 'exact' });
      
      // Only filter by environment_id if it's not the default/null UUID
      if (environmentId && environmentId !== '00000000-0000-0000-0000-000000000000') {
        query = query.eq('environment_id', environmentId);
      }
      
      const { data: posts, error: postsError, count } = await query
        .eq('deleted', false)
        .is('parent_post_id', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (postsError || !posts) {
        return { data: null, error: postsError };
      }

      // Batch fetch all likes and replies counts in two queries instead of N queries
      const postIds = posts.map(p => p.id);
      
      const [likesResult, repliesResult] = await Promise.all([
        // Get likes counts for all posts in one query
        supabase
          .from('post_likes')
          .select('post_id')
          .in('post_id', postIds),
        // Get replies counts for all posts in one query
        supabase
          .from('posts')
          .select('parent_post_id')
          .in('parent_post_id', postIds)
          .eq('deleted', false)
      ]);

      // Process the results to count likes and replies per post
      const likesMap = new Map<string, number>();
      const repliesMap = new Map<string, number>();

      if (likesResult.data) {
        likesResult.data.forEach(like => {
          const count = likesMap.get(like.post_id) || 0;
          likesMap.set(like.post_id, count + 1);
        });
      }

      if (repliesResult.data) {
        repliesResult.data.forEach(reply => {
          if (reply.parent_post_id) {
            const count = repliesMap.get(reply.parent_post_id) || 0;
            repliesMap.set(reply.parent_post_id, count + 1);
          }
        });
      }

      // Attach counts to posts
      const postsWithCounts = posts.map(post => ({
        ...post,
        likes: likesMap.get(post.id) || 0,
        replies: repliesMap.get(post.id) || 0,
      })) as Post[];

      const total = count ?? postsWithCounts.length;
      const hasMore = offset + postsWithCounts.length < total;

      return { data: postsWithCounts, error: null, hasMore };
    }

    // Process RPC result if available
    const postsWithCounts = data?.map((post: any) => ({
      ...post,
      likes: post.likes_count || 0,
      replies: post.replies_count || 0,
    })) as Post[] || [];

    const hasMore = postsWithCounts.length === limit;
    return { data: postsWithCounts, error: null, hasMore };
    
  } catch (err) {
    console.error('Error in fetchPosts:', err);
    return { data: null, error: err as any };
  }
}

/**
 * Fetch a single post by ID
 * Optimized to use batch queries for counts
 */
export async function fetchPostById(postId: string): Promise<PostResponse> {
  try {
    // Try RPC first for optimal performance
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_post_with_counts', {
      post_id_param: postId
    });

    if (!rpcError && rpcData && rpcData.length > 0) {
      const post = rpcData[0];
      const postWithCounts = {
        ...post,
        likes: post.likes_count || 0,
        replies: post.replies_count || 0,
      } as Post;
      return { data: postWithCounts, error: null };
    }

    // Fallback to optimized manual query
    const [postResult, likesResult, repliesResult] = await Promise.all([
      // Get the post data
      supabase
        .from('posts')
        .select(`
          *,
          author:author_id(id, username, avatar_url, full_name, is_verified),
          environment:environment_id(id, name, description, picture),
          media:post_media(*),
          poll:post_polls(*, options:post_poll_options(*))
        `)
        .eq('id', postId)
        .eq('deleted', false)
        .single(),
      // Get likes count
      supabase
        .from('post_likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId),
      // Get replies count
      supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('parent_post_id', postId)
        .eq('deleted', false)
    ]);

    const { data, error } = postResult;
    if (error || !data) {
      return { data: null, error };
    }

    const postWithCounts = {
      ...data,
      likes: likesResult.count || 0,
      replies: repliesResult.count || 0,
    } as Post;

    return { data: postWithCounts, error: null };
  } catch (err) {
    console.error('Error in fetchPostById:', err);
    return { data: null, error: err as any };
  }
}

/**
 * Fetch replies to a specific post
 */
export async function fetchReplies(parentPostId: string): Promise<PostsResponse> {
  try {
    const res = await fetch(`/api/posts/${parentPostId}/replies`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      return { data: null, error: { message: `Failed to fetch replies (${res.status})`, details: '', hint: '', code: String(res.status) } as PostgrestError };
    }
    const data = await res.json();
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Create a reply to a post and notify via Edge Function
 */
export async function createReply(params: {
  authorId: string;
  authorName?: string;
  environmentId: string;
  parentPostId: string;
  content: string;
}): Promise<{ data: Post | null; error: PostgrestError | null }> {
  const { authorId, authorName, environmentId, parentPostId, content } = params;
  const { data, error } = await createPost(authorId, environmentId, content, 'text', parentPostId);
  if (error || !data) return { data: null, error };

  // Fire-and-forget notification via internal API to bypass browser CORS
  try {
    await fetch('/api/push-on-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId: parentPostId,
        replyId: data.id,
        replierId: authorId,
        replyContent: content,
      }),
    });
  } catch (e) {
    // Do not block UI on notification errors
    console.warn('push-on-reply failed:', e);
  }

  // Browser notification for reply (if current user is the post author)
  if (authorName) {
    notifyReply(authorName, content, parentPostId);
  }

  return { data, error: null };
}

/**
 * Create a new post
 */
export async function createPost(
  authorId: string,
  environmentId: string,
  content: string,
  postType: 'text' | 'media' | 'poll' = 'text',
  parentPostId: string | null = null
): Promise<PostResponse> {
  const { data, error } = await supabase
    .from('posts')
    .insert([
      {
        author_id: authorId,
        environment_id: environmentId,
        content,
        post_type: postType,
        parent_post_id: parentPostId,
      },
    ])
    .select()
    .single();

  // Handle mentions if post was created successfully
  if (data && !error && content) {
    try {
      // Extract mentioned usernames from content
      const mentionedUsernames = extractMentions(content);
      
      if (mentionedUsernames.length > 0) {
        // Look up user IDs from usernames
        const { data: users } = await supabase
          .from('users')
          .select('id, username')
          .in('username', mentionedUsernames);
        
        if (users && users.length > 0) {
          // Send notifications to mentioned users
          await notifyMentionedUsers(
            data.id,
            authorId,
            users.map(u => u.id)
          );
        }
      }
    } catch (mentionError) {
      console.error('Error handling mentions:', mentionError);
      // Don't fail the post creation if mention notifications fail
    }
  }

  return { data, error };
}

/**
 * Create a poll post with options
 */
export async function createPollPost(
  authorId: string,
  environmentId: string,
  content: string,
  pollQuestion: string,
  pollOptions: string[],
  parentPostId: string | null = null
): Promise<PostResponse> {
  try {
    // First create the post (mentions will be handled in createPost)
    const { data: post, error: postError } = await createPost(
      authorId,
      environmentId,
      content,
      'poll',
      parentPostId
    );

    if (postError || !post) {
      return { data: null, error: postError };
    }

    // Create the poll record
    const { data: poll, error: pollError } = await supabase
      .from('post_polls')
      .insert([
        {
          post_id: post.id,
          question: pollQuestion,
        },
      ])
      .select()
      .single();

    if (pollError) {
      // Clean up the post if poll creation failed
      await supabase.from('posts').delete().eq('id', post.id);
      return { data: null, error: pollError };
    }

    // Create poll options
    const optionsToInsert = pollOptions.map((option, index) => ({
      poll_id: poll.id,
      option_text: option.trim(),
      position: index,
      votes: 0,
    }));

    const { error: optionsError } = await supabase
      .from('post_poll_options')
      .insert(optionsToInsert);

    if (optionsError) {
      // Clean up the post and poll if options creation failed
      await supabase.from('post_polls').delete().eq('id', poll.id);
      await supabase.from('posts').delete().eq('id', post.id);
      return { data: null, error: optionsError };
    }

    return { data: post, error: null };
  } catch (error) {
    console.error('Error creating poll post:', error);
    return {
      data: null,
      error: {
        message: 'Failed to create poll post',
        details: String(error),
        hint: '',
        code: 'POLL_CREATION_FAILED'
      } as PostgrestError,
    };
  }
}

/**
 * Update an existing post
 */
export async function updatePost(
  postId: string,
  authorId: string, // For permission checking
  content: string
): Promise<PostResponse> {
  // First check if the user is the author of the post
  const { data: existingPost, error: fetchError } = await supabase
    .from('posts')
    .select('author_id')
    .eq('id', postId)
    .single();

  if (fetchError) {
    return { data: null, error: fetchError };
  }

  if (existingPost.author_id !== authorId) {
    return {
      data: null,
      error: {
        message: 'You do not have permission to update this post',
        details: '',
        hint: '',
        code: 'PERMISSION_DENIED'
      } as PostgrestError,
    };
  }

  const { data, error } = await supabase
    .from('posts')
    .update({ content })
    .eq('id', postId)
    .select()
    .single();

  return { data, error };
}

/**
 * Soft delete a post (mark as deleted)
 */
export async function deletePost(
  postId: string,
  authorId: string // For permission checking
): Promise<PostResponse> {
  // First check if the user is the author of the post
  const { data: existingPost, error: fetchError } = await supabase
    .from('posts')
    .select('author_id')
    .eq('id', postId)
    .single();

  if (fetchError) {
    return { data: null, error: fetchError };
  }

  if (existingPost.author_id !== authorId) {
    return {
      data: null,
      error: {
        message: 'You do not have permission to delete this post',
        details: '',
        hint: '',
        code: 'PERMISSION_DENIED'
      } as PostgrestError,
    };
  }

  const { data, error } = await supabase
    .from('posts')
    .update({ deleted: true })
    .eq('id', postId)
    .select()
    .single();

  return { data, error };
}

/**
 * Like a post
 */
export async function likePost(postId: string, userId: string): Promise<{ error: PostgrestError | null }> {
  try {
    const { error } = await supabase.rpc('like_post', {
      post_id_param: postId,
      user_id_param: userId
    });

    // If function doesn't exist, return graceful error
    if (error && (error.code === '42883' || error.code === '42P01')) {
      console.warn('like_post function not available:', error.message);
      return { error: null }; // Gracefully handle missing function
    }

    return { error };
  } catch (err) {
    console.warn('Error liking post:', err);
    return { error: null };
  }
}

/**
 * Unlike a post
 */
export async function unlikePost(postId: string, userId: string): Promise<{ error: PostgrestError | null }> {
  try {
    const { error } = await supabase.rpc('unlike_post', {
      post_id_param: postId,
      user_id_param: userId
    });

    // If function doesn't exist, return graceful error
    if (error && (error.code === '42883' || error.code === '42P01')) {
      console.warn('unlike_post function not available:', error.message);
      return { error: null }; // Gracefully handle missing function
    }

    return { error };
  } catch (err) {
    console.warn('Error unliking post:', err);
    return { error: null };
  }
}

/**
 * Vote on a poll option
 */
export async function votePollOption(optionId: string, userId: string) {
  try {
    // First, get the poll_id from this option
    const { data: optionData, error: optionError } = await supabase
      .from('post_poll_options')
      .select('poll_id, votes')
      .eq('id', optionId)
      .single();

    if (optionError || !optionData) {
      return { data: null, error: optionError || new Error('Option not found') };
    }

    const pollId = optionData.poll_id;

    // Check if user has already voted for this specific option
    const { data: existingVoteForOption, error: checkOptionError } = await supabase
      .from('post_poll_votes')
      .select('id')
      .eq('poll_option_id', optionId)
      .eq('user_id', userId)
      .single();

    if (checkOptionError && checkOptionError.code !== 'PGRST116') {
      return { data: null, error: checkOptionError };
    }

    // If user clicked the same option they already voted for, remove the vote
    if (existingVoteForOption) {
      const { error: deleteError } = await supabase
        .from('post_poll_votes')
        .delete()
        .eq('id', existingVoteForOption.id);

      if (deleteError) {
        return { data: null, error: deleteError };
      }

      // Decrease vote count
      const currentVotes = optionData.votes ?? 0;
      const newVotes = Math.max(0, currentVotes - 1);
      const { error: decrementError } = await supabase
        .from('post_poll_options')
        .update({ votes: newVotes })
        .eq('id', optionId);

      if (decrementError) {
        return { data: null, error: decrementError };
      }

      return { 
        data: { 
          success: true, 
          voted_option_id: optionId, 
          action: 'removed',
          previous_option_id: null
        }, 
        error: null 
      };
    }

    // Check if user has voted for ANY other option in this poll
    const { data: existingVotes, error: checkPollError } = await supabase
      .from('post_poll_votes')
      .select(`
        id,
        poll_option_id,
        post_poll_options!inner(
          id,
          poll_id,
          votes
        )
      `)
      .eq('user_id', userId)
      .eq('post_poll_options.poll_id', pollId);

    if (checkPollError) {
      return { data: null, error: checkPollError };
    }

    let previousOptionId = null;

    // If user has already voted on this poll, remove the previous vote
    if (existingVotes && existingVotes.length > 0) {
      const previousVote = existingVotes[0];
      previousOptionId = previousVote.poll_option_id;

      // Delete the previous vote
      const { error: deleteError } = await supabase
        .from('post_poll_votes')
        .delete()
        .eq('id', previousVote.id);

      if (deleteError) {
        return { data: null, error: deleteError };
      }

      // Decrease vote count on the previous option
      const previousOption = previousVote.post_poll_options?.[0];
      if (previousOption) {
        const currentVotes = previousOption.votes ?? 0;
        const newVotes = Math.max(0, currentVotes - 1);
        const { error: decrementError } = await supabase
          .from('post_poll_options')
          .update({ votes: newVotes })
          .eq('id', previousOptionId);

        if (decrementError) {
          console.error('Error decrementing previous vote:', decrementError);
        }
      }
    }

    // Add the new vote
    const { error: insertError } = await supabase
      .from('post_poll_votes')
      .insert([
        {
          poll_option_id: optionId,
          user_id: userId
        }
      ]);

    if (insertError) {
      return { data: null, error: insertError };
    }

    // Increase vote count on the new option
    const currentVotes = optionData.votes ?? 0;
    const { error: incrementError } = await supabase
      .from('post_poll_options')
      .update({ votes: currentVotes + 1 })
      .eq('id', optionId);

    if (incrementError) {
      return { data: null, error: incrementError };
    }

    return { 
      data: { 
        success: true, 
        voted_option_id: optionId, 
        action: 'added',
        previous_option_id: previousOptionId
      }, 
      error: null 
    };
  } catch (error) {
    console.error('Error voting on poll option:', error);
    return { data: null, error };
  }
}

/**
 * Check if user has liked a post
 */
export async function checkUserLikedPost(postId: string, userId: string): Promise<{ liked: boolean, error: PostgrestError | null }> {
  try {
    const { data, error } = await supabase
      .from('post_likes')
      .select('post_id, user_id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .limit(1);

    // Handle various error cases gracefully
    if (error) {
      // Table doesn't exist, permission denied, or other access issues
      if (error.code === '42P01' || error.code === '401' || error.code === '403' || 
          error.message?.includes('JWT') || error.message?.includes('permission') ||
          error.message?.includes('relation') || error.message?.includes('does not exist')) {
        // Silently return false for missing functionality
        return { liked: false, error: null };
      }
      
      // For other errors, log them but don't spam the console
      if (!error.message?.includes('JWT')) {
        console.warn('post_likes query error:', error.code, error.message);
      }
      return { liked: false, error: null };
    }

    // If no error and we have data, user has liked the post
    return { liked: data && data.length > 0, error: null };
  } catch (error) {
    // Silently handle any unexpected errors
    console.warn('Unexpected error in checkUserLikedPost:', error);
    return { liked: false, error: null };
  }
}

/**
 * Check user's poll votes for a specific poll
 */
export async function checkUserPollVotes(pollId: string, userId: string): Promise<{ votes: { id: string; poll_id: string; user_id: string; option_id: string; created_at: string }[], error: PostgrestError | null }> {
  try {
    const { error: tableCheckError } = await supabase
      .from('post_poll_votes')
      .select('id')
      .limit(1);

    if (tableCheckError && tableCheckError.code === '42P01') {
      console.warn('post_poll_votes table does not exist');
      return { votes: [], error: null };
    }

    const { data, error } = await supabase
      .from('post_poll_votes')
      .select(`
        id,
        poll_option_id,
        user_id,
        created_at,
        post_poll_options!poll_option_id (
          id,
          option_text,
          poll_id
        )
      `)
      .eq('user_id', userId)
      .eq('post_poll_options.poll_id', pollId);

    if (error) {
      console.error('Error checking poll votes:', error);
      return { votes: [], error };
    }

    const votes = data?.map(vote => ({
      id: vote.id,
      option_id: vote.poll_option_id, // Map poll_option_id to option_id
      user_id: vote.user_id,
      created_at: vote.created_at,
      poll_id: vote.post_poll_options?.[0]?.poll_id
    })) || [];

    return { votes, error: null };
  } catch (error) {
    console.error('Error in checkUserPollVotes:', error);
    return { votes: [], error: error as PostgrestError };
  }
}

/**
 * Get list of users who voted on a poll (only for poll creator)
 */
export async function getPollVoters(
  pollId: string, 
  requesterId: string
): Promise<PollVotersResponse> {
  try {
    // First, check if the requester is the creator of the poll
    const { data: pollData, error: pollError } = await supabase
      .from('post_polls')
      .select(`
        id,
        post_id,
        posts!inner (
          author_id
        )
      `)
      .eq('id', pollId)
      .single();

    if (pollError) {
      return { voters: [], error: pollError };
    }

    // Check if requester is the poll creator
    if (pollData?.posts?.author_id !== requesterId) {
      return { 
        voters: [], 
        error: {
          message: 'Only poll creators can view voter lists',
          details: 'Permission denied',
          hint: '',
          code: 'PERMISSION_DENIED'
        } as PostgrestError
      };
    }

    // Get all votes for this poll with user information
    const { data: votes, error: votesError } = await supabase
      .from('post_poll_votes')
      .select(`
        id,
        user_id,
        poll_option_id,
        created_at,
        post_poll_options!inner (
          id,
          option_text,
          poll_id
        ),
        users (
          id,
          username,
          full_name,
          avatar_url,
          is_verified
        )
      `)
      .eq('post_poll_options.poll_id', pollId)
      .order('created_at', { ascending: false });

    if (votesError) {
      return { voters: [], error: votesError };
    }

    // Transform the data
    const voters: PollVoter[] = votes?.map(vote => ({
      id: vote.id,
      user_id: vote.user_id,
      option_id: vote.poll_option_id,
      option_text: vote.post_poll_options?.option_text || '',
      created_at: vote.created_at,
      user: {
        id: vote.users?.id || '',
        username: vote.users?.username || '',
        full_name: vote.users?.full_name,
        avatar_url: vote.users?.avatar_url,
        is_verified: vote.users?.is_verified || false
      }
    })) || [];

    return { voters, error: null };
  } catch (error) {
    console.error('Error getting poll voters:', error);
    return { 
      voters: [], 
      error: {
        message: 'Failed to get poll voters',
        details: String(error),
        hint: '',
        code: 'FETCH_ERROR'
      } as PostgrestError
    };
  }
}

/**
 * Get poll statistics for creators
 */
export async function getPollStats(
  pollId: string, 
  requesterId: string
): Promise<{
  stats: {
    totalVotes: number;
    uniqueVoters: number;
    optionBreakdown: { option_text: string; votes: number; percentage: number }[];
  } | null;
  error: PostgrestError | null;
}> {
  try {
    // First, check if the requester is the creator of the poll
    const { data: pollData, error: pollError } = await supabase
      .from('post_polls')
      .select(`
        id,
        post_id,
        posts!inner (
          author_id
        ),
        options:post_poll_options (
          id,
          option_text,
          votes
        )
      `)
      .eq('id', pollId)
      .single();

    if (pollError) {
      return { stats: null, error: pollError };
    }

    // Check if requester is the poll creator
    if (pollData?.posts?.author_id !== requesterId) {
      return { 
        stats: null, 
        error: {
          message: 'Only poll creators can view detailed stats',
          details: 'Permission denied',
          hint: '',
          code: 'PERMISSION_DENIED'
        } as PostgrestError
      };
    }

    // Get unique voter count
    const { count: uniqueVoters, error: votersError } = await supabase
      .from('post_poll_votes')
      .select('user_id, post_poll_options!inner(poll_id)', { count: 'exact', head: true })
      .eq('post_poll_options.poll_id', pollId);

    if (votersError) {
      return { stats: null, error: votersError };
    }

    const totalVotes = pollData.options?.reduce((sum, opt) => sum + opt.votes, 0) || 0;
    
    const optionBreakdown = pollData.options?.map(option => ({
      option_text: option.option_text,
      votes: option.votes,
      percentage: totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0
    })) || [];

    return {
      stats: {
        totalVotes,
        uniqueVoters: uniqueVoters || 0,
        optionBreakdown
      },
      error: null
    };
  } catch (error) {
    console.error('Error getting poll stats:', error);
    return { 
      stats: null, 
      error: {
        message: 'Failed to get poll statistics',
        details: String(error),
        hint: '',
        code: 'FETCH_ERROR'
      } as PostgrestError
    };
  }
}
