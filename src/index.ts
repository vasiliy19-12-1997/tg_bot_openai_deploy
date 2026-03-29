import { bot } from "./bot";
import { globalContext, YCContext } from "./config/context";

export const handler = async function (event: any, context: YCContext) {
  globalContext.context = context;

  try {
    await bot.init();
    await bot.handleUpdate(JSON.parse(event.body));
  } catch (e) {
    console.error("Failed to handle update:", sanitizeError(e));
  }

  return { statusCode: 200, body: "" };
};

const TOKEN_IN_URL_PATTERN = /bot\d+:[A-Za-z0-9_-]+/g;

function sanitizeError(error: unknown): string {
  const raw =
    error instanceof Error ? `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ""}` : String(error);

  return raw.replace(TOKEN_IN_URL_PATTERN, "bot<redacted-token>");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(actionName: string, action: () => Promise<T>, retries = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const delay = attempt * 1500;
        console.warn(`${actionName} failed (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

bot.catch((error) => {
  console.error("Telegram update handling error:", sanitizeError(error.error));
});

const startBot = async () => {
  console.log("Starting bot...");

  try {
    const me = await withRetry("getMe", () => bot.api.getMe(), 3);
    console.log(`Token OK. Authenticated as @${me.username}.`);
  } catch (error) {
    console.error(
      "Failed to call getMe(). Check BOT_TOKEN, internet, firewall/antivirus, proxy/VPN, or Telegram API blocking.",
    );
    console.error(sanitizeError(error));
    return;
  }

  try {
    await withRetry("deleteWebhook", () => bot.api.deleteWebhook({ drop_pending_updates: true }), 3);
    console.log("Webhook removed. Starting long polling...");
  } catch (error) {
    console.error("Failed to remove webhook before polling startup:");
    console.error(sanitizeError(error));
    return;
  }

  let isStarted = false;
  const startupWarningTimer = setTimeout(() => {
    if (!isStarted) {
      console.warn(
        "Bot is still starting after 15 seconds. Possible causes: blocked requests to api.telegram.org, VPN/proxy issues, antivirus/firewall, or network DPI.",
      );
    }
  }, 15_000);

  bot
    .start({
      drop_pending_updates: true,
      onStart: () => {
        isStarted = true;
        clearTimeout(startupWarningTimer);
        console.log("Bot started");
      },
    })
    .catch((error) => {
      clearTimeout(startupWarningTimer);
      console.error("Failed to start bot:");
      console.error(sanitizeError(error));
    });
};

void startBot();
