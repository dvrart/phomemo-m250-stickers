# Phomemo M250 Sticker Studio (`olha`) — инструкция для любого AI

Веб-приложение (React + Vite + TypeScript + Tailwind) для дизайна и печати наклеек на принтере Phomemo M250 с локальным HTTPS-мостом через Cloudflare Tunnel (`cloudflared.exe`).

## Ключевые параметры

- **Папка:** `C:\Projects\olha`
- **GitHub:** `https://github.com/dvrart/phomemo-m250-stickers` (ветка `master`, публикация `bridge.json` в ветку `gh-pages`)
- **Локальные файлы вне Git:** `cloudflared.exe`, `.m250_print_job.bin`, `dist/`, `node_modules/`.
- **Важно по путям Windows:** в `vite.config.ts` используются ASCII-пути внутри `C:/Projects/olha` во избежание проблем с кириллицей в имени пользователя Windows.

## Основные команды

- Локальный запуск (с туннелем и публикацией URL моста в `gh-pages/bridge.json` через `gh api`): `npm run dev`
- Сборка: `npm run build`
- Предпросмотр сборки: `npm run preview`
