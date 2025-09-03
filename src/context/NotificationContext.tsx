"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  getNotificationSettings,
  saveNotificationSettings,
  showNotification,
  testNotification,
  type NotificationType
} from '@/utils/notifications';

interface NotificationSettings {
  enabled: boolean;
  replies: boolean;
  likes: boolean;
  votes: boolean;
  mentions: boolean;
  follows: boolean;
  sound: boolean;
  vibrate: boolean;
}

interface NotificationContextType {
  permission: NotificationPermission;
  settings: NotificationSettings;
  isSupported: boolean;
  requestPermission: () => Promise<NotificationPermission>;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  sendNotification: (type: NotificationType, options: {
    title: string;
    body?: string;
    icon?: string;
    tag?: string;
    data?: Record<string, unknown>;
  }) => Promise<void>;
  testNotification: () => Promise<void>;
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings());
  const [isSupported, setIsSupported] = useState(false);

  // Initialize notification support check
  useEffect(() => {
    setIsSupported(isNotificationSupported());
    setPermission(getNotificationPermission());
  }, []);

  // Request permission from user
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    const perm = await requestNotificationPermission();
    setPermission(perm);
    return perm;
  }, []);

  // Update notification settings
  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveNotificationSettings(updated);
  }, [settings]);

  // Enable notifications (request permission and enable in settings)
  const enableNotifications = useCallback(async (): Promise<boolean> => {
    const perm = await requestPermission();
    if (perm === 'granted') {
      updateSettings({ enabled: true });
      await testNotification();
      return true;
    }
    return false;
  }, [requestPermission, updateSettings]);

  // Disable notifications
  const disableNotifications = useCallback(() => {
    updateSettings({ enabled: false });
  }, [updateSettings]);

  // Send a notification
  const sendNotification = useCallback(async (type: NotificationType, options: {
    title: string;
    body?: string;
    icon?: string;
    tag?: string;
    data?: Record<string, unknown>;
  }) => {
    if (!settings.enabled || permission !== 'granted') return;
    await showNotification(type, {
      ...options,
      body: options.body || '' // Provide default empty string if body is undefined
    });
  }, [settings.enabled, permission]);

  const value: NotificationContextType = {
    permission,
    settings,
    isSupported,
    requestPermission,
    updateSettings,
    sendNotification,
    testNotification,
    enableNotifications,
    disableNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}