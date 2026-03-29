import "dotenv/config";
import { Bot, session } from "grammy";
import { startHandler } from "./handlers/start";
import { AiAnswerHandler } from "./handlers/ai-answer";
import { Hears } from "./consts/hears";
import { HelpHandler } from "./handlers/help";

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is not set in .env file");
}

export const bot = new Bot(BOT_TOKEN);

bot.use(
  session({
    initial: () => ({
      waitingForAI: false,
    }),
  }),
);

bot.command("start", startHandler);

bot.hears(Hears.AI_HELPER, async (ctx) => {
  ctx.session.waitingForAI = true;
  await ctx.reply("Задайте ваш вопрос:");
});

bot.hears(Hears.TEST_GENERATOR, AiAnswerHandler);
bot.hears(Hears.HELP, HelpHandler);
bot.on("message:text", AiAnswerHandler);
