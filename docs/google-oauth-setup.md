# Google OAuth Setup

## 1. Create OAuth Credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select your project (or create one)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth client ID**
5. Choose **Web application**

## 2. Configure OAuth Consent Screen

If not already done, go to **APIs & Services → OAuth consent screen**:

- Set app name, support email, and authorized domains
- Add scopes: `email`, `profile`, `openid`
- For development, set to **Testing** (allows only test users)
- For production, submit for **verification**

## 3. Set Redirect URIs

Add these under **Authorized redirect URIs**:

| Environment | URI |
|-------------|-----|
| Development | `http://localhost:3000/api/auth/callback/google` |
| Production  | `https://yourdomain.com/api/auth/callback/google` |

## 4. Add Environment Variables

Copy the **Client ID** and **Client Secret** from the credentials page and add to `.env`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```
