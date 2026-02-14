"use client";

import { useState } from 'react';
import { Bell, BellOff, Volume2, VolumeX, Vibrate, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useNotifications } from '@/context/NotificationContext';

export function NotificationSettings() {
  const {
    permission,
    settings,
    isSupported,
    updateSettings,
    enableNotifications,
    disableNotifications,
    testNotification
  } = useNotifications();

  const [isEnabling, setIsEnabling] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleEnableNotifications = async () => {
    setIsEnabling(true);
    const success = await enableNotifications();
    setIsEnabling(false);
    
    if (success) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  if (!isSupported) {
    return (
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <BellOff className="h-6 w-6 text-muted-foreground" />
          <h2 className="text-xl font-bold text-foreground">Notifications</h2>
        </div>
        <p className="text-muted-foreground">
          Browser notifications are not supported on this device or browser.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Notification Settings</h2>
        </div>
        
        {showSuccess && (
          <div className="flex items-center gap-2 text-green-500 animate-in fade-in-0 slide-in-from-right-5">
            <Check className="h-4 w-4" />
            <span className="text-sm font-medium">Notifications enabled!</span>
          </div>
        )}
      </div>

      {/* Permission Status */}
      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
        <div>
          <h3 className="font-semibold text-foreground mb-1">Browser Notifications</h3>
          <p className="text-sm text-muted-foreground">
            {permission === 'granted' 
              ? 'Notifications are enabled for this site'
              : permission === 'denied'
              ? 'Notifications are blocked. Please enable them in your browser settings.'
              : 'Allow notifications to stay updated with replies, likes, and mentions'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {permission === 'granted' && settings.enabled ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={disableNotifications}
              className="gap-2"
            >
              <BellOff className="h-4 w-4" />
              Disable
            </Button>
          ) : permission !== 'denied' ? (
            <Button
              variant="default"
              size="sm"
              onClick={handleEnableNotifications}
              disabled={isEnabling}
              className="gap-2"
            >
              {isEnabling ? (
                <>
                  <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Enabling...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  Enable
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Notification Types */}
      {settings.enabled && permission === 'granted' && (
        <>
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Notification Types</h3>
            
            <NotificationToggle
              label="Replies"
              description="When someone replies to your posts"
              enabled={settings.replies}
              onChange={(enabled) => updateSettings({ replies: enabled })}
              icon="💬"
            />
            
            <NotificationToggle
              label="Likes"
              description="When someone likes your posts"
              enabled={settings.likes}
              onChange={(enabled) => updateSettings({ likes: enabled })}
              icon="❤️"
            />
            
            <NotificationToggle
              label="Poll Votes"
              description="When someone votes on your polls"
              enabled={settings.votes}
              onChange={(enabled) => updateSettings({ votes: enabled })}
              icon="📊"
            />
            
            <NotificationToggle
              label="Mentions"
              description="When someone mentions you in a post"
              enabled={settings.mentions}
              onChange={(enabled) => updateSettings({ mentions: enabled })}
              icon="@"
            />
            
            <NotificationToggle
              label="New Followers"
              description="When someone follows you"
              enabled={settings.follows}
              onChange={(enabled) => updateSettings({ follows: enabled })}
              icon="👥"
            />
          </div>

          {/* Additional Settings */}
          <div className="space-y-4 pt-4 border-t border-border">
            <h3 className="font-semibold text-foreground">Preferences</h3>
            
            <NotificationToggle
              label="Sound"
              description="Play a sound for notifications"
              enabled={settings.sound}
              onChange={(enabled) => updateSettings({ sound: enabled })}
              icon={<Volume2 className="h-5 w-5" />}
              offIcon={<VolumeX className="h-5 w-5" />}
            />
            
            <NotificationToggle
              label="Vibration"
              description="Vibrate on mobile devices"
              enabled={settings.vibrate}
              onChange={(enabled) => updateSettings({ vibrate: enabled })}
              icon={<Vibrate className="h-5 w-5" />}
            />
          </div>

          {/* Test Notification */}
          <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/20">
            <div>
              <h4 className="font-medium text-foreground">Test Notifications</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Send a test notification to check if everything is working
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={testNotification}
              className="gap-2"
            >
              <Bell className="h-4 w-4" />
              Send Test
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

interface NotificationToggleProps {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  icon: React.ReactNode | string;
  offIcon?: React.ReactNode;
}

function NotificationToggle({ 
  label, 
  description, 
  enabled, 
  onChange, 
  icon
}: NotificationToggleProps) {
  return (
    <div className="flex items-center justify-between p-3 hover:bg-muted/30 rounded-xl transition-colors">
      <div className="flex items-center gap-3">
        <div className="text-xl">
          {typeof icon === 'string' ? icon : icon}
        </div>
        <div>
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-primary' : 'bg-muted'
        }`}
        role="switch"
        aria-checked={enabled}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}