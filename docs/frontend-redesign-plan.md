# Frontend Redesign Migration Plan

## Overview

Migrate UI design from the upstream reference frontend into the existing Next.js app (`apps/web/`).

**Reference Source**: archived frontend reference (`main`, commit `7fc627f`)
**Local Mirror**: `reference-frontend/`
**Reference Stack**: Vite + React + @google/genai (NOT to be used directly)
**Target**: Next.js 15 + existing API layer (`apps/web/src/lib/api.ts`)

## Component Mapping

| Reference Component | Target Component | Status |
|---|---|---|
| `Sidebar.tsx` | `SidebarRail.tsx` (expandable sidebar) | Done |
| `TopBar.tsx` | `TopBar.tsx` (new file) | Done |
| `Workbench.tsx` | `page.tsx` (dashboard layout) | Done |
| `MultimodalChart.tsx` | `KLinePanel.tsx` | Done |
| `Backtesting.tsx` | `QuantLabPanel.tsx` | Done |
| `FundDcaLab.tsx` | `FundDcaPanel.tsx` | Done |
| `Portfolio.tsx` | `PortfolioPanel.tsx` | Done |
| `AgentsSystem.tsx` | `AIAgentPanel.tsx` + `AgentAnalysisPanel.tsx` + `ExpertPanel.tsx` | Done |
| `EvidenceChain.tsx` | `AnalysisPanel.tsx` | Done |
| `ReportGenerator.tsx` | `ArchivePanel.tsx` | Done |
| `NewsAggregator.tsx` | `NewsPanel.tsx` | Done |
| `Settings.tsx` | `SettingsPanel.tsx` | Done |

## Design System

- **Background**: `bg-[#050505]` + glassmorphism (`bg-white/[0.02] border-white/5 backdrop-blur-md`)
- **Colors**: indigo primary (#6366f1), emerald auxiliary, neutral text
- **Fonts**: Space Grotesk (display), JetBrains Mono (mono), Inter (sans)
- **Utility**: `cn()` = clsx + tailwind-merge

## NOT Migrated

- `@google/genai` browser-side API calls (keys must stay server-side)
- Vite config (`vite.config.ts`, `index.html`, `main.tsx`)
- Mock data from reference components (replaced with real API calls)

## API Integration Points

- Quant: `/api/quant/status`, `/api/quant/strategies`, `/api/quant/runs`
- Funds: `/api/funds/*`, `/api/fund-dca/*`
- Portfolio: `/api/fund-portfolio/*`
- Reports: archive/report API
- Agent: chat/analysis/task API
