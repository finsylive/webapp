/**
 * Browser Notification Utility Functions
 * Handles permission requests, notification creation, and management
 */

export type NotificationType = 'reply' | 'like' | 'vote' | 'mention' | 'follow' | 'system';

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  data?: Record<string, unknown>;
  actions?: NotificationAction[];
  image?: string;
  vibrate?: number[];
  timestamp?: number;
}

/**
 * Check if browser supports notifications
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    console.warn('Notifications are not supported in this browser');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    console.warn('Notification permission was previously denied');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
}

/**
 * Show a browser notification
 */
export async function showNotification(
  type: NotificationType,
  options: NotificationOptions
): Promise<void> {
  if (!isNotificationSupported()) {
    console.warn('Notifications are not supported');
    return;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return;
  }

  try {
    // Get default icon based on notification type
    const defaultIcon = getDefaultIcon(type);
    
    // Create notification options
    const notificationOptions: NotificationOptions = {
      icon: options.icon || defaultIcon,
      badge: options.badge || '/icon-192x192.png',
      tag: options.tag || `${type}-${Date.now()}`,
      requireInteraction: options.requireInteraction ?? false,
      silent: options.silent ?? false,
      data: {
        type,
        ...options.data
      },
      timestamp: options.timestamp || Date.now(),
      ...options
    };

    // Check if service worker is available for rich notifications
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Use service worker for notifications (supports actions and more features)
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(options.title, notificationOptions);
    } else {
      // Fallback to basic notification API
      const notification = new Notification(options.title, {
        body: options.body,
        icon: notificationOptions.icon,
        tag: notificationOptions.tag,
        silent: notificationOptions.silent,
        requireInteraction: notificationOptions.requireInteraction,
      });

      // Handle notification click
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        if (options.data?.url && typeof options.data.url === 'string') {
          window.location.href = options.data.url;
        }
        notification.close();
      };

      // Auto close after 10 seconds if not requiring interaction
      if (!options.requireInteraction) {
        setTimeout(() => notification.close(), 10000);
      }
    }
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

/**
 * Get default icon based on notification type
 */
function getDefaultIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    reply: '/icons/reply.png',
    like: '/icons/heart.png',
    vote: '/icons/poll.png',
    mention: '/icons/mention.png',
    follow: '/icons/follow.png',
    system: '/icons/bell.png'
  };
  
  return icons[type] || '/icon-192x192.png';
}

/**
 * Check if notifications are enabled in localStorage
 */
export function areNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const settings = localStorage.getItem('notificationSettings');
  if (!settings) return false;
  
  try {
    const parsed = JSON.parse(settings);
    return parsed.enabled === true;
  } catch {
    return false;
  }
}

/**
 * Get notification settings from localStorage
 */
export function getNotificationSettings() {
  if (typeof window === 'undefined') {
    return {
      enabled: false,
      replies: true,
      likes: true,
      votes: true,
      mentions: true,
      follows: true,
      sound: true,
      vibrate: true
    };
  }

  const defaultSettings = {
    enabled: false,
    replies: true,
    likes: true,
    votes: true,
    mentions: true,
    follows: true,
    sound: true,
    vibrate: true
  };

  try {
    const stored = localStorage.getItem('notificationSettings');
    if (!stored) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(stored) };
  } catch {
    return defaultSettings;
  }
}

/**
 * Save notification settings to localStorage
 */
export function saveNotificationSettings(settings: {
  enabled: boolean;
  replies: boolean;
  likes: boolean;
  votes: boolean;
  mentions: boolean;
  follows: boolean;
  sound: boolean;
  vibrate: boolean;
}): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('notificationSettings', JSON.stringify(settings));
}

/**
 * Clear all notifications with a specific tag
 */
export async function clearNotifications(tag?: string): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const notifications = await registration.getNotifications({ tag });
    notifications.forEach(notification => notification.close());
  } catch (error) {
    console.error('Error clearing notifications:', error);
  }
}

/**
 * Helper to format notification body with truncation
 */
export function formatNotificationBody(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Create notification for new reply
 */
export function notifyReply(authorName: string, replyContent: string, postId: string): void {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.replies) return;

  showNotification('reply', {
    title: `${authorName} replied to your post`,
    body: formatNotificationBody(replyContent),
    tag: `reply-${postId}`,
    data: {
      url: `/post/${postId}`,
      postId
    },
    requireInteraction: false,
    vibrate: settings.vibrate ? [200, 100, 200] : undefined
  });
}

/**
 * Create notification for new like
 */
export function notifyLike(userName: string, postId: string): void {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.likes) return;

  showNotification('like', {
    title: `${userName} liked your post`,
    body: 'Tap to view your post',
    tag: `like-${postId}-${Date.now()}`,
    data: {
      url: `/post/${postId}`,
      postId
    },
    silent: !settings.sound
  });
}

/**
 * Create notification for poll vote
 */
export function notifyPollVote(userName: string, pollQuestion: string, postId: string): void {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.votes) return;

  showNotification('vote', {
    title: `${userName} voted on your poll`,
    body: formatNotificationBody(pollQuestion),
    tag: `vote-${postId}-${Date.now()}`,
    data: {
      url: `/post/${postId}`,
      postId
    },
    silent: !settings.sound
  });
}

/**
 * Create notification for mention
 */
export function notifyMention(authorName: string, content: string, postId: string): void {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.mentions) return;

  showNotification('mention', {
    title: `${authorName} mentioned you`,
    body: formatNotificationBody(content),
    tag: `mention-${postId}`,
    data: {
      url: `/post/${postId}`,
      postId
    },
    requireInteraction: true,
    vibrate: settings.vibrate ? [200, 100, 200] : undefined
  });
}

/**
 * Create notification for new follower
 */
export function notifyFollow(userName: string, userId: string): void {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.follows) return;

  showNotification('follow', {
    title: `${userName} started following you`,
    body: 'Tap to view their profile',
    tag: `follow-${userId}`,
    data: {
      url: `/profile/${userName}`,
      userId
    },
    silent: !settings.sound
  });
}

/**
 * Test notification functionality
 */
export async function testNotification(): Promise<void> {
  const permission = await requestNotificationPermission();
  if (permission === 'granted') {
    showNotification('system', {
      title: 'Notifications Enabled!',
      body: 'You will now receive notifications for important events.',
      requireInteraction: false
    });
  }
}