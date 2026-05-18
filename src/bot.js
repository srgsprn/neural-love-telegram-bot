import { Telegraf } from "telegraf";
import { helpText, parseProcessingParameters } from "./parseIntent.js";
import { processImage } from "./neuralLove.js";

const pending = new Map();

function isAllowed(userId, allowedIds) {
  if (!allowedIds.length) return true;
  return allowedIds.includes(String(userId));
}

function mimeFromPath(filePath) {
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function downloadTelegramFile(ctx, fileId) {
  const link = await ctx.telegram.getFileLink(fileId);
  const res = await fetch(link.href);
  if (!res.ok) {
    throw new Error(`Не удалось скачать файл из Telegram: ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") || mimeFromPath(link.pathname);
  return { buffer, mimeType };
}

async function runProcessing(ctx, { buffer, mimeType, instruction }) {
  const { parameters, summary } = parseProcessingParameters(instruction);
  const statusMsg = await ctx.reply(
    `Обрабатываю: ${summary}\nОбычно это 1–3 минуты…`
  );

  try {
    const { orderId, urls } = await processImage(
      ctx.neuralApiKey,
      buffer,
      mimeType,
      parameters
    );

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      undefined,
      `Готово (заказ ${orderId}). Отправляю результат…`
    ).catch(() => {});

    for (let i = 0; i < urls.length; i += 1) {
      const caption =
        urls.length > 1
          ? `Результат ${i + 1}/${urls.length}: ${summary}`
          : summary;
      await ctx.replyWithPhoto(urls[i], { caption });
    }
  } catch (err) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      undefined,
      `Ошибка: ${err.message}`
    ).catch(() => ctx.reply(`Ошибка: ${err.message}`));
  }
}

export function createBot({ token, neuralApiKey, allowedUserIds = [] }) {
  const bot = new Telegraf(token);
  bot.neuralApiKey = neuralApiKey;

  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    if (!isAllowed(userId, allowedUserIds)) {
      await ctx.reply("Доступ к боту ограничен.");
      return;
    }
    return next();
  });

  bot.start(async (ctx) => {
    await ctx.reply(
      "Привет! Пришлите фото и опишите, что с ним сделать.\n\n" + helpText()
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(helpText());
  });

  bot.on("photo", async (ctx) => {
    const photos = ctx.message.photo;
    const best = photos[photos.length - 1];
    const instruction = (ctx.message.caption || "").trim();

    if (instruction) {
      const { buffer, mimeType } = await downloadTelegramFile(ctx, best.file_id);
      await runProcessing(ctx, { buffer, mimeType, instruction });
      return;
    }

    pending.set(ctx.from.id, {
      fileId: best.file_id,
      chatId: ctx.chat.id,
      at: Date.now(),
    });
    await ctx.reply("Фото получено. Напишите, что с ним сделать (или отправьте новое фото с подписью).");
  });

  bot.on("document", async (ctx) => {
    const doc = ctx.message.document;
    if (!doc?.mime_type?.startsWith("image/")) {
      await ctx.reply("Пришлите изображение (фото или файл-картинку).");
      return;
    }

    const instruction = (ctx.message.caption || "").trim();
    const { buffer, mimeType } = await downloadTelegramFile(ctx, doc.file_id);

    if (instruction) {
      await runProcessing(ctx, { buffer, mimeType, instruction });
      return;
    }

    pending.set(ctx.from.id, {
      fileId: doc.file_id,
      chatId: ctx.chat.id,
      at: Date.now(),
    });
    await ctx.reply("Изображение получено. Напишите задачу текстом.");
  });

  bot.on("text", async (ctx) => {
    if (ctx.message.text?.startsWith("/")) return;

    const entry = pending.get(ctx.from.id);
    if (!entry) {
      await ctx.reply("Сначала отправьте фото, затем опишите задачу.\n\n" + helpText());
      return;
    }

    if (Date.now() - entry.at > 30 * 60 * 1000) {
      pending.delete(ctx.from.id);
      await ctx.reply("Время ожидания истекло. Отправьте фото снова.");
      return;
    }

    pending.delete(ctx.from.id);
    const { buffer, mimeType } = await downloadTelegramFile(ctx, entry.fileId);
    await runProcessing(ctx, { buffer, mimeType, instruction: ctx.message.text });
  });

  return bot;
}
