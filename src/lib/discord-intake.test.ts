import assert from "node:assert/strict";
import { authorizeDiscordWebhook } from "./discord-intake";

const HEADER = "x-discord-webhook-secret";
const SECRET = "shared-webhook-secret";
const UNSET_ERROR = "Server configuration error: DISCORD_WEBHOOK_SECRET not set";

const originalSecret = process.env.DISCORD_WEBHOOK_SECRET;

function requestWithSecret(headerValue?: string) {
  const headers = new Headers();
  if (headerValue !== undefined) {
    headers.set(HEADER, headerValue);
  }
  return new Request("https://tracker.example.com/api/issues", { headers });
}

async function assertJsonError(res: Response | null, status: number, error: string) {
  assert.ok(res, `expected ${status} response, got null`);
  assert.equal(res.status, status);
  const body = await res.json();
  assert.deepEqual(body, { error });
  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /shared-webhook-secret/);
}

async function run() {
  try {
    delete process.env.DISCORD_WEBHOOK_SECRET;
    await assertJsonError(
      authorizeDiscordWebhook(requestWithSecret(SECRET)),
      500,
      UNSET_ERROR
    );

    process.env.DISCORD_WEBHOOK_SECRET = "   \n";
    await assertJsonError(
      authorizeDiscordWebhook(requestWithSecret(SECRET)),
      500,
      UNSET_ERROR
    );

    process.env.DISCORD_WEBHOOK_SECRET = SECRET;
    await assertJsonError(
      authorizeDiscordWebhook(requestWithSecret()),
      401,
      "Unauthorized"
    );
    await assertJsonError(
      authorizeDiscordWebhook(requestWithSecret("   \n")),
      401,
      "Unauthorized"
    );
    await assertJsonError(
      authorizeDiscordWebhook(requestWithSecret("wrong-secret")),
      401,
      "Unauthorized"
    );

    assert.equal(authorizeDiscordWebhook(requestWithSecret(SECRET)), null);
    assert.equal(authorizeDiscordWebhook(requestWithSecret(`  ${SECRET}  \n`)), null);

    process.env.DISCORD_WEBHOOK_SECRET = `${SECRET}\n`;
    assert.equal(authorizeDiscordWebhook(requestWithSecret(SECRET)), null);
    assert.equal(authorizeDiscordWebhook(requestWithSecret(`${SECRET}\n`)), null);

    process.env.DISCORD_WEBHOOK_SECRET = `  ${SECRET}  `;
    assert.equal(authorizeDiscordWebhook(requestWithSecret(`\r\n${SECRET}  `)), null);
  } finally {
    if (originalSecret === undefined) {
      delete process.env.DISCORD_WEBHOOK_SECRET;
    } else {
      process.env.DISCORD_WEBHOOK_SECRET = originalSecret;
    }
  }
}

run()
  .then(() => {
    console.log("discord-intake tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
