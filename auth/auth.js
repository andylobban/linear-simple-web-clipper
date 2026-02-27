// Linear OAuth2 with PKCE
// Replace CLIENT_ID with your Linear OAuth app's client ID
const CLIENT_ID = '8f157fa575e4464f9f1ec04b5e95891f';
const REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`;
const AUTH_URL = 'https://linear.app/oauth/authorize';
const TOKEN_URL = 'https://api.linear.app/oauth/token';
const SCOPES = 'read,write';

async function generatePKCE() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return { codeVerifier, codeChallenge };
}

function buildAuthUrl(codeChallenge, state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForToken(code, codeVerifier) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: codeVerifier
    }).toString()
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  return response.json();
}

export async function authenticate() {
  const { codeVerifier, codeChallenge } = await generatePKCE();
  const state = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
    .replace(/[^a-zA-Z0-9]/g, '');

  const authUrl = buildAuthUrl(codeChallenge, state);

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      async (redirectUrl) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (!redirectUrl) {
          return reject(new Error('No redirect URL returned'));
        }

        try {
          const url = new URL(redirectUrl);
          const code = url.searchParams.get('code');
          const returnedState = url.searchParams.get('state');

          if (returnedState !== state) {
            return reject(new Error('State mismatch — possible CSRF'));
          }
          if (!code) {
            return reject(new Error('No code in redirect URL'));
          }

          const tokenData = await exchangeCodeForToken(code, codeVerifier);
          const expiresAt = Date.now() + (tokenData.expires_in || 315360000) * 1000;

          await chrome.storage.local.set({
            linear_access_token: tokenData.access_token,
            linear_token_expiry: expiresAt
          });

          resolve(tokenData.access_token);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

export async function getAccessToken() {
  const { linear_access_token, linear_token_expiry } =
    await chrome.storage.local.get(['linear_access_token', 'linear_token_expiry']);

  if (linear_access_token && linear_token_expiry > Date.now()) {
    return linear_access_token;
  }

  // Token expired or missing — re-authenticate
  return authenticate();
}

export async function logout() {
  await chrome.storage.local.remove(['linear_access_token', 'linear_token_expiry']);
}

export async function isAuthenticated() {
  const { linear_access_token, linear_token_expiry } =
    await chrome.storage.local.get(['linear_access_token', 'linear_token_expiry']);
  return !!(linear_access_token && linear_token_expiry > Date.now());
}
