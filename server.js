const http = require("node:http");
const { execFileSync } = require("node:child_process");
const next = require("next");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());
const { monitorServices } = require("./lib/services");

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.DASHBOARD_PORT || 3333);

function tailscaleAddress() {
  if (process.env.DASHBOARD_HOST) return process.env.DASHBOARD_HOST;
  try {
    const output = execFileSync("ipconfig", { encoding: "utf8" });
    const section = output.match(/adapter Tailscale:[\s\S]*?(?=\r?\n\S[^\r\n]*adapter |$)/i)?.[0];
    return section?.match(/IPv4 Address[^:]*:\s*([0-9.]+)/i)?.[1] || "0.0.0.0";
  } catch {
    return "0.0.0.0";
  }
}

const hostname = tailscaleAddress();
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = http.createServer((req, res) => handle(req, res));
  server.listen(port, hostname, () => {
    const displayHost = hostname === "0.0.0.0" ? "localhost" : hostname;
    console.log(`\nLocal Control is ready at http://${displayHost}:${port}\n`);
    monitorServices();
    setInterval(monitorServices, 30_000).unref();
  });
});
