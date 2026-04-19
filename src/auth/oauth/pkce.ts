import { randomBytes, createHash } from "crypto";
import { createServer } from "http";
import { URL } from "url";
import { exec } from "child_process";

// ── PKCE helpers ─────────────────────────────────────────────────────────────

export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function generateState(): string {
  return randomBytes(16).toString("base64url");
}

// ── Browser open ──────────────────────────────────────────────────────────────

export function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;

  exec(cmd); // fire-and-forget — errors are non-fatal
}

// ── Local OAuth callback server ───────────────────────────────────────────────

export type CallbackResult = {
  code: string;
};

export function waitForCallback(
  port: number,
  path: string,
  expectedState: string,
  timeoutMs = 120_000
): Promise<CallbackResult> {
  return new Promise<CallbackResult>((resolve, reject) => {
    const server = createServer((req, res) => {
      const reqUrl = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

      if (reqUrl.pathname !== path) {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = reqUrl.searchParams.get("code");
      const state = reqUrl.searchParams.get("state");

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem">
          <h2>✅ Authentication successful!</h2>
          <p>You can close this tab and return to your terminal.</p>
        </body></html>`
      );

      server.close();
      clearTimeout(timer);

      if (state !== expectedState) {
        reject(new Error("OAuth state mismatch — possible CSRF; try logging in again"));
        return;
      }

      if (!code) {
        reject(new Error("No authorization code in callback"));
        return;
      }

      resolve({ code });
    });

    const timer = setTimeout(() => {
      server.close();
      reject(new Error("OAuth timeout: no browser callback received within 2 minutes"));
    }, timeoutMs);

    server.listen(port, "127.0.0.1");
    server.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Could not start local callback server on port ${port}: ${err.message}`));
    });
  });
}

// ── Token exchange ────────────────────────────────────────────────────────────

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  [key: string]: unknown;
};

export async function exchangeCode(
  tokenUrl: string,
  params: Record<string, string>,
  encoding: "json" | "form" = "json"
): Promise<TokenResponse> {
  const [body, contentType] =
    encoding === "form"
      ? [
          new URLSearchParams(params).toString(),
          "application/x-www-form-urlencoded",
        ]
      : [JSON.stringify(params), "application/json"];

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Token exchange failed (${response.status}): ${errorText}`
    );
  }

  return response.json() as Promise<TokenResponse>;
}
