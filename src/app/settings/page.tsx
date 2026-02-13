'use client';

import React, { useState } from 'react';
import { useTheme } from '@/context/theme/ThemeContext';
import { NotificationSettings as NotificationSettingsComponent } from '@/components/settings/NotificationSettings';

import {
  Settings,
  Palette,
  Bell,
  ShieldAlert,
  LogOut,
  Info,
  ChevronRight,
  ChevronLeft,
  User,
  Globe,
  Lock,
  Mail,
  Smartphone,
  Database,
  Download,
  Trash2,
  HelpCircle,
  MessageSquare,
  Shield,
  Eye,
  Cookie,
  Volume2,
  Monitor,
  Sun,
  Moon
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

const colorSwatches: Record<string, string> = {
  emerald: '#10b981',
  violet: '#8b5cf6',
  blue: '#3b82f6',
  amber: '#f59e0b',
};

const SettingsPage = () => {
  const { theme, setTheme, colorScheme, setColorScheme, isDarkMode } = useTheme();
  const [activeSection, setActiveSection] = useState('main');

  const [notifications, setNotifications] = useState({
    push: true,
    email: false,
    desktop: true,
    sounds: true
  });

  type NotificationKey = keyof typeof notifications;

  const accentColor = colorSwatches[colorScheme] || colorSwatches.emerald;

  interface SettingCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    onClick?: () => void;
    disabled?: boolean;
    badge?: string | null;
  }

  const SettingCard = ({ icon, title, description, onClick, disabled = false, badge = null }: SettingCardProps) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all duration-200 text-left group ${
        disabled
          ? 'bg-muted border-border cursor-not-allowed opacity-60'
          : 'bg-card border-border hover:border-primary/30 hover:shadow-sm cursor-pointer'
      }`}
    >
      <div className="flex items-center">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center mr-3">
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground text-sm">{title}</h3>
            {badge && (
              <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );

  interface BackButtonProps {
    onClick: () => void;
    title: string;
  }

  const BackButton = ({ onClick, title }: BackButtonProps) => (
    <div className="flex items-center mb-4">
      <button
        onClick={onClick}
        className="flex items-center text-muted-foreground hover:text-foreground transition-colors mr-3"
      >
        <ChevronLeft className="h-5 w-5 mr-1" />
        <span className="text-sm">Back</span>
      </button>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
    </div>
  );

  const ColorSchemeSelector = () => (
    <div className="bg-card border border-border rounded-xl p-6 mb-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Color Scheme</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(colorSwatches).map(([scheme, color]) => (
          <button
            key={scheme}
            onClick={() => setColorScheme(scheme as 'emerald' | 'violet' | 'blue' | 'amber')}
            className={`relative p-3 rounded-lg border transition-all ${
              colorScheme === scheme
                ? 'border-primary ring-1 ring-primary'
                : 'border-border hover:border-primary/40'
            }`}
          >
            <div className="flex items-center">
              <div className="w-6 h-6 rounded-full mr-2" style={{ backgroundColor: color }} />
              <span className="text-sm font-medium capitalize text-foreground">
                {scheme}
              </span>
            </div>
            {colorScheme === scheme && (
              <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: color }}>
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  const IconBox = ({ icon: Icon }: { icon: typeof Settings }) => (
    <div className="w-full h-full bg-primary/10 rounded-xl flex items-center justify-center">
      <Icon className="h-5 w-5 text-primary" />
    </div>
  );

  const MainSettings = () => (
    <div className="space-y-6 px-4">
      {/* Header Card */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
        <div className="flex items-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mr-4">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground mb-1">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your app preferences and account settings</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-all cursor-pointer">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mr-3">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Current Theme</h3>
              <p className="text-sm text-muted-foreground capitalize">{theme} &bull; {colorScheme}</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-all cursor-pointer">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mr-3">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Notifications</h3>
              <p className="text-sm text-muted-foreground">
                {Object.values(notifications).filter(Boolean).length} enabled
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-all cursor-pointer">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mr-3">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Security</h3>
              <p className="text-sm text-muted-foreground">All secure</p>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div>
        <h3 className="text-xl font-semibold text-foreground mb-4">Preferences</h3>
        <div className="space-y-3">
          <SettingCard
            icon={<IconBox icon={Palette} />}
            title="Appearance"
            description="Themes, colors, and display settings"
            onClick={() => setActiveSection('appearance')}
          />
          <SettingCard
            icon={<IconBox icon={Bell} />}
            title="Notifications"
            description="Manage notification preferences and delivery"
            onClick={() => setActiveSection('notifications')}
          />
          <SettingCard
            icon={<IconBox icon={ShieldAlert} />}
            title="Privacy & Security"
            description="Data protection and security settings"
            onClick={() => setActiveSection('privacy')}
          />
          <SettingCard
            icon={<IconBox icon={Globe} />}
            title="Language & Region"
            description="Localization and accessibility options"
            badge="New"
          />
        </div>
      </div>

      {/* Account Section */}
      <div>
        <h3 className="text-xl font-semibold text-foreground mb-4">Account</h3>
        <div className="space-y-3">
          <SettingCard
            icon={<IconBox icon={User} />}
            title="Profile Settings"
            description="Manage your profile information and preferences"
            onClick={() => setActiveSection('profile')}
          />
          <SettingCard
            icon={<IconBox icon={Database} />}
            title="Data Management"
            description="Export, backup, and delete your data"
            onClick={() => setActiveSection('data')}
          />
          <SettingCard
            icon={<div className="w-full h-full bg-destructive/10 rounded-xl flex items-center justify-center"><LogOut className="h-6 w-6 text-destructive" /></div>}
            title="Sign Out"
            description="Sign out of your account"
            onClick={() => alert('Signing out...')}
          />
        </div>
      </div>

      {/* Support Section */}
      <div>
        <h3 className="text-xl font-semibold text-foreground mb-4">Support</h3>
        <div className="space-y-3">
          <SettingCard
            icon={<IconBox icon={HelpCircle} />}
            title="Help Center"
            description="Get help and find answers to common questions"
          />
          <SettingCard
            icon={<IconBox icon={MessageSquare} />}
            title="Contact Support"
            description="Get in touch with our support team"
          />
        </div>
      </div>

      {/* Version Info */}
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground border-t border-border">
        <Info className="h-4 w-4 mr-2" />
        <span>Ments v1.0.0</span>
        <span className="mx-3">&bull;</span>
        <span>Made with love for the community</span>
      </div>
    </div>
  );

  const ThemeOption = ({ themeValue, label, desc, icon: Icon, iconBg }: {
    themeValue: 'system' | 'light' | 'dark';
    label: string;
    desc: string;
    icon: typeof Monitor;
    iconBg: string;
  }) => {
    const isActive = theme === themeValue;
    return (
      <div
        className={`relative bg-card border rounded-xl p-4 cursor-pointer transition-all hover:border-primary/40 ${
          isActive ? 'border-primary ring-1 ring-primary' : 'border-border'
        }`}
        onClick={() => setTheme(themeValue)}
      >
        <div className="flex items-center">
          <div className={`w-12 h-12 rounded-lg mr-4 flex items-center justify-center ${iconBg}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center">
              <h3 className="font-medium text-foreground">{label}</h3>
              {isActive && (
                <span
                  className="ml-2 px-2 py-0.5 text-white text-xs rounded-full"
                  style={{ backgroundColor: accentColor }}
                >
                  Active
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </div>
          <div className="ml-auto">
            <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${
              isActive ? 'border-primary' : 'border-border'
            }`}>
              {isActive && (
                <div className="w-4 h-4 rounded-full bg-primary" />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AppearanceSettings = () => (
    <div className="space-y-6">
      <BackButton onClick={() => setActiveSection('main')} title="Appearance" />

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mr-4">
            <Palette className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Customize your experience</h2>
            <p className="text-sm text-muted-foreground">Choose a theme and color scheme that matches your style</p>
          </div>
        </div>
      </div>

      {/* Color Scheme Selector */}
      <ColorSchemeSelector />

      {/* Theme Toggle Section */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Theme Preference</h3>
        <div className="space-y-4">
          <ThemeOption
            themeValue="system"
            label="System"
            desc="Use your device's system preference"
            icon={Monitor}
            iconBg="bg-secondary text-muted-foreground"
          />
          <ThemeOption
            themeValue="light"
            label="Light"
            desc="Clean light theme"
            icon={Sun}
            iconBg="bg-amber-100 text-amber-600"
          />
          <ThemeOption
            themeValue="dark"
            label="Dark"
            desc="Dark theme for low-light environments"
            icon={Moon}
            iconBg="bg-slate-800 text-blue-400"
          />
        </div>
      </div>

      {/* Additional Settings */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Display Settings</h3>
        <div className="space-y-3">
          <SettingCard
            icon={<IconBox icon={Eye} />}
            title="Font Size"
            description="Adjust text size for better readability"
            badge="Coming Soon"
            disabled={true}
          />
          <SettingCard
            icon={<IconBox icon={Palette} />}
            title="Custom Themes"
            description="Create and manage custom color themes"
            badge="Coming Soon"
            disabled={true}
          />
        </div>
      </div>

      {/* Info Message */}
      <div className="bg-muted border border-border rounded-xl p-5 mt-4">
        <div className="flex">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-foreground">Theme and color scheme changes will be applied immediately and saved to your preferences.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const NotificationSettings = () => (
    <div className="space-y-6">
      <BackButton onClick={() => setActiveSection('main')} title="Notifications" />

      {/* Browser Notification Settings Component */}
      <NotificationSettingsComponent />

      {/* Legacy Push Notifications */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Additional Settings</h3>
        <div className="space-y-4">
          {Object.entries({
            push: { label: 'Mobile Push', desc: 'Receive notifications on your mobile device', icon: Smartphone },
            email: { label: 'Email Notifications', desc: 'Get updates via email', icon: Mail },
            sounds: { label: 'Notification Sounds', desc: 'Play sounds for notifications', icon: Volume2 }
          }).map(([key, { label, desc, icon: Icon }]) => {
            const notificationKey = key as NotificationKey;
            return (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mr-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">{label}</h4>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => setNotifications(prev => ({ ...prev, [notificationKey]: !prev[notificationKey] }))}
                  className="w-12 h-6 rounded-full relative transition-colors"
                  style={{ backgroundColor: notifications[notificationKey] ? accentColor : isDarkMode ? '#4b5563' : '#d1d5db' }}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${notifications[notificationKey] ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const PrivacySettings = () => (
    <div className="space-y-6">
      <BackButton onClick={() => setActiveSection('main')} title="Privacy & Security" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Privacy</h3>
          <div className="space-y-3">
            <SettingCard
              icon={<IconBox icon={Eye} />}
              title="Data Visibility"
              description="Control who can see your data"
            />
            <SettingCard
              icon={<IconBox icon={Cookie} />}
              title="Cookie Preferences"
              description="Manage cookie settings"
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Security</h3>
          <div className="space-y-3">
            <SettingCard
              icon={<IconBox icon={Lock} />}
              title="Two-Factor Authentication"
              description="Add extra security to your account"
              badge="Recommended"
            />
            <SettingCard
              icon={<IconBox icon={Shield} />}
              title="Active Sessions"
              description="Manage your active login sessions"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const DataManagement = () => (
    <div className="space-y-6">
      <BackButton onClick={() => setActiveSection('main')} title="Data Management" />

      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Your Data</h3>
        <div className="space-y-3">
          <SettingCard
            icon={<IconBox icon={Download} />}
            title="Export Data"
            description="Download a copy of your data"
          />
          <SettingCard
            icon={<div className="w-full h-full bg-destructive/10 rounded-xl flex items-center justify-center"><Trash2 className="h-5 w-5 text-destructive" /></div>}
            title="Delete Account"
            description="Permanently delete your account and data"
          />
        </div>
      </div>
    </div>
  );

  const ProfileSettings = () => (
    <div className="space-y-6">
      <BackButton onClick={() => setActiveSection('main')} title="Profile Settings" />

      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Profile Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Display Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              placeholder="Your display name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email</label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Bio</label>
            <textarea
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              rows={3}
              placeholder="Tell us about yourself..."
            />
          </div>
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );

  const renderCurrentSection = () => {
    switch (activeSection) {
      case 'appearance':
        return <AppearanceSettings />;
      case 'notifications':
        return <NotificationSettings />;
      case 'privacy':
        return <PrivacySettings />;
      case 'data':
        return <DataManagement />;
      case 'profile':
        return <ProfileSettings />;
      default:
        return <MainSettings />;
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full max-w-full px-0 py-4">
        {renderCurrentSection()}
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
