/**
 * YouTube Auth — obtains a valid OAuth2 access token using googleapis.
 */
import { google } from 'googleapis';

interface OAuthCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
}

/**
 * Obtain a valid access token by refreshing via the OAuth2 client.
 * Throws if credentials are missing or the refresh token is invalid/revoked.
 */
export async function getValidAccessToken(credentials: OAuthCredentials): Promise<string> {
  if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
    throw new Error('Missing OAuth2 credentials: clientId, clientSecret, and refreshToken are required.');
  }

  const oauth2Client = new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
  );

  oauth2Client.setCredentials({ refresh_token: credentials.refreshToken });

  const { token } = await oauth2Client.getAccessToken();

  if (!token) {
    throw new Error('Failed to obtain access token: token was null or empty.');
  }

  return token;
}
