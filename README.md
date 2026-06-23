# Neural Love Telegram Bot

**Telegram-бот для AI-обработки фото** — отправляешь изображение и текстовую задачу, получаешь результат через [neural.love API](https://docs.neural.love/ai-images-processing-api).

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Telegraf](https://img.shields.io/badge/Telegraf-bot_API-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://telegraf.js.org)
[![neural.love](https://img.shields.io/badge/neural.love-AI_images-FF6B9D?style=for-the-badge)](https://neural.love)

> [github.com/srgsprn/neural-love-telegram-bot](https://github.com/srgsprn/neural-love-telegram-bot)

---

## О проекте

Бот обрабатывает фото по свободному тексту на русском и английском: улучшение качества, расширение кадра, смена соотношения сторон и др. Сделан **для своей девушки**, чтобы упростить её рабочие процессы с изображениями.

Автор: **Sergei Suprun**

| | |
|---|---|
| **Задача** | AI-обработка фото прямо в Telegram, без веб-интерфейса |
| **Стек** | Node.js, Telegraf, neural.love API |
| **Деплой** | VPS (systemd) |

---

## Возможности

- Парсинг инструкций RU/EN → параметры API (aspect ratio, upscale, uncrop)
- Скачивание файла из Telegram → обработка → отправка результата
- Ограничение доступа по whitelist (`ALLOWED_USER_IDS`)

---

## Быстрый старт

```bash
git clone https://github.com/srgsprn/neural-love-telegram-bot.git
cd neural-love-telegram-bot
cp .env.example .env   # TELEGRAM_BOT_TOKEN, NEURAL_LOVE_API_KEY
npm install && npm start
```

Деплой: `./deploy/deploy.sh`

---

## Навыки

Telegram bots · REST API integration · NLP-lite intent parsing · systemd deploy

---

**Sergei Suprun** · [@srgsprn](https://github.com/srgsprn) · [sergeysuprun@list.ru](mailto:sergeysuprun@list.ru)
