const fs = require("node:fs");
const path = require("node:path");
const { execFile, spawn } = require("node:child_process");
const { getNotificationSettings } = require("./settings");

function cleanValue(value) {
  return String(value || "").trim().replace(/^['"]|['"]$/g, "");
}

function validPort(value) {
  const port = Number(cleanValue(value));
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

function serviceKey(id, suffix) {
  const normalized = id.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  return `LOCAL_CONTROL_SERVICE_${normalized}_${suffix}`;
}

function serviceValue(id, suffix, fallback = "") {
  return cleanValue(process.env[serviceKey(id, suffix)] || fallback);
}

function resolveFrom(base, value, fallback = "") {
  const selected = value || fallback;
  if (!selected) return "";
  return path.isAbsolute(selected) ? path.normalize(selected) : path.resolve(base, selected);
}

function loadServices() {
  const ids = cleanValue(process.env.LOCAL_CONTROL_SERVICE_IDS)
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);

  return Object.fromEntries(ids.map((id) => {
    const projectPath = resolveFrom(process.cwd(), serviceValue(id, "PROJECT_PATH"));
    const envFile = resolveFrom(projectPath || process.cwd(), serviceValue(id, "ENV_FILE"), ".env");
    const launcher = resolveFrom(projectPath || process.cwd(), serviceValue(id, "LAUNCHER"));
    const statusPath = serviceValue(id, "STATUS_PATH", "/");
    const openPath = serviceValue(id, "OPEN_PATH", "/");
    const portEnvKeys = serviceValue(id, "PORT_ENV_KEY")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);

    return [id, {
      id,
      name: serviceValue(id, "NAME", id),
      description: serviceValue(id, "DESCRIPTION", "Local Next.js service"),
      path: projectPath,
      launcher,
      envFile,
      fallbackPort: validPort(serviceValue(id, "PORT")),
      portEnvKeys,
      statusPath: statusPath.startsWith("/") ? statusPath : `/${statusPath}`,
      openPath: openPath.startsWith("/") ? openPath : `/${openPath}`,
      ntfyEnvKey: serviceValue(id, "NTFY_ENV_KEY"),
      ntfyTopic: serviceValue(id, "NTFY_TOPIC"),
    }];
  }));
}

const SERVICES = loadServices();
const monitorState = global.__localControlMonitor || (global.__localControlMonitor = {});

function readEnvValues(file) {
  try {
    return new Map(
      fs.readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => [line.slice(0, line.indexOf("=")).trim(), cleanValue(line.slice(line.indexOf("=") + 1))])
    );
  } catch {
    return new Map();
  }
}

function getServicePort(service) {
  const projectEnv = readEnvValues(service.envFile);
  for (const key of service.portEnvKeys) {
    const configured = validPort(projectEnv.get(key));
    if (configured) return configured;
  }
  return service.fallbackPort;
}

function readTopic(service) {
  if (service.ntfyTopic) return service.ntfyTopic;
  if (!service.ntfyEnvKey) return "";
  return cleanValue(readEnvValues(service.envFile).get(service.ntfyEnvKey));
}

async function notify(service, message, priority = "default", event = "manual") {
  const settings = getNotificationSettings();
  if (!settings.notificationsEnabled) return;
  if (event === "offline" && !settings.notifyOffline) return;
  if (event === "online" && !settings.notifyOnline) return;
  const topic = readTopic(service);
  if (!topic) return;
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: { Title: "Local Control", Priority: priority, Tags: "computer" },
      body: message,
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Notification failures never block local service control.
  }
}

function detailFromStatus(data, service) {
  if (!data || typeof data !== "object") {
    return { automation: "Responding", helper: service.statusPath };
  }
  if (data.monitor && typeof data.monitor === "object") {
    return {
      automation: data.monitor.running ? "Monitoring" : "Idle",
      helper: data.chrome?.connected ? "Browser connected" : "Service API connected",
    };
  }
  if (data.scheduler && typeof data.scheduler === "object") {
    return {
      automation: data.scheduler.running ? "Running" : data.scheduler.enabled ? "Scheduled" : "Idle",
      helper: data.scheduler.nextRunAt ? `Next run ${data.scheduler.nextRunAt}` : "Service API connected",
    };
  }
  const status = typeof data.status === "string" ? data.status : "Responding";
  return { automation: status, helper: "Service endpoint connected" };
}

async function probeService(service) {
  const started = Date.now();
  const port = getServicePort(service);
  const base = {
    id: service.id,
    name: service.name,
    description: service.description,
    port,
    openPath: service.openPath,
  };

  if (!port) {
    return { ...base, online: false, responseMs: null, automation: "Unavailable", helper: "Port is not configured" };
  }

  try {
    const response = await fetch(`http://127.0.0.1:${port}${service.statusPath}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    let data = null;
    if (response.headers.get("content-type")?.includes("application/json")) {
      try { data = await response.json(); } catch { data = null; }
    }

    return {
      ...base,
      online: true,
      responseMs: Date.now() - started,
      ...detailFromStatus(data, service),
    };
  } catch {
    return {
      ...base,
      online: false,
      responseMs: null,
      automation: "Unavailable",
      helper: "Server is not responding",
    };
  }
}

async function getStatuses() {
  return Promise.all(Object.values(SERVICES).map(probeService));
}

async function monitorServices() {
  const statuses = await getStatuses();
  for (const status of statuses) {
    const prior = monitorState[status.id];
    if (prior && prior.online !== status.online) {
      const service = SERVICES[status.id];
      await notify(
        service,
        `${service.name} is now ${status.online ? "online" : "offline"}.`,
        status.online ? "default" : "high",
        status.online ? "online" : "offline"
      );
    }
    monitorState[status.id] = { online: status.online, checkedAt: Date.now() };
  }
  return statuses;
}

function runDetached(file, args = [], options = {}) {
  const child = spawn(file, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: options.windowsHide ?? false,
    cwd: options.cwd,
  });
  child.unref();
}

function runCommand(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: 15_000 }, (error, stdout, stderr) => {
      if (error) reject(new Error((stderr || stdout || error.message).trim()));
      else resolve(stdout);
    });
  });
}

async function findListeningPid(port) {
  const output = await runCommand("netstat.exe", ["-ano", "-p", "tcp"]);
  for (const line of output.split(/\r?\n/)) {
    const columns = line.trim().split(/\s+/);
    if (columns.length < 5 || columns[0].toUpperCase() !== "TCP") continue;
    const [, localAddress, , state, pidValue] = columns;
    if (state.toUpperCase() === "LISTENING" && localAddress.endsWith(`:${port}`)) {
      const pid = Number(pidValue);
      if (Number.isInteger(pid) && pid > 0) return pid;
    }
  }
  return null;
}

async function startService(id) {
  const service = SERVICES[id];
  if (!service) throw new Error("Unknown service.");
  const current = await probeService(service);
  if (current.online) return { message: `${service.name} is already online.` };
  if (!service.path) throw new Error(`${service.name} does not have a project path configured.`);
  if (!service.launcher || !fs.existsSync(/* turbopackIgnore: true */ service.launcher)) {
    throw new Error(`The ${service.name} launcher could not be found.`);
  }

  runDetached("cmd.exe", ["/c", "start", "", service.launcher], { cwd: service.path });
  await notify(service, `${service.name} launch requested from Local Control.`);
  return { message: `Launch requested for ${service.name}. It should be ready shortly.` };
}

async function stopService(id) {
  const service = SERVICES[id];
  if (!service) throw new Error("Unknown service.");
  const current = await probeService(service);
  if (!current.online) return { message: `${service.name} is already offline.` };

  const port = getServicePort(service);
  const pid = await findListeningPid(port);
  if (!pid) throw new Error(`${service.name} is responding, but its listening process could not be identified.`);
  if (pid === process.pid) throw new Error("Local Control refused to stop its own process.");

  await runCommand("taskkill.exe", ["/PID", String(pid), "/T", "/F"]);
  await new Promise((resolve) => setTimeout(resolve, 500));
  if ((await probeService(service)).online) throw new Error(`${service.name} did not stop. Try again in a moment.`);
  await notify(service, `${service.name} was stopped from Local Control.`);
  return { message: `${service.name} was stopped.` };
}

module.exports = { SERVICES, findListeningPid, getServicePort, getStatuses, monitorServices, startService, stopService };
