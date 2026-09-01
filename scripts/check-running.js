const { execFileSync } = require("node:child_process");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

function tailscaleAddress() {
  if (process.env.DASHBOARD_HOST) return process.env.DASHBOARD_HOST;
  try {
    const output = execFileSync("ipconfig", { encoding: "utf8" });
    const section = output.match(/adapter Tailscale:[\s\S]*?(?=\r?\n\S[^\r\n]*adapter |$)/i)?.[0];
    return section?.match(/IPv4 Address[^:]*:\s*([0-9.]+)/i)?.[1] || "127.0.0.1";
  } catch {
    return "127.0.0.1";
  }
}

async function main() {
  const port = Number(process.env.DASHBOARD_PORT || 3333);
  const host = tailscaleAddress();
  const url = `http://${host}:${port}`;
  try {
    const response = await fetch(`${url}/api/status`, { signal: AbortSignal.timeout(2_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log(`Local Control is already running at ${url}`);
    process.exit(0);
  } catch {
    process.exit(1);
  }
}

main();
