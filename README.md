# Calcula AI - WhatsApp

## Setup

1. Copy `.env.example` to `.env` and set the values:
	- `EASY_WHATSAPP_KEY` (required)
	- `PORT` (optional, default 3000)
	- `WORKER_FILTER_PHONE` / `FILTER_PHONE` / `ALLOWED_PHONE` (optional)

2. Start in dev:

```sh
pnpm install
pnpm start:dev
```

This project uses NestJS ConfigModule (global) instead of direct `process.env` access.