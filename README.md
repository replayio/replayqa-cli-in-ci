# Reminders · Replay QA in CI

A small, local-first reminders app with an Apple Reminders-inspired desktop layout. It is built
with Next.js App Router and the shadcn CLI's React Aria base (`aria-nova`), so the primary controls
use React Aria's keyboard and screen-reader behavior.

## Run it locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Reminders and custom lists are saved in the
browser's local storage. The demo includes Today, Scheduled, All Reminders, Flagged, and Completed
smart lists, plus Personal, Groceries, Work, and Travel lists.

## Replay QA setup

The pull-request workflow starts the production Next server, installs the pinned Replay QA CLI with
`npx`, connects the runner through the managed reverse proxy, and queues a new exploration-backed
test run. The app and proxy stay alive while the workflow polls that exploration to a terminal status,
then the proxy's JSON log is uploaded as a workflow artifact.

The target project must be created once as a reverse-proxy project because the CI runner's localhost
is not reachable from Replay's test browsers. With a Replay QA API key, run this from the repo after
building the app or use the equivalent project setup in the Replay QA dashboard:

```bash
REPLAY_QA_API_KEY=lqa_... npx --yes replayqa@0.2.2 create-project \
  --name "Reminders · CI" \
  --target-url http://127.0.0.1:3000 \
  --reverse-proxy \
  --instructions "Test creating, completing, searching, and switching reminder lists."
```

Add these repository secrets in GitHub under **Settings → Secrets and variables → Actions**:

- `REPLAY_QA_PROJECT_ID` — the `proj-...` id returned by the command above.
- `REPLAY_QA_API_KEY` — a durable Replay QA API key that can access that project. The local
  `~/.replay/profile/auth.json` file contains a short-lived OAuth `accessToken`; do not use that
  value as a long-lived CI secret. Create a dedicated API key for Actions and rotate it when needed.

The PR workflow runs for opened, reopened, and updated pull requests, and can also be started with
**Run workflow**. Forked pull requests are skipped because GitHub does not expose repository secrets
to untrusted fork workflows. Before starting the app, it validates both secret presence and access to the
configured Replay project, so missing or stale credentials fail with a focused error.

The checked-in `.replay/config.example.json` documents the local project shape without committing a
project id. For a manual local proxy, copy it to `.replay/config.json` and run:

```bash
REPLAY_QA_API_KEY=lqa_... npx --yes replayqa@0.2.2 run http://127.0.0.1:3000 \
  --no-app \
  --project "$REPLAY_QA_PROJECT_ID" \
  --qa-url https://qa.replay.io
```

The CI orchestration lives in [`scripts/run-replayqa-ci.mjs`](scripts/run-replayqa-ci.mjs). It waits
for the proxy's JSON `heartbeat` event with `ready: true` before calling `replayqa start-exploration`,
polls `replayqa exploration <id>` until completion, and then prints the latest five test runs for the
project. The PR job allows up to one hour for the exploration and emits periodic status lines while
the tunnel remains active, so long-running journey batches do not look idle to the runner.

## Production deployment and QA

The `Deploy production · Replay QA` workflow runs after every push to `main` (including a merged
pull request). It validates the app, builds and deploys the project with the Vercel CLI, waits for a
stable public production URL, and then starts a Replay QA exploration against the production project.
The production project must be configured in Replay QA with its target URL set to the same stable URL;
the production job does not use the localhost reverse proxy.

This repo assumes Vercel for the Next.js deployment. Add these additional GitHub Actions secrets:

- `VERCEL_TOKEN` — a Vercel token that can deploy the project.
- `VERCEL_ORG_ID` — the Vercel team or account id.
- `VERCEL_PROJECT_ID` — the Vercel project id.
- `REPLAY_QA_PRODUCTION_PROJECT_ID` — a normal public Replay QA project pointed at production.
- `REPLAY_QA_PRODUCTION_URL` — the stable production URL, such as `https://reminders.example.com`.

`REPLAY_QA_API_KEY` is reused by both workflows and must be able to access the local reverse-proxy
project and the production project. The production orchestration lives in
[`scripts/run-replayqa-production.mjs`](scripts/run-replayqa-production.mjs); it submits the test
run and prints the latest five production runs.

## Checks

```bash
npm run check
```

`check` runs TypeScript, ESLint, and a production Next build.
