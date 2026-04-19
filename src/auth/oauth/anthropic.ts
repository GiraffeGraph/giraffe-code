import type { OAuthCredential } from "../types.js";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  openBrowser,
  waitForCallback,
  exchangeCode,
} from "./pkce.js";

// Reverse-engineered from anthropics/claude-code CLI + open-source implementations
// (Roo-Code, pi.dev, opencode-anthropic-auth, anthropic-auth Rust crate).
// AUTH_URL must be claude.ai — client_id 9d1c250a is registered there.
// `code=true` is a non-standard param required by Anthropic's identity server.
// TOKEN_URL: console.anthropic.com is used by most working implementations.
const AUTH_URL = "https://claude.ai/oauth/authorize";
const TOKEN_URL = "https://console.anthropic.com/v1/oauth/token";
const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";

// user:file_upload triggers validation failures on some accounts — omitted.
const SCOPES =
  "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers";

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
  const state = generateState();

  // Build URL with encodeURIComponent — spaces become %20, not +.
  // code=true is required by Anthropic's identity server for this flow.
  const authUrl =
    `${AUTH_URL}?` +
    [
      ["code", "true"],
      ["response_type", "code"],
      ["client_id", CLIENT_ID],
      ["redirect_uri", REDIRECT_URI],
      ["scope", SCOPES],
      ["code_challenge", challenge],
      ["code_challenge_method", "S256"],
      ["state", state],
    ]
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

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
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
    state,
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
