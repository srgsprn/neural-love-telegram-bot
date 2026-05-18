# neural-love-telegram-bot

Telegram-бот: фото + текстовая задача → обработка через [neural.love API](https://docs.neural.love/ai-images-processing-api).

## Настройка

```bash
cp .env.example .env
# TELEGRAM_BOT_TOKEN, NEURAL_LOVE_API_KEY
npm install
npm start
```

## Деплой на VPS

```bash
# один раз на сервере
git clone https://github.com/srgsprn/neural-love-telegram-bot.git /root/neural-love-telegram-bot
cp .env.example .env && nano .env
cp deploy/neural-love-bot.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now neural-love-bot

# обновление
./deploy/deploy.sh
```
