// post api 

import { supabase } from '@/utils/supabase';
import { PostgrestError } from '@supabase/supabase-js';
import { notifyReply } from '@/utils/notifications';
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

export type PollType = 'single_choice' | 'multiple_choice';

export type CreatePollData = {
  question: string;
  options: string[];
  poll_type: PollType;
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
  poll_type: PollType;
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
 * Supabase returns `poll:post_polls(...)` as an array because the
 * relation is technically one-to-many.  This helper collapses the array
 * into a single object (or null) to match the `Post.poll` type.
 */
export function normalizePostPoll(raw: Record<string, unknown>): Record<string, unknown> {
  if (!raw.poll) return { ...raw, poll: null };
  if (Array.isArray(raw.poll)) {
    const first = raw.poll[0] ?? null;
    return { ...raw, poll: first };
  }
  return raw;
}

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
          author:author_id!inner(id, username, avatar_url, full_name, is_verified, account_status),
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
        .eq('author.account_status', 'active')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (postsError || !posts) {
        return { data: null, error: postsError };
      }

      // Batch fetch all likes and replies counts in two queries instead of N queries
      const postIds = posts.map((p: { id: string }) => p.id);

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
        likesResult.data.forEach((like: { post_id: string }) => {
          const count = likesMap.get(like.post_id) || 0;
          likesMap.set(like.post_id, count + 1);
        });
      }

      if (repliesResult.data) {
        repliesResult.data.forEach((reply: { parent_post_id: string | null }) => {
          if (reply.parent_post_id) {
            const count = repliesMap.get(reply.parent_post_id) || 0;
            repliesMap.set(reply.parent_post_id, count + 1);
          }
        });
      }

      // Attach counts to posts and normalize poll from array to single object
      const postsWithCounts = posts.map((post: { id: string }) => normalizePostPoll({
        ...post,
        likes: likesMap.get(post.id) || 0,
        replies: repliesMap.get(post.id) || 0,
      })) as Post[];

      const total = count ?? postsWithCounts.length;
      const hasMore = offset + postsWithCounts.length < total;

      return { data: postsWithCounts, error: null, hasMore };
    }

    // Process RPC result if available
    const postsWithCounts = data?.map((post: Record<string, unknown>) => ({
      ...post,
      likes: post.likes_count || 0,
      replies: post.replies_count || 0,
    })) as Post[] || [];

    const hasMore = postsWithCounts.length === limit;
    return { data: postsWithCounts, error: null, hasMore };

  } catch (err) {
    console.error('Error in fetchPosts:', err);
    return { data: null, error: err as PostgrestError };
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
          author:author_id!inner(id, username, avatar_url, full_name, is_verified, account_status),
          environment:environment_id(id, name, description, picture),
          media:post_media(*),
          poll:post_polls(*, options:post_poll_options(*))
        `)
        .eq('id', postId)
        .eq('deleted', false)
        .eq('author.account_status', 'active')
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

    const postWithCounts = normalizePostPoll({
      ...data,
      likes: likesResult.count || 0,
      replies: repliesResult.count || 0,
    }) as Post;

    return { data: postWithCounts, error: null };
  } catch (err) {
    console.error('Error in fetchPostById:', err);
    return { data: null, error: err as PostgrestError };
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

  // Fire async topic extraction for the feed engine
  if (data && !error && content) {
    fetch('/api/feed/extract-topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_id: data.id,
        content,
        post_type: postType,
      }),
    }).catch(() => { }); // Fire-and-forget
  }

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
          .in('username', mentionedUsernames)
          .eq('account_status', 'active');

        if (users && users.length > 0) {
          // Send notifications to mentioned users
          await notifyMentionedUsers(
            data.id,
            authorId,
            users.map((u: { id: string }) => u.id)
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
  pollType: PollType = 'single_choice',
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
          poll_type: pollType,
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
 * Vote on a poll option.
 *
 * Behaviour:
 * - single_choice: click same option = toggle off, click different = switch
 * - multiple_choice: each option toggles independently
 *
 * Vote counts are managed by DB triggers on post_poll_votes
 * (trigger_increment_poll_option_votes / trigger_decrement_poll_option_votes),
 * so we only insert/delete rows — no manual count updates needed.
 *
 * Returns fresh vote counts for all options so the client can sync state.
 */
export async function votePollOption(optionId: string, userId: string) {
  try {
    // 1. Fetch option metadata to get poll_id
    const { data: optionData, error: optionError } = await supabase
      .from('post_poll_options')
      .select('poll_id')
      .eq('id', optionId)
      .single();

    if (optionError || !optionData) {
      return { data: null, error: optionError || new Error('Option not found') };
    }

    const pollId = optionData.poll_id;

    // 1b. Fetch poll_type separately — gracefully fallback to 'single_choice'
    //     if the column doesn't exist yet (migration not run)
    let pollType = 'single_choice';
    try {
      const { data: pollData } = await supabase
        .from('post_polls')
        .select('poll_type')
        .eq('id', pollId)
        .single();
      if (pollData?.poll_type) {
        pollType = pollData.poll_type;
      }
    } catch {
      // poll_type column may not exist yet — default to single_choice
    }

    // 2. Check if user already voted for THIS specific option (toggle off)
    const { data: existingVoteForOption, error: checkOptionError } = await supabase
      .from('post_poll_votes')
      .select('id')
      .eq('poll_option_id', optionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkOptionError) {
      return { data: null, error: checkOptionError };
    }

    // 3. Same option clicked → REMOVE vote (works for both poll types)
    if (existingVoteForOption) {
      const { error: deleteError } = await supabase
        .from('post_poll_votes')
        .delete()
        .eq('id', existingVoteForOption.id);

      if (deleteError) {
        return { data: null, error: deleteError };
      }

      // Small delay to let DB trigger propagate the count update
      await new Promise(r => setTimeout(r, 50));
      const freshOptions = await fetchPollOptionCounts(pollId);

      return {
        data: {
          success: true,
          voted_option_id: optionId,
          action: 'removed' as const,
          previous_option_id: null,
          options: freshOptions,
        },
        error: null,
      };
    }

    let previousOptionId: string | null = null;

    // 4. For single_choice: remove any existing vote in this poll first.
    //    Use a two-step query (get option IDs → filter votes with .in()) instead of
    //    an !inner join filter, which can silently return empty results in Supabase.
    if (pollType === 'single_choice') {
      const { data: pollOptions } = await supabase
        .from('post_poll_options')
        .select('id')
        .eq('poll_id', pollId);

      if (pollOptions && pollOptions.length > 0) {
        const pollOptionIds = pollOptions.map((o: { id: string }) => o.id);

        const { data: existingVotes, error: checkPollError } = await supabase
          .from('post_poll_votes')
          .select('id, poll_option_id')
          .eq('user_id', userId)
          .in('poll_option_id', pollOptionIds);

        if (checkPollError) {
          return { data: null, error: checkPollError };
        }

        if (existingVotes && existingVotes.length > 0) {
          const previousVote = existingVotes[0];
          previousOptionId = previousVote.poll_option_id;

          const { error: deleteError } = await supabase
            .from('post_poll_votes')
            .delete()
            .eq('id', previousVote.id);

          if (deleteError) {
            return { data: null, error: deleteError };
          }
        }
      }
    }
    // For multiple_choice: no need to remove other votes

    // 5. Insert new vote
    const { error: insertError } = await supabase
      .from('post_poll_votes')
      .insert([{ poll_option_id: optionId, user_id: userId }]);

    if (insertError) {
      // Rollback: restore the previous vote if one was removed (single_choice)
      if (previousOptionId) {
        await supabase
          .from('post_poll_votes')
          .insert([{ poll_option_id: previousOptionId, user_id: userId }]);
      }
      return { data: null, error: insertError };
    }

    // Small delay to let DB trigger propagate the count update
    await new Promise(r => setTimeout(r, 50));
    const freshOptions = await fetchPollOptionCounts(pollId);

    return {
      data: {
        success: true,
        voted_option_id: optionId,
        action: 'added' as const,
        previous_option_id: previousOptionId,
        options: freshOptions,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error voting on poll option:', error);
    return { data: null, error };
  }
}

/**
 * Fetch fresh vote counts for all options in a poll.
 */
async function fetchPollOptionCounts(
  pollId: string
): Promise<{ id: string; votes: number }[]> {
  const { data, error } = await supabase
    .from('post_poll_options')
    .select('id, votes')
    .eq('poll_id', pollId)
    .order('position', { ascending: true });

  if (error || !data) {
    console.error('fetchPollOptionCounts error:', error);
    return [];
  }

  return data;
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
 * Check user's poll votes for a specific poll.
 *
 * Uses a two-step query (option IDs first, then votes with .in()) instead of
 * an !inner join filter, which can silently return empty results in Supabase.
 */
export async function checkUserPollVotes(pollId: string, userId: string): Promise<{ votes: { id: string; poll_id: string; user_id: string; option_id: string; created_at: string }[], error: PostgrestError | null }> {
  try {
    // Step 1: get all option IDs for this poll
    const { data: pollOptions, error: optionsError } = await supabase
      .from('post_poll_options')
      .select('id')
      .eq('poll_id', pollId);

    if (optionsError) {
      console.error('Error fetching poll options:', optionsError);
      return { votes: [], error: optionsError };
    }

    if (!pollOptions || pollOptions.length === 0) {
      return { votes: [], error: null };
    }

    const pollOptionIds = pollOptions.map((o: { id: string }) => o.id);

    // Step 2: fetch this user's votes for those options
    const { data, error } = await supabase
      .from('post_poll_votes')
      .select('id, poll_option_id, user_id, created_at')
      .eq('user_id', userId)
      .in('poll_option_id', pollOptionIds);

    if (error) {
      console.error('Error checking poll votes:', error);
      return { votes: [], error };
    }

    const votes = (data ?? []).map((vote: { id: string; poll_option_id: string; user_id: string; created_at: string }) => ({
      id: vote.id,
      option_id: vote.poll_option_id,
      user_id: vote.user_id,
      created_at: vote.created_at,
      poll_id: pollId,
    }));

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
    const post = Array.isArray(pollData?.posts) ? pollData.posts[0] : pollData?.posts;
    if (post?.author_id !== requesterId) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const voters: PollVoter[] = votes?.map((vote: any) => {
      // Handle the case where post_poll_options could be array or single object
      const pollOption = Array.isArray(vote.post_poll_options)
        ? vote.post_poll_options[0]
        : vote.post_poll_options;

      // Handle the case where users could be array or single object
      const user = Array.isArray(vote.users) ? vote.users[0] : vote.users;

      return {
        id: vote.id,
        user_id: vote.user_id,
        option_id: vote.poll_option_id,
        option_text: pollOption?.option_text || '',
        created_at: vote.created_at,
        user: {
          id: user?.id || '',
          username: user?.username || '',
          full_name: user?.full_name,
          avatar_url: user?.avatar_url,
          is_verified: user?.is_verified || false
        }
      };
    }) || [];

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
    const post = Array.isArray(pollData?.posts) ? pollData.posts[0] : pollData?.posts;
    if (post?.author_id !== requesterId) {
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
    // Count distinct voters by fetching user_ids and deduplicating
    const { data: voterRows, error: votersError } = await supabase
      .from('post_poll_votes')
      .select('user_id, post_poll_options!inner(poll_id)')
      .eq('post_poll_options.poll_id', pollId);

    const uniqueVoters = voterRows
      ? new Set(voterRows.map((r: { user_id: string }) => r.user_id)).size
      : 0;

    if (votersError) {
      return { stats: null, error: votersError };
    }

    const totalVotes = pollData.options?.reduce((sum: number, opt: { votes: number }) => sum + opt.votes, 0) || 0;

    const optionBreakdown = pollData.options?.map((option: { option_text: string; votes: number }) => ({
      option_text: option.option_text,
      votes: option.votes,
      percentage: totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0
    })) || [];

    return {
      stats: {
        totalVotes,
        uniqueVoters,
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
