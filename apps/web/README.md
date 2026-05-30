# AI-Finance Web Workbench

Vite + React 19 frontend for the AI-Finance multi-agent research workspace.

## Highlights

- Conversation-first stock research dashboard with synchronized stock context.
- News terminal with source grouping, article detail view, original-source fallback, and a news AI assistant that can analyze selected articles or user-provided links.
- Configurable expert-agent roundtable. Agent count, prompts, models, temperature, icons and enable state are managed in System Settings.
- Evidence-chain report generation with source traces, provider health, agent opinions and appendix views.
- K-line/multimodal analysis, backtesting, portfolio risk, fund and DCA research modules.
- Local-first settings center for API keys, network preferences, security flags, data-source health and agent orchestration.

## Local Development

```bash
npm install
npm run dev
```

The dev server defaults to `http://localhost:3000`.

Set backend and demo behavior in `.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_API_KEY=
VITE_USE_MOCK_REPORT=false
```

## Verification

```bash
npm run lint
npm run build
```

`npm run lint` uses `tsc --noEmit`. `npm run build` may emit a Vite chunk-size warning; that is currently expected for the single-bundle workbench.

## User Notes

- Agent configuration is stored in browser localStorage under `ai-finance:agent-configs-v1`.
- Enabled agent runtime settings are sent with analysis requests through the `agent_configs` payload field.
- The app is a research and review tool. It does not provide investment advice and all outputs must be independently verified.
