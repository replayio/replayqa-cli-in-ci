import { createWriteStream } from "node:fs"
import { spawn } from "node:child_process"
import { setTimeout as delay } from "node:timers/promises"

const projectId = required("REPLAY_QA_PROJECT_ID")
required("REPLAY_QA_API_KEY")
const githubRepository = required("REPLAYQA_GITHUB_REPOSITORY")
const githubPrNumber = required("REPLAYQA_GITHUB_PR_NUMBER")
const githubHeadSha = required("REPLAYQA_GITHUB_HEAD_SHA")
const githubHeadRef = required("REPLAYQA_GITHUB_HEAD_REF")
const githubWorkflowRunId = required("REPLAYQA_GITHUB_RUN_ID")

const cliVersion = process.env.REPLAYQA_CLI_VERSION ?? "0.2.3"
const qaUrl = process.env.REPLAY_QA_URL ?? "https://qa.replay.io"
const cliEnv = { ...process.env, REPLAY_QA_URL: qaUrl }
const proxyPort = process.env.REPLAYQA_PROXY_PORT ?? "18888"
const runTimeoutMs = Number(process.env.REPLAYQA_RUN_TIMEOUT_MS ?? 3_600_000)
const runMarker = process.env.REPLAYQA_RUN_MARKER?.trim()
const basePrompt =
  process.env.REPLAYQA_PROMPT ??
  "Exercise the Reminders app: create a reminder, mark it complete, search for a reminder, switch lists, and verify the main navigation and empty states."
const prompt = runMarker ? `${basePrompt}\n\nReplay QA CI marker: ${runMarker}` : basePrompt
const proxyTimeoutMs = Number(process.env.REPLAYQA_PROXY_TIMEOUT_MS ?? 300_000)
const proxyLogPath = process.env.REPLAYQA_PROXY_LOG ?? "/tmp/replayqa-proxy.jsonl"

const proxyLog = createWriteStream(proxyLogPath, { flags: "a" })
const proxyOutput = []
let proxyBuffer = ""
let proxyReady = false
let terminationRequested = false
let signalCleanupPromise
let resolveProxyReady
let rejectProxyReady

const proxyReadyPromise = new Promise((resolve, reject) => {
  resolveProxyReady = resolve
  rejectProxyReady = reject
})

const proxy = spawn(
  "npx",
  [
    "--yes",
    `replayqa@${cliVersion}`,
    "proxy",
    "--project",
    projectId,
    "--qa-url",
    qaUrl,
    "--local-port",
    proxyPort,
    "--json",
  ],
  {
    env: cliEnv,
    stdio: ["ignore", "pipe", "pipe"],
  }
)

proxy.stdout.on("data", (chunk) => handleProxyOutput("stdout", chunk))
proxy.stderr.on("data", (chunk) => handleProxyOutput("stderr", chunk))
proxy.once("error", (error) => rejectProxyReady(error))
process.once("SIGINT", () => {
  terminationRequested = true
  void cleanUpActiveCiRun()
})
process.once("SIGTERM", () => {
  terminationRequested = true
  void cleanUpActiveCiRun()
})
proxy.once("exit", (code, signal) => {
  if (!proxyReady) {
    rejectProxyReady(new Error(`Replay QA proxy exited before readiness (code=${code ?? "none"}, signal=${signal ?? "none"}).`))
  }
})

try {
  await waitForProxyReady()
  if (terminationRequested) throw new Error("Replay QA CI run was terminated before it started.")
  console.log(`Replay QA reverse proxy is ready for ${projectId}.`)

  const explorationResult = await runCli([
    "ci",
    "--project",
    projectId,
    "--repository",
    githubRepository,
    "--pr-number",
    githubPrNumber,
    "--head-sha",
    githubHeadSha,
    "--branch",
    githubHeadRef,
    "--workflow-run-id",
    githubWorkflowRunId,
    "--prompt",
    prompt,
  ])
  const exploration = parseJson(explorationResult.stdout, "ci")
  if (typeof exploration.id !== "string" || exploration.id.length === 0) {
    throw new Error("Replay QA ci did not return an exploration id.")
  }
  if (typeof exploration.pr_run_id !== "string" || exploration.pr_run_id.length === 0) {
    throw new Error("Replay QA ci did not return a PR run id.")
  }
  if (terminationRequested) throw new Error("Replay QA CI run was terminated while it was starting.")
  console.log("Replay QA exploration/test run request accepted:")
  console.log(explorationResult.stdout.trim())

  await waitForCiRun(exploration.pr_run_id)

  const latestRuns = await runCli(["test-runs", "--project", projectId, "--page-size", "5"])
  console.log("Latest Replay QA test runs:")
  console.log(latestRuns.stdout.trim())
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  if (proxyOutput.length > 0) {
    console.error("Last Replay QA proxy output:")
    console.error(proxyOutput.slice(-20).join("\n"))
  }
  process.exitCode = 1
} finally {
  await stopProcess(proxy)
  await new Promise((resolve) => proxyLog.end(resolve))
}

async function waitForCiRun(prRunId) {
  const deadline = Date.now() + runTimeoutMs
  let lastStatus
  let lastHeartbeatAt = 0

  while (true) {
    if (terminationRequested) throw new Error("Replay QA CI run was terminated while waiting for QA completion.")
    const result = await runCli([
      "api",
      "POST",
      `/projects/${projectId}/ci-runs/status`,
      "--data",
      JSON.stringify(ciRunMetadata()),
    ])
    const ciRun = parseJson(result.stdout, "ci run status")
    const status = typeof ciRun.status === "string" ? ciRun.status : "unknown"
    const now = Date.now()

    if (status !== lastStatus || now - lastHeartbeatAt >= 60_000) {
      console.log(`Replay QA CI run ${prRunId} status: ${status}; tunnel remains active.`)
      lastStatus = status
      lastHeartbeatAt = now
    }

    if (ciRun.terminal === true) {
      if (status !== "completed") {
        throw new Error(`Replay QA CI run ${prRunId} ended with status: ${status}.`)
      }
      return ciRun
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out after ${runTimeoutMs}ms waiting for Replay QA CI run ${prRunId} to finish.`
      )
    }

    await delay(15_000)
  }
}

function ciRunMetadata() {
  return {
    repository: githubRepository,
    pr_number: githubPrNumber,
    head_sha: githubHeadSha,
    branch: githubHeadRef,
    workflow_run_id: githubWorkflowRunId,
  }
}

async function cleanUpActiveCiRun() {
  if (signalCleanupPromise) return signalCleanupPromise

  signalCleanupPromise = (async () => {
    try {
      await runCli([
        "ci-cancel",
        "--project",
        projectId,
        "--repository",
        githubRepository,
        "--pr-number",
        githubPrNumber,
        "--head-sha",
        githubHeadSha,
        "--branch",
        githubHeadRef,
        "--workflow-run-id",
        githubWorkflowRunId,
      ])
      console.error(`Cancelled Replay QA CI run for ${githubRepository}#${githubPrNumber} after workflow termination.`)
    } catch (error) {
      console.error(
        `Could not cancel Replay QA CI run for ${githubRepository}#${githubPrNumber} after workflow termination: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }

    await stopProcess(proxy)
  })()

  return signalCleanupPromise
}

async function waitForProxyReady() {
  const timeout = setTimeout(() => {
    rejectProxyReady(new Error(`Timed out after ${proxyTimeoutMs}ms waiting for the Replay QA reverse proxy.`))
  }, proxyTimeoutMs)

  try {
    await proxyReadyPromise
  } finally {
    clearTimeout(timeout)
  }
}

function handleProxyOutput(stream, chunk) {
  const text = chunk.toString()
  proxyLog.write(`[${stream}] ${text}`)
  proxyOutput.push(...text.trimEnd().split("\n").filter(Boolean))
  proxyOutput.splice(0, Math.max(0, proxyOutput.length - 100))

  if (stream !== "stdout") return
  proxyBuffer += text
  const lines = proxyBuffer.split("\n")
  proxyBuffer = lines.pop() ?? ""

  for (const line of lines) {
    try {
      const event = JSON.parse(line)
      if (event.event === "heartbeat" && event.ready === true) {
        proxyReady = true
        resolveProxyReady()
      }
    } catch {
      // npx can emit non-JSON progress lines; the proxy's JSON heartbeat is authoritative.
    }
  }
}

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["--yes", `replayqa@${cliVersion}`, ...args], {
      env: cliEnv,
      stdio: ["ignore", "pipe", "pipe"],
    })
    const stdout = []
    const stderr = []

    child.stdout.on("data", (chunk) => stdout.push(chunk.toString()))
    child.stderr.on("data", (chunk) => stderr.push(chunk.toString()))
    child.once("error", reject)
    child.once("exit", (code, signal) => {
      const result = { stdout: stdout.join(""), stderr: stderr.join("") }
      if (code === 0) {
        resolve(result)
      } else {
        reject(
          new Error(
            `replayqa ${args[0]} failed (code=${code ?? "none"}, signal=${signal ?? "none"}).\n${result.stderr || result.stdout}`
          )
        )
      }
    })
  })
}

function parseJson(stdout, command) {
  try {
    return JSON.parse(stdout)
  } catch (error) {
    throw new Error(
      `replayqa ${command} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill("SIGTERM")
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(5_000),
  ])
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL")
}

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}
