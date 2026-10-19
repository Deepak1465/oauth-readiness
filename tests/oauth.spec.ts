import { createHash, randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";

// A real OAuth 2.0 authorization-code flow (with PKCE and state) against the fake Acme provider,
// plus the edge cases a provider and a client must get right.

const ACME = "http://acme.localtest.me:4010";
const CLIENT = "http://client.localtest.me:4020";

async function devLogin(page: Page) {
  await page.goto(`${ACME}/console`);
  await page.getByLabel("Username").fill("dev");
  await page.getByLabel("Password").fill("dev");
  await page.getByRole("button", { name: "Sign in" }).click();
}

// Registers an app in the developer console, the way a developer would, and returns its credentials.
async function createApp(page: Page, name: string, redirectUri: string, testUsers: string[] = []) {
  await devLogin(page);
  await page.getByLabel("App name").fill(name);
  await page.getByLabel("Redirect URI").fill(redirectUri);
  await page.getByRole("button", { name: "Create app" }).click();
  await expect(page.getByTestId("status")).toHaveText("Test mode");
  for (const u of testUsers) {
    await page.getByLabel("Add test user").fill(u);
    await page.getByRole("button", { name: "Add", exact: true }).click();
  }
  return {
    clientId: (await page.getByTestId("client-id").textContent())!.trim(),
    clientSecret: (await page.getByTestId("client-secret").textContent())!.trim(),
    consoleUrl: page.url(),
  };
}

async function signIn(page: Page, user: string) {
  await page.getByLabel("Username").fill(user);
  await page.getByLabel("Password").fill(user);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function freshPage(browser: Browser) {
  const ctx = await browser.newContext();
  return ctx.newPage();
}

const pkce = () => {
  const verifier = randomBytes(32).toString("hex");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
};

// Runs the consent flow straight to the /capture page and returns the raw code, for token-endpoint tests.
async function getCode(page: Page, app: { clientId: string }, opts: { scope?: string; challenge?: string } = {}) {
  const u = new URL(`${ACME}/oauth/authorize`);
  u.search = new URLSearchParams({
    client_id: app.clientId,
    redirect_uri: `${CLIENT}/capture`,
    response_type: "code",
    scope: opts.scope ?? "profile.read",
    state: "s1",
    ...(opts.challenge ? { code_challenge: opts.challenge, code_challenge_method: "S256" } : {}),
  }).toString();
  await page.goto(u.toString());
  if (await page.getByLabel("Username").isVisible()) await signIn(page, "alice");
  await page.getByRole("button", { name: "Allow" }).click();
  const captured = JSON.parse((await page.getByTestId("captured").textContent())!);
  expect(captured.state).toBe("s1");
  return captured.code as string;
}

test.describe("Acme OAuth", () => {
  test("happy path: register app, user consents, client gets a token and calls the API", async ({ page, request }) => {
    const app = await createApp(page, "Agent App", `${CLIENT}/callback`, ["alice"]);
    await request.post(`${CLIENT}/setup`, { data: { clientId: app.clientId, clientSecret: app.clientSecret } });

    await page.goto(CLIENT);
    await page.getByRole("link", { name: "Connect Acme" }).click();
    await signIn(page, "alice");
    await expect(page.getByRole("heading", { name: /Agent App wants to access/ })).toBeVisible();
    await expect(page.getByTestId("scopes")).toContainText("contacts.read");
    await page.getByRole("button", { name: "Allow" }).click();

    await expect(page.getByTestId("result")).toHaveText("Connected as Alice Example");
    await expect(page.getByTestId("contacts")).toContainText("Carol Customer");
  });

  test("user denies consent: client shows access_denied", async ({ page, request }) => {
    const app = await createApp(page, "Deny App", `${CLIENT}/callback`, ["alice"]);
    await request.post(`${CLIENT}/setup`, { data: { clientId: app.clientId, clientSecret: app.clientSecret } });
    await page.goto(`${CLIENT}/connect`);
    await signIn(page, "alice");
    await page.getByRole("button", { name: "Deny" }).click();
    await expect(page.getByTestId("result")).toHaveText("Connection failed: access_denied");
  });

  test("test mode: a non-test user is blocked until the app passes review", async ({ page, browser, request }) => {
    const app = await createApp(page, "Review App", `${CLIENT}/callback`, ["alice"]);
    await request.post(`${CLIENT}/setup`, { data: { clientId: app.clientId, clientSecret: app.clientSecret } });

    const bob = await freshPage(browser);
    await bob.goto(`${CLIENT}/connect`);
    await signIn(bob, "bob");
    await expect(bob.getByRole("heading", { name: "access_denied" })).toBeVisible();
    await expect(bob.getByTestId("error-description")).toContainText("is in test mode");

    await page.goto(app.consoleUrl);
    await page.getByRole("button", { name: "Simulate passing App review" }).click();
    await expect(page.getByTestId("status")).toHaveText("Live");

    await bob.goto(`${CLIENT}/connect`);
    await bob.getByRole("button", { name: "Allow" }).click();
    await expect(bob.getByTestId("result")).toHaveText("Connected as Bob Outsider");
  });

  test("redirect_uri not registered: provider shows an error and never redirects", async ({ page }) => {
    const app = await createApp(page, "Strict App", `${CLIENT}/callback`, ["alice"]);
    await page.goto(`${ACME}/oauth/authorize?client_id=${app.clientId}&redirect_uri=${encodeURIComponent("https://evil.example/steal")}&response_type=code&scope=profile.read&state=x`);
    await expect(page.getByRole("heading", { name: "invalid_redirect_uri" })).toBeVisible();
    expect(new URL(page.url()).host).toBe("acme.localtest.me:4010");
  });

  test("unknown client_id: provider shows invalid_client", async ({ page }) => {
    await page.goto(`${ACME}/oauth/authorize?client_id=nope&redirect_uri=${encodeURIComponent(`${CLIENT}/callback`)}&response_type=code&scope=profile.read`);
    await expect(page.getByRole("heading", { name: "invalid_client" })).toBeVisible();
  });

  test("unknown scope: provider redirects back with invalid_scope", async ({ page }) => {
    const app = await createApp(page, "Scope App", `${CLIENT}/capture`, ["alice"]);
    await page.goto(`${ACME}/oauth/authorize?client_id=${app.clientId}&redirect_uri=${encodeURIComponent(`${CLIENT}/capture`)}&response_type=code&scope=admin.all&state=s9`);
    const captured = JSON.parse((await page.getByTestId("captured").textContent())!);
    expect(captured).toMatchObject({ error: "invalid_scope", state: "s9" });
  });

  test("state mismatch: client rejects a forged callback (CSRF)", async ({ page }) => {
    await page.goto(`${CLIENT}/callback?code=forged&state=not-one-we-issued`);
    await expect(page.getByTestId("result")).toHaveText("Connection failed: state mismatch");
  });

  test("authorization code can be used only once", async ({ page, request }) => {
    const app = await createApp(page, "Replay App", `${CLIENT}/capture`, ["alice"]);
    const code = await getCode(page, app);
    const form = { grant_type: "authorization_code", code, redirect_uri: `${CLIENT}/capture`, client_id: app.clientId, client_secret: app.clientSecret };
    const first = await request.post(`${ACME}/oauth/token`, { form });
    expect(first.status()).toBe(200);
    const token = (await first.json()).access_token;
    const second = await request.post(`${ACME}/oauth/token`, { form });
    expect(second.status()).toBe(400);
    expect(await second.json()).toMatchObject({ error: "invalid_grant", error_description: "Code already used." });
    // Replay revokes the token issued from that code.
    const me = await request.get(`${ACME}/api/me`, { headers: { authorization: `Bearer ${token}` } });
    expect(me.status()).toBe(401);
  });

  test("wrong client secret: invalid_client", async ({ page, request }) => {
    const app = await createApp(page, "Secret App", `${CLIENT}/capture`, ["alice"]);
    const code = await getCode(page, app);
    const res = await request.post(`${ACME}/oauth/token`, {
      form: { grant_type: "authorization_code", code, redirect_uri: `${CLIENT}/capture`, client_id: app.clientId, client_secret: "wrong" },
    });
    expect(res.status()).toBe(401);
    expect(await res.json()).toMatchObject({ error: "invalid_client" });
  });

  test("PKCE: wrong code_verifier is rejected, right one works", async ({ page, request }) => {
    const app = await createApp(page, "PKCE App", `${CLIENT}/capture`, ["alice"]);
    const { verifier, challenge } = pkce();
    const code = await getCode(page, app, { challenge });
    const base = { grant_type: "authorization_code", code, redirect_uri: `${CLIENT}/capture`, client_id: app.clientId };
    const bad = await request.post(`${ACME}/oauth/token`, { form: { ...base, code_verifier: "wrong-verifier" } });
    expect(await bad.json()).toMatchObject({ error: "invalid_grant", error_description: "PKCE verification failed." });
    // The failed attempt didn't consume the code; a public client (no secret) succeeds with the right verifier.
    const good = await request.post(`${ACME}/oauth/token`, { form: { ...base, code_verifier: verifier } });
    expect(good.status()).toBe(200);
  });

  test("expired authorization code is rejected", async ({ page, request }) => {
    const app = await createApp(page, "Slow App", `${CLIENT}/capture`, ["alice"]);
    const code = await getCode(page, app);
    await page.waitForTimeout(3500); // the testbed runs with CODE_TTL_MS=3000
    const res = await request.post(`${ACME}/oauth/token`, {
      form: { grant_type: "authorization_code", code, redirect_uri: `${CLIENT}/capture`, client_id: app.clientId, client_secret: app.clientSecret },
    });
    expect(await res.json()).toMatchObject({ error: "invalid_grant", error_description: "Code expired." });
  });

  test("scopes are enforced: profile-only token can't read contacts, bad token gets 401", async ({ page, request }) => {
    const app = await createApp(page, "Narrow App", `${CLIENT}/capture`, ["alice"]);
    const code = await getCode(page, app, { scope: "profile.read" });
    const tok = await (
      await request.post(`${ACME}/oauth/token`, {
        form: { grant_type: "authorization_code", code, redirect_uri: `${CLIENT}/capture`, client_id: app.clientId, client_secret: app.clientSecret },
      })
    ).json();
    const auth = { authorization: `Bearer ${tok.access_token}` };
    expect((await request.get(`${ACME}/api/me`, { headers: auth })).status()).toBe(200);
    const contacts = await request.get(`${ACME}/api/contacts`, { headers: auth });
    expect(contacts.status()).toBe(403);
    expect(await contacts.json()).toMatchObject({ error: "insufficient_scope" });
    expect((await request.get(`${ACME}/api/me`, { headers: { authorization: "Bearer garbage" } })).status()).toBe(401);
  });
});
