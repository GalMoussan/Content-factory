/**
 * YouTube OAuth2 Authorization Script (Desktop App — loopback redirect)
 *
 * Usage: npx tsx scripts/authorize-youtube.ts
 *
 * Google allows desktop apps to use http://localhost as redirect URI
 * without registering it in the console.
 */
import http from 'node:http';
import { URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

// Load .env manually
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) continue;
  const key = trimmed.slice(0, eqIndex).trim();
  const value = trimmed.slice(eqIndex + 1).trim();
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET || CLIENT_ID === 'placeholder') {
  console.error('\n❌ Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env first.\n');
  process.exit(1);
}

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

// Start local server first to get the actual port
const server = http.createServer(async (req, res) => {
  // Ignore favicon and other non-root requests
  if (req.url?.startsWith('/favicon')) {
    res.writeHead(204);
    res.end();
    return;
  }

  console.log(`Received request: ${req.url}`);

  const url = new URL(req.url ?? '/', `http://127.0.0.1`);

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h1>Authorization denied</h1><p>${error}</p>`);
    console.error(`\n❌ Authorization denied: ${error}\n`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<p>Waiting for authorization...</p>');
    return;
  }

  const redirectUri = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json() as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    if (tokens.error) {
      throw new Error(`${tokens.error}: ${tokens.error_description}`);
    }

    if (!tokens.refresh_token) {
      throw new Error('No refresh token received. Revoke access at myaccount.google.com/permissions and retry.');
    }

    // Update .env
    let env = fs.readFileSync(envPath, 'utf8');
    env = env.replace(
      /^YOUTUBE_REFRESH_TOKEN=.*$/m,
      `YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`,
    );
    fs.writeFileSync(envPath, env, 'utf8');

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>✅ Success!</h1><p>Refresh token saved to .env. You can close this tab.</p>');

    console.log('\n✅ Authorization successful!');
    console.log(`   Refresh token: ${tokens.refresh_token.slice(0, 20)}...`);
    console.log('   Saved to .env\n');
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h1>❌ Failed</h1><p>${(err as Error).message}</p>`);
    console.error(`\n❌ Token exchange failed: ${(err as Error).message}\n`);
  }

  server.close();
});

// Listen on port 0 = OS picks a random available port
server.listen(0, '127.0.0.1', () => {
  const port = (server.address() as { port: number }).port;
  const redirectUri = `http://127.0.0.1:${port}`;

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('\n🔑 YouTube OAuth2 Authorization\n');
  console.log('Opening browser for Google sign-in...');
  console.log(`(Listening on ${redirectUri})\n`);

  import('node:child_process').then(({ exec }) => {
    exec(`open "${authUrl.toString()}"`);
  });
});
