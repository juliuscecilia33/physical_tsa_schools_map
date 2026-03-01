# Authentication Setup Guide

This guide will walk you through completing the authentication setup for your application.

## What's Been Implemented

✅ Supabase Auth infrastructure with SSR support
✅ Login page with Google OAuth and Magic Link options
✅ Protected routes via middleware (requires login for everything)
✅ Sign-out functionality in NavigationSidebar
✅ Auth callback handling for OAuth redirects
✅ SQL migration for secure RLS policies

## Setup Steps

### 1. Configure Google OAuth in Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** in the list and enable it
5. You'll need to create OAuth credentials:

#### Creating Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure the OAuth consent screen if prompted
6. For Application type, select **Web application**
7. Add authorized redirect URIs:
   - For development: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Replace `<your-project-ref>` with your actual Supabase project reference (found in project settings)
8. Copy the **Client ID** and **Client Secret**
9. Back in Supabase, paste these credentials in the Google provider settings
10. Save the changes

### 2. Configure Magic Link Email Settings

Magic Links are automatically enabled in Supabase, but you may want to customize the email template:

1. In Supabase Dashboard, go to **Authentication** → **Email Templates**
2. Customize the "Magic Link" template if desired
3. The default template works fine for testing

**Note:** For production, configure a custom SMTP server in **Project Settings** → **Auth** → **SMTP Settings**

### 3. Run the Database Migration

Apply the RLS policy updates to secure your database:

```bash
# If using Supabase CLI (recommended)
supabase db push

# OR manually run the migration
# 1. Go to Supabase Dashboard → SQL Editor
# 2. Copy the contents of: supabase/migrations/20250228_enable_auth_rls_policies.sql
# 3. Paste and execute the SQL
```

This migration will:
- Remove public access policies (the insecure `USING (true)` policies)
- Create new policies requiring authentication
- Secure all tables: `sports_facilities`, `facility_notes`, `facility_tags`, `facility_tag_assignments`

### 4. Set Up Redirect URLs

In your Supabase project settings:

1. Go to **Authentication** → **URL Configuration**
2. Add your site URL:
   - Development: `http://localhost:3000`
   - Production: Your production domain
3. Add redirect URLs:
   - Development: `http://localhost:3000/auth/callback`
   - Production: `https://yourdomain.com/auth/callback`

### 5. Test the Authentication Flow

1. Start your development server:
```bash
npm run dev
```

2. Visit `http://localhost:3000`
3. You should be redirected to `/login`

#### Test Google OAuth:
1. Click "Continue with Google"
2. Select your Google account
3. Authorize the application
4. You should be redirected back and logged in

#### Test Magic Link:
1. Enter your email address
2. Click "Send Magic Link"
3. Check your email for the magic link
4. Click the link to log in
5. You should be redirected back and logged in

### 6. Verify Everything Works

Once logged in:
- ✅ You should see your email initial in the bottom of the navigation sidebar
- ✅ Hovering over the avatar should show your email
- ✅ The "Sign Out" button should appear at the bottom
- ✅ You should have access to both Map (/) and CRM (/crm) pages
- ✅ Clicking "Sign Out" should log you out and redirect to login

## Troubleshooting

### "Authentication failed" error
- Verify Google OAuth credentials are correct in Supabase
- Check that redirect URLs match exactly (including http/https)
- Ensure your Supabase project is not paused

### Magic Link not received
- Check spam folder
- Verify email service is configured in Supabase
- For production, configure custom SMTP

### Redirect loop or infinite redirects
- Clear browser cookies and cache
- Verify middleware.ts is not blocking auth routes
- Check that `/login` and `/auth/callback` are not protected

### Database errors
- Ensure the RLS migration was applied successfully
- Check Supabase logs for policy violations
- Verify tables have RLS enabled

### TypeScript errors
- Run `npm install` to ensure all dependencies are installed
- Restart your TypeScript server in VS Code

## Next Steps (Optional Enhancements)

If you want to add more features later:

1. **User Roles**: Add admin/editor/viewer roles
   - Create a `user_roles` table
   - Update RLS policies to check roles
   - Add role-based UI elements

2. **User Metadata**: Track created_by/updated_by
   - Add columns to tables
   - Update forms to include user ID
   - Show user attribution in UI

3. **Email Verification**: Require email confirmation
   - Enable in Supabase Auth settings
   - Prevents fake email signups

4. **Additional OAuth Providers**: GitHub, Microsoft, etc.
   - Configure in Supabase Auth providers
   - Add buttons to login page

5. **Session Management**: Custom session duration
   - Configure in Supabase Auth settings
   - Add "Remember me" option

## Security Notes

- ✅ All routes require authentication
- ✅ Database enforces RLS policies
- ✅ Passwords never stored (OAuth + Magic Link only)
- ✅ Secure session cookies via Supabase SSR
- ✅ HTTPS required in production

## Support

If you encounter issues:
1. Check Supabase Dashboard logs
2. Review browser console for errors
3. Verify all environment variables are set
4. Consult [Supabase Auth docs](https://supabase.com/docs/guides/auth)
