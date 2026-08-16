import { createWriteStream } from "node:fs"
import { spawn } from "node:child_process"
import { setTimeout as delay } from "node:timers/promises"

const projectId = required("REPLAY_QA_PROJECT_ID")
required("REPLAY_QA_API_KEY")

const cliVersion = process.env.REPLAYQA_CLI_VERSION ?? "0.2.2"
const qaUrl = process.env.REPLAY_QA_URL ?? "https://qa.replay.io"
const proxyPort = process.env.REPLAYQA_PROXY_PORT ?? "18888"
const prompt =
  process.env.REPLAYQA_PROMPT ??
  "Exercise the Reminders app: create a reminder, mark it complete, search for a reminder, switch lists, and verify the main navigation and empty states."
const proxyTimeoutMs = Number(process.env.REPLAYQA_PROXY_TIMEOUT_MS ?? 300_000)
const proxyLogPath = process.env.REPLAYQA_PROXY_LOG ?? "/tmp/replayqa-proxy.jsonl"

const proxyLog = createWriteStream(proxyLogPath, { flags: "a" })
const proxyOutput = []
let proxyBuffer = ""
let proxyReady = false
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
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  }
)

proxy.stdout.on("data", (chunk) => handleProxyOutput("stdout", chunk))
proxy.stderr.on("data", (chunk) => handleProxyOutput("stderr", chunk))
proxy.once("error", (error) => rejectProxyReady(error))
proxy.once("exit", (code, signal) => {
  if (!proxyReady) {
    rejectProxyReady(new Error(`Replay QA proxy exited before readiness (code=${code ?? "none"}, signal=${signal ?? "none"}).`))
  }
})

try {
  await waitForProxyReady()
  console.log(`Replay QA reverse proxy is ready for ${projectId}.`)

  const exploration = await runCli([
    "start-exploration",
    "--project",
    projectId,
    "--prompt",
    prompt,
  ])
  console.log("Replay QA exploration/test run request accepted:")
  console.log(exploration.stdout.trim())

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
      env: process.env,
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
