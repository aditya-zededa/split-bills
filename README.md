# Splitwise clone

WhatsApp-to-split. Paste or speak an expense. Done.

- Next.js 14 (App Router) · TypeScript · Tailwind · shadcn/ui
- Postgres 16 (Docker) · Prisma
- NextAuth (Google OAuth)
- OpenAI Whisper + GPT-4o-mini (Phase 3)
- INR only · Local-only

## Phase 0 — Setup

### 1. Prerequisites

- Node.js 20+
- Docker + Docker Compose
- A Google Cloud project with OAuth 2.0 credentials

### 2. Install

```bash
npm install
```

### 3. Configure env

```bash
cp .env.example .env.local
```

Fill in:

- `NEXTAUTH_SECRET` — run `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console
  - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
- `OPENAI_API_KEY` — only needed in Phase 3

### 4. Start Postgres

```bash
npm run db:up
```

### 5. Migrate + generate Prisma client

```bash
npm run db:migrate -- --name init
npm run db:generate
```

### 6. Run dev server

```bash
npm run dev
```

Open http://localhost:3000 → "Sign in with Google" → redirects to `/groups`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run db:up` | Start Postgres container |
| `npm run db:down` | Stop Postgres container |
| `npm run db:migrate` | Apply Prisma migration |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:studio` | Open Prisma Studio |
| `npm test` | Run vitest once |

## Layout

```
.
├─ app/
│  ├─ api/auth/[...nextauth]/route.ts   NextAuth handler
│  ├─ (auth)/signin/page.tsx             custom signin page
│  ├─ groups/page.tsx                    /groups (stub)
│  ├─ layout.tsx
│  ├─ page.tsx                           /
│  └─ globals.css
├─ components/
│  ├─ providers.tsx                      SessionProvider wrapper
│  └─ ui/button.tsx                      shadcn Button
├─ lib/
│  ├─ auth.ts                            NextAuth config
│  ├─ db.ts                              Prisma client singleton
│  └─ utils.ts                           cn() helper
├─ prisma/schema.prisma
├─ types/next-auth.d.ts                  session.user.id augmentation
├─ docker-compose.yml                    Postgres 16
├─ .env.example
└─ package.json
```

## Roadmap

- [x] **Phase 0** — Scaffold
- [x] **Phase 1** — Groups + manual expenses + balances
- [x] **Phase 2** — Settle-up
- [x] **Phase 3** — Audio (Whisper + GPT parser)
- [x] **Phase 4** — Polish

## Phase 1 — what shipped

API:

| Method | Path | Notes |
|---|---|---|
| GET | `/api/me` | current user |
| GET / POST | `/api/groups` | list / create |
| GET / PATCH / DELETE | `/api/groups/:id` | detail / rename / delete (owner) |
| GET / POST | `/api/groups/:id/invites` | list / create pending invite |
| POST | `/api/invites/accept` | body `{ token }` |
| DELETE | `/api/groups/:id/members/:uid` | self-leave or owner-remove |
| GET / POST | `/api/groups/:id/expenses` | list (paginated) / create |
| GET / PATCH / DELETE | `/api/expenses/:id` | edit / delete |
| GET | `/api/groups/:id/balances` | nets + simplified transfers |
| GET / POST | `/api/groups/:id/settlements` | Phase 2 UI, API scaffolded |

UI:

- `/groups` — list + inline "new group"
- `/groups/[id]` — tabs: Expenses · Balances · Members · Settings
- `/groups/[id]/add` — add expense (Equal / By amount / By percent, include/exclude, live preview)
- `/groups/[id]/expense/[eid]` — edit / delete
- `/invite/[token]` — Google sign-in gate + accept

Tests (`npm test`):

- `tests/split.test.ts` — Equal / Amount / Percent + remainder distribution + validation
- `tests/balances.test.ts` — net computation, zero-sum invariant, greedy simplify

## Phase 2 — Settle-up

- Balances tab now renders a "Settle up" button + per-transfer "Settle" shortcuts that pre-fill the dialog.
- Recording a payment calls `POST /api/groups/:id/settlements` and the nets recompute on refresh.
- Payments list in-line under the balances tab.

## Phase 3 — Audio

Pipeline:

```
[mic] MediaRecorder → webm/opus blob (≤60s, ≤20MB)
  → POST /api/audio/transcribe (multipart)  → Whisper
  → transcript (user-editable)
  → POST /api/audio/parse { transcript, groupId } → GPT-4o-mini tool-use
  → proposed Expense JSON (confidence + notes)
  → ExpenseForm prefilled → user confirms → POST /api/groups/:id/expenses
```

Set `OPENAI_API_KEY` to enable the **🎙️ Record** tab on `/groups/[id]/add`.
If unset the tab is disabled and the Type tab is default.

Risk mitigations:

- `maxDuration: 60s` in the route handler, 20 MB body cap, 60s client-side recorder cap.
- Parser is tool-use constrained to a strict JSON schema; participant ids are filtered against the actual member list before returning.
- Parser never auto-saves: the form is always shown for confirmation.
- Stored `Expense.audioTranscript` when created from audio (`source = AUDIO`).

## Phase 4 — Polish

- **Toasts**: self-contained `ToastProvider` in `components/ui/toast.tsx`; `toast.success / toast.error / toast.info` helpers used by every mutating action (create / rename / delete group, add / edit / delete expense, invite, settle-up, audio errors).
- **Skeletons**: `components/ui/skeleton.tsx`; Balances tab and Activity tab now render shimmer rows while loading.
- **Empty states**: `/groups`, Expenses tab, Balances tab, Activity tab now render icon + message + CTA cards instead of a bare line of muted text.
- **Mobile-first**: group detail header stacks vertically on narrow screens, "Add expense" CTA goes full-width, tab labels scale (`text-xs sm:text-sm`), container gets `px-4` gutter.
- **Activity feed**: new tab on `/groups/[id]` backed by `GET /api/groups/[id]/activity` — time-sorted union of expense creates, settlements, member joins, invite creates; relative "Xm ago" timestamps.

No new Prisma models needed — activity is derived from existing tables (`Expense.createdAt`, `Settlement.date`, `GroupMember.joinedAt`, `Invite.createdAt`), so the Phase 1 migration is still the only one required.

See `splitwise-clone-plan.md` for the full plan.
