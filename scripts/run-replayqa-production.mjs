import { spawn } from "node:child_process"

const projectId = required("REPLAY_QA_PRODUCTION_PROJECT_ID")
required("REPLAY_QA_API_KEY")

const cliVersion = process.env.REPLAYQA_CLI_VERSION ?? "0.2.2"
const productionUrl = required("REPLAY_QA_PRODUCTION_URL")
const prompt =
  process.env.REPLAYQA_PRODUCTION_PROMPT ??
  "Smoke-test the public Reminders production app: create a reminder, mark it complete, search for a reminder, switch between smart and custom lists, and verify the Apple Reminders-style navigation and empty states."

console.log(
  `Starting Replay QA production test for ${projectId} against ${productionUrl}.`
)

try {
  const exploration = await runCli([
    "start-exploration",
    "--project",
    projectId,
    "--prompt",
    prompt,
  ])
  console.log("Replay QA production exploration/test run request accepted:")
  console.log(exploration.stdout.trim())

  const latestRuns = await runCli([
    "test-runs",
    "--project",
    projectId,
    "--page-size",
    "5",
  ])
  console.log("Latest Replay QA production test runs:")
  console.log(latestRuns.stdout.trim())
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
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

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}
