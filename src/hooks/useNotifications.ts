import { useEffect, useCallback, useState } from 'react';

interface NotificationState {
  permission: NotificationPermission | 'default';
  supported: boolean;
}

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationState>({
    permission: 'default',
    supported: false
  });

  useEffect(() => {
    // Check if notifications are supported
    const supported = 'Notification' in window;
    
    if (supported) {
      setPermission({
        permission: Notification.permission,
        supported: true
      });
    } else {
      setPermission({
        permission: 'denied',
        supported: false
      });
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!permission.supported) {
      return 'denied';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(prev => ({ ...prev, permission: result }));
      return result;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }, [permission.supported]);

  const showNotification = useCallback(async (options: NotificationOptions) => {
    // Check permission first
    if (permission.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    if (!permission.supported) {
      console.warn('Notifications not supported');
      return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/icons/message.svg',
        badge: options.badge || '/icons/message.svg',
        tag: options.tag,
        data: options.data,
        requireInteraction: true, // Keep notification visible until user interacts
        silent: false,
      });

      // Handle notification click
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        
        // Handle custom data if provided
        if (options.data?.url && typeof options.data.url === 'string') {
          window.location.href = options.data.url;
        }
        
        notification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }, [permission]);

  const showMessageNotification = useCallback((
    senderName: string,
    message: string,
    conversationId: string,
    senderAvatar?: string
  ) => {
    return showNotification({
      title: `New message from ${senderName}`,
      body: message,
      icon: senderAvatar || '/icons/message.svg',
      tag: `message-${conversationId}`,
      data: {
        type: 'message',
        conversationId,
        url: `/messages?conversation=${conversationId}`
      }
    });
  }, [showNotification]);

  const showRequestNotification = useCallback((
    senderName: string,
    conversationId: string,
    senderAvatar?: string
  ) => {
    return showNotification({
      title: 'New message request',
      body: `${senderName} wants to send you a message`,
      icon: senderAvatar || '/icons/message.svg',
      tag: `request-${conversationId}`,
      data: {
        type: 'request',
        conversationId,
        url: `/messages?conversation=${conversationId}`
      }
    });
  }, [showNotification]);

  return {
    permission: permission.permission,
    supported: permission.supported,
    requestPermission,
    showNotification,
    showMessageNotification,
    showRequestNotification
  };
}

// Hook for managing notification subscriptions in messaging
export function useMessageNotifications(userId: string, isAppActive: boolean = true) {
  const { 
    permission, 
    showMessageNotification, 
    showRequestNotification,
    requestPermission 
  } = useNotifications();

  // Auto-request permission if not set
  useEffect(() => {
    if (permission === 'default') {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleNewMessage = useCallback((
    message: {
      id: string;
      sender_id: string;
      content: string;
    },
    senderName: string,
    conversationId: string,
    senderAvatar?: string
  ) => {
    // Don't show notification if:
    // - App is active and user is viewing this conversation
    // - Message is from current user
    // - No permission
    if (isAppActive || message.sender_id === userId || permission !== 'granted') {
      return;
    }

    showMessageNotification(
      senderName,
      message.content || 'Sent a media file',
      conversationId,
      senderAvatar
    );
  }, [isAppActive, userId, permission, showMessageNotification]);

  const handleNewRequest = useCallback((
    senderName: string,
    conversationId: string,
    senderAvatar?: string
  ) => {
    if (permission !== 'granted') {
      return;
    }

    showRequestNotification(senderName, conversationId, senderAvatar);
  }, [permission, showRequestNotification]);

  return {
    permission,
    handleNewMessage,
    handleNewRequest,
    requestPermission
  };
}

// Service Worker registration for push notifications (advanced)
export function useServiceWorkerNotifications() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registered:', reg);
          setRegistration(reg);
          
          // Check for existing subscription
          return reg.pushManager.getSubscription();
        })
        .then((sub) => {
          if (sub) {
            setSubscription(sub);
          }
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  const subscribeToPush = useCallback(async (vapidPublicKey: string) => {
    if (!registration) {
      throw new Error('Service Worker not registered');
    }

    try {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      setSubscription(subscription);
      
      // Send subscription to server
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription,
          userId: null // Would need to get from auth context
        })
      });

      return subscription;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      throw error;
    }
  }, [registration]);

  return {
    registration,
    subscription,
    subscribeToPush,
    supported: 'serviceWorker' in navigator && 'PushManager' in window
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}