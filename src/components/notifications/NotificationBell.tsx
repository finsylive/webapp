"use client";

import { useState } from 'react';
import { Bell, BellOff, Settings, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useNotifications } from '@/context/NotificationContext';
import { useRouter } from 'next/navigation';

export function NotificationBell() {
  const router = useRouter();
  const {
    permission,
    settings,
    isSupported,
    enableNotifications,
    testNotification
  } = useNotifications();

  const [showDropdown, setShowDropdown] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);

  const handleEnableClick = async () => {
    setIsEnabling(true);
    const success = await enableNotifications();
    setIsEnabling(false);
    if (success) {
      setShowDropdown(false);
    }
  };

  const isEnabled = permission === 'granted' && settings.enabled;

  if (!isSupported) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative"
      >
        {isEnabled ? (
          <Bell className="h-5 w-5" />
        ) : (
          <BellOff className="h-5 w-5 text-muted-foreground" />
        )}
        
        {/* Notification dot indicator */}
        {isEnabled && (
          <span className="absolute top-1 right-1 h-2 w-2 bg-primary rounded-full animate-pulse" />
        )}
      </Button>

      {/* Dropdown menu */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-72 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in-0 zoom-in-95">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </h3>
              <button
                onClick={() => {
                  setShowDropdown(false);
                  router.push('/settings#notifications');
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-4">
            {isEnabled ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-500">
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-medium">Notifications enabled</span>
                </div>
                
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>You&rsquo;ll receive notifications for:</p>
                  <ul className="space-y-1 ml-4">
                    {settings.replies && <li>• Replies to your posts</li>}
                    {settings.likes && <li>• Likes on your posts</li>}
                    {settings.votes && <li>• Votes on your polls</li>}
                    {settings.mentions && <li>• Mentions</li>}
                    {settings.follows && <li>• New followers</li>}
                  </ul>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    testNotification();
                    setShowDropdown(false);
                  }}
                  className="w-full"
                >
                  Send Test Notification
                </Button>
              </div>
            ) : permission === 'denied' ? (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-2">Notifications blocked</p>
                  <p>You&rsquo;ve blocked notifications for this site. To enable them:</p>
                  <ol className="mt-2 space-y-1 ml-4">
                    <li>1. Click the lock icon in your address bar</li>
                    <li>2. Find &ldquo;Notifications&rdquo; settings</li>
                    <li>3. Change to &ldquo;Allow&rdquo;</li>
                    <li>4. Refresh this page</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Stay updated with replies, likes, and mentions
                </p>
                
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleEnableClick}
                  disabled={isEnabling}
                  className="w-full"
                >
                  {isEnabling ? (
                    <>
                      <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                      Enabling...
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4 mr-2" />
                      Enable Notifications
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}