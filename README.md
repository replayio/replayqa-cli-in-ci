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

The GitHub Action starts the production Next server, installs the pinned Replay QA CLI with `npx`,
connects the runner through the managed reverse proxy, and queues a new exploration-backed test run.
The proxy process is kept alive until the CLI has submitted the run, then its JSON log is uploaded
as a workflow artifact.

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
- `REPLAY_QA_API_KEY` — an API key that can access that project.

The workflow runs on pushes to `main` and can also be started with **Run workflow**. It uses
`REPLAY_QA_URL=https://qa.replay.io` by default; set that environment variable in the workflow if
the project lives on another Replay QA deployment.

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
then prints the latest five test runs for the project.

## Checks

```bash
npm run check
```

`check` runs TypeScript, ESLint, and a production Next build.
