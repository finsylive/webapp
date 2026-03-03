# OAuth Provider Setup Guide

## Error Fix: "Unsupported provider: provider is not enabled"

This guide walks you through enabling OAuth providers (Google, GitHub, etc.) in your Supabase project.

---

## Your Supabase Project Details

- **Project URL**: `https://kauvbuymmxixxzyposqc.supabase.co`
- **Project Ref**: `kauvbuymmxixxzyposqc`
- **Callback URL**: `https://kauvbuymmxixxzyposqc.supabase.co/auth/v1/callback`

---

## Step 1: Enable Providers in Supabase Dashboard

1. Open your Supabase project dashboard:
   - Go to: https://supabase.com/dashboard/project/kauvbuymmxixxzyposqc
   
2. Navigate to **Authentication → Providers** (in the left sidebar)

3. You'll see a list of OAuth providers. For each provider you want to enable:

---

## Step 2: Google OAuth Setup

### A. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Configure consent screen if prompted
6. For Application Type, select **Web application**
7. Add these **Authorized redirect URIs**:
   ```
   https://kauvbuymmxixxzyposqc.supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback
   ```
8. Click **Create** and copy your:
   - Client ID
   - Client Secret

### B. Enable in Supabase

1. In Supabase Dashboard → **Authentication → Providers**
2. Find **Google** and click to expand
3. Toggle **Enable Sign in with Google** ON
4. Paste your Google Client ID
5. Paste your Google Client Secret
6. Click **Save**

---

## Step 3: GitHub OAuth Setup

### A. Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: Ments (or your app name)
   - **Homepage URL**: `http://localhost:3000` (for dev) or your production URL
   - **Authorization callback URL**: `https://kauvbuymmxixxzyposqc.supabase.co/auth/v1/callback`
4. Click **Register application**
5. Copy your **Client ID**
6. Click **Generate a new client secret** and copy it

### B. Enable in Supabase

1. In Supabase Dashboard → **Authentication → Providers**
2. Find **GitHub** and click to expand
3. Toggle **Enable Sign in with GitHub** ON
4. Paste your GitHub Client ID
5. Paste your GitHub Client Secret
6. Click **Save**

---

## Step 4: Configure Site URL & Redirect URLs

1. In Supabase Dashboard → **Authentication → URL Configuration**
2. Set **Site URL** to: `http://localhost:3000` (for dev)
3. Add **Redirect URLs** (one per line):
   ```
   http://localhost:3000
   http://localhost:3000/*
   http://localhost:3000/auth/callback
   ```
4. For production, add your production domain URLs as well

---

## Step 5: Test OAuth Flow

### Start Dev Server
```powershell
npm run dev
```

### Test OAuth Authorization

**Google:**
```powershell
curl.exe -i "https://kauvbuymmxixxzyposqc.supabase.co/auth/v1/authorize?provider=google&redirect_to=http://localhost:3000"
```

**GitHub:**
```powershell
curl.exe -i "https://kauvbuymmxixxzyposqc.supabase.co/auth/v1/authorize?provider=github&redirect_to=http://localhost:3000"
```

If configured correctly, you should get a **302 redirect** to the provider's OAuth page (not a 400 error).

---

## Step 6: Update Your App Code (if needed)

Your app should use Supabase's `signInWithOAuth` method:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Sign in with Google
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'http://localhost:3000/auth/callback'
  }
})

// Or GitHub
await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: 'http://localhost:3000/auth/callback'
  }
})
```

---

## Troubleshooting

### Still seeing "provider is not enabled"?
- Double-check the provider is toggled ON in Supabase Dashboard
- Wait 1-2 minutes after saving for changes to propagate
- Clear browser cache or try incognito mode

### OAuth consent screen errors?
- Verify Client ID and Secret are correct (no extra spaces)
- Ensure redirect URIs in provider dashboard EXACTLY match Supabase callback URL
- For Google: ensure OAuth consent screen is configured

### Redirect not working?
- Check Site URL and Redirect URLs in Supabase settings
- Ensure your app handles the `/auth/callback` route

---

## Security Notes

- **Never commit** OAuth client secrets to git
- Keep `.env.local` in `.gitignore`
- Use environment variables for production deployments
- The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe to expose (it's public)
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only and secret

---

## Next Steps

1. ✅ Enable at least one provider (Google or GitHub recommended)
2. ✅ Add client credentials to Supabase
3. ✅ Configure redirect URLs
4. ✅ Test the OAuth flow
5. ✅ For production: update redirect URLs with your production domain

Once configured, restart your dev server and test sign-in!
