# ContentFactory

A multi-agent autonomous YouTube content creation system for the AI/Tech niche. Five specialized agents run in sequence via a daily cron orchestrator: TrendScout, ResearchCrawler, ContentProducer, QualityController, and Publisher. A lightweight Express dashboard on localhost:3000 shows pipeline status, QA scores, and publish history via server-sent events.

## Stack

- **Backend:** Express.js + TypeScript
- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Database:** SQLite via better-sqlite3
- **AI:** Claude API (Anthropic SDK)
- **Video:** Remotion for video assembly
- **TTS:** Azure TTS
- **Upload:** YouTube Data API v3
- **Testing:** Vitest + Playwright

## Getting Started

```bash
npm install
npm run dev
```

## Structure

```
content-factory/
├── server/
│   └── src/
│       ├── agents/       # Pipeline agents (TrendScout, ResearchCrawler, etc.)
│       ├── queue/         # JSON queue system for inter-agent communication
│       ├── db/            # SQLite database layer
│       ├── routes/        # Express API routes + SSE endpoints
│       ├── services/      # Business logic
│       └── middleware/    # Express middleware
├── client/
│   └── src/
│       ├── components/   # React dashboard components
│       ├── pages/        # Dashboard pages
│       ├── hooks/        # Custom React hooks
│       └── lib/          # Utilities
├── shared/               # Shared types and schemas
├── scripts/              # Cron orchestrator and CLI tools
└── package.json          # Workspace root
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build all packages |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run tests |
| `npm run lint` | Lint code |
| `npm run pipeline` | Run the full agent pipeline once |
| `npm run pipeline:cron` | Start the daily cron scheduler |
