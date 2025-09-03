// Utility functions for handling mentions in posts

export function extractMentions(content: string): string[] {
  // Extract mentions from simple @username format
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }
  
  return [...new Set(mentions)]; // Remove duplicates
}

export function processMentionsInContent(content: string): string {
  // Keep mentions as simple @username format in the database
  // The mentions Map contains username -> userId mapping, but we only store @username
  return content; // Return content as-is since @username is already the desired format
}

export function renderMentionsInContent(content: string): string {
  // Convert stored format @[username](userId) back to display format
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  return content.replace(mentionRegex, '@$1');
}

export async function notifyMentionedUsers(
  postId: string,
  mentionerId: string,
  mentionedUserIds: string[]
) {
  if (!mentionedUserIds.length) {
    console.log('No users to notify');
    return;
  }

  console.log(`Sending notifications to ${mentionedUserIds.length} users`);
  
  const notifications = mentionedUserIds.map(async (userId) => {
    try {
      console.log(`Attempting to notify user ${userId}...`);
      
      const response = await fetch('/api/push-on-mention', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId,
          mentionerId,
          mentionedUserId: userId
        })
      });
      
      console.log(`API response for user ${userId}: ${response.status}`);
      
      if (!response.ok) {
        let errorData;
        const responseText = await response.text().catch(() => '');
        
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: responseText || 'Unknown error', status: response.status };
        }
        
        console.error(`Failed to notify user ${userId}: ${response.status}`, errorData);
        throw new Error(`Notification failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
      } else {
        const data = await response.json().catch(() => ({ success: true }));
        console.log(`✅ Notification sent successfully to user ${userId}`, data);
        return { userId, success: true, data };
      }
    } catch (error) {
      console.error(`❌ Failed to notify user ${userId}:`, error);
      return { userId, success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
  
  const results = await Promise.all(notifications);
  const successful = results.filter(r => r?.success).length;
  const failed = results.filter(r => !r?.success).length;
  
  console.log(`Notification results: ${successful} successful, ${failed} failed`);
  
  return results;
}