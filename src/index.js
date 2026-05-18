import "dotenv/config";
import { createBot } from "./bot.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
const neuralApiKey = process.env.NEURAL_LOVE_API_KEY;

if (!token || !neuralApiKey) {
  console.error("Set TELEGRAM_BOT_TOKEN and NEURAL_LOVE_API_KEY in .env");
  process.exit(1);
}

const allowedUserIds = (process.env.ALLOWED_USER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const bot = createBot({ token, neuralApiKey, allowedUserIds });

bot.launch().then(() => {
  console.log("neural-love-telegram-bot started (long polling)");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
