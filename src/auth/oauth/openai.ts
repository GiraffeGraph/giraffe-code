import type { OAuthCredential } from "../types.js";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  openBrowser,
  waitForCallback,
  exchangeCode,
} from "./pkce.js";

const AUTH_URL = "https://auth.openai.com/oauth/authorize";
const TOKEN_URL = "https://auth.openai.com/oauth/token";
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const SCOPES = "openid profile email offline_access";

const CALLBACK_PORT = 1455;
const CALLBACK_PATH = "/auth/callback";
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;

export type LoginProgress = (message: string) => void;

function extractAccountId(jwtToken: string): string | undefined {
  try {
    const payload = JSON.parse(
      Buffer.from(jwtToken.split(".")[1] ?? "", "base64url").toString("utf8")
    ) as Record<string, unknown>;
    const auth = payload["https://api.openai.com/auth"] as
      | Record<string, unknown>
      | undefined;
    return (auth?.["chatgpt_account_id"] as string | undefined) ?? undefined;
  } catch {
    return undefined;
  }
}

function buildCredential(
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): OAuthCredential {
  const cred: OAuthCredential = {
    type: "oauth",
    access: accessToken,
    refresh: refreshToken,
    expires: Date.now() + expiresIn * 1000,
  };

  const accountId = extractAccountId(accessToken);
  if (accountId) cred["accountId"] = accountId;

  return cred;
}

export async function loginOpenAI(
  onProgress: LoginProgress = () => {}
): Promise<OAuthCredential> {
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);
  const state = generateState();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
  });

  const authUrl = `${AUTH_URL}?${params}`;

  const callbackPromise = waitForCallback(
    CALLBACK_PORT,
    CALLBACK_PATH,
    state
  );

  onProgress(`Opening browser for OpenAI login...\n${authUrl}`);
  openBrowser(authUrl);
  onProgress("Waiting for browser authentication...");

  const { code } = await callbackPromise;

  onProgress("Exchanging authorization code for tokens...");

  // OpenAI token endpoint uses form-encoded body
  const tokens = await exchangeCode(
    TOKEN_URL,
    {
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    },
    "form"
  );

  return buildCredential(
    tokens.access_token,
    tokens.refresh_token,
    tokens.expires_in
  );
}

export async function refreshOpenAI(
  credential: OAuthCredential
): Promise<OAuthCredential> {
  const tokens = await exchangeCode(
    TOKEN_URL,
    {
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: credential.refresh,
    },
    "form"
  );

  return buildCredential(
    tokens.access_token,
    tokens.refresh_token,
    tokens.expires_in
  );
}
