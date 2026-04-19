import type { OAuthCredential } from "../types.js";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  openBrowser,
  waitForCallback,
  exchangeCode,
} from "./pkce.js";

// Mirrors the OAuth flow used in pi-coding-agent's pi-ai implementation.
const AUTH_URL = "https://claude.ai/oauth/authorize";
const TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const SCOPES =
  "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload";

const CALLBACK_PORT = 53692;
const CALLBACK_PATH = "/callback";
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;

const EARLY_REFRESH_MS = 5 * 60 * 1000;

function buildCredential(
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): OAuthCredential {
  return {
    type: "oauth",
    access: accessToken,
    refresh: refreshToken,
    expires: Date.now() + expiresIn * 1000 - EARLY_REFRESH_MS,
  };
}

export type LoginProgress = (message: string) => void;

export async function loginAnthropic(
  onProgress: LoginProgress = () => {}
): Promise<OAuthCredential> {
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);

  // Keep state identical to verifier for max compatibility with Claude Code style flows.
  const state = verifier;

  const params = new URLSearchParams({
    code: "true",
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  const authUrl = `${AUTH_URL}?${params.toString()}`;

  const callbackPromise = waitForCallback(CALLBACK_PORT, CALLBACK_PATH, state);

  onProgress(`Opening browser for Anthropic login...\n${authUrl}`);
  openBrowser(authUrl);
  onProgress("Waiting for browser authentication...");

  const { code } = await callbackPromise;

  onProgress("Exchanging authorization code for tokens...");
  const tokens = await exchangeCode(TOKEN_URL, {
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    code,
    state,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });

  return buildCredential(
    tokens.access_token,
    tokens.refresh_token,
    tokens.expires_in
  );
}

export async function refreshAnthropic(
  credential: OAuthCredential
): Promise<OAuthCredential> {
  const tokens = await exchangeCode(TOKEN_URL, {
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    refresh_token: credential.refresh,
  });

  return buildCredential(
    tokens.access_token,
    tokens.refresh_token,
    tokens.expires_in
  );
}
