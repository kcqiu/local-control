const fs = require("node:fs");
const { execFile, spawn } = require("node:child_process");
const { getNotificationSettings } = require("./settings");

const SERVICES = {
  recgov: {
    id: "recgov",
    name: "RecGov Booker",
    description: "Recreation.gov reservation monitor",
    fallbackPort: 3000,
    portEnvKeys: ["RECGOV_APP_PORT", "APP_PORT", "PORT"],
    portScript: "C:\\Users\\kc\\Documents\\ChatGPT\\recgov\\scripts\\start-recgov.ps1",
    path: "C:\\Users\\kc\\Documents\\ChatGPT\\recgov",
    launcher: "C:\\Users\\kc\\Desktop\\RecGov Booker.cmd",
    stopScript: "C:\\Users\\kc\\Documents\\ChatGPT\\recgov\\scripts\\stop-recgov.ps1",
    envKey: "NTFY_TOPIC",
    envFile: "C:\\Users\\kc\\Documents\\ChatGPT\\recgov\\.env",
  },
  register2park: {
    id: "register2park",
    name: "Register2Park",
    description: "Visitor parking registration assistant",
    fallbackPort: 3127,
    portEnvKeys: ["R2P_APP_PORT"],
    path: "C:\\Users\\kc\\Documents\\auto register r2park",
    launcher: "C:\\Users\\kc\\Desktop\\Register2Park Helper.lnk",
    envKey: "R2P_NOTIFICATION_TOPIC",
    envFile: "C:\\Users\\kc\\Documents\\auto register r2park\\.env",
  },
};

const monitorState = global.__localControlMonitor || (global.__localControlMonitor = {});

function validPort(value) {
  const port = Number(String(value || "").trim().replace(/^['"]|['"]$/g, ""));
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

function readEnvValue(file, keys) {
  try {
    const values = new Map(
      fs.readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()])
    );
    for (const key of keys) {
      if (values.has(key)) return values.get(key);
    }
  } catch {
    // Missing or unreadable configuration falls through to the service default.
  }
  return "";
}

function getServicePort(service) {
  const configured = validPort(readEnvValue(service.envFile, service.portEnvKeys || []));
  if (configured) return configured;

  if (service.portScript) {
    try {
      const script = fs.readFileSync(service.portScript, "utf8");
      const scripted = validPort(script.match(/\$appPort\s*=\s*["']?(\d+)/i)?.[1]);
      if (scripted) return scripted;
    } catch {
      // Use the fallback below.
    }
  }
  return service.fallbackPort;
}

function readTopic(service) {
  try {
    const line = fs.readFileSync(service.envFile, "utf8")
      .split(/\r?\n/)
      .find((item) => item.trim().startsWith(`${service.envKey}=`));
    return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "") : "";
  } catch {
    return "";
  }
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
      headers: {
        Title: "Local Control",
        Priority: priority,
        Tags: service.id === "recgov" ? "national_park" : "parking",
      },
      body: message,
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // A notification failure should never block local service control.
  }
}

async function probeService(service) {
  const started = Date.now();
  const port = getServicePort(service);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (service.id === "recgov" && (!data.monitor || !Object.prototype.hasOwnProperty.call(data, "chrome"))) {
      throw new Error("The responding application is not RecGov Booker.");
    }
    if (service.id === "register2park" && (!data.scheduler || Number(data.appPort) !== port)) {
      throw new Error("The responding application is not Register2Park.");
    }
    const detail = service.id === "recgov"
      ? {
          automation: data.monitor?.running ? "Monitoring" : "Idle",
          helper: data.chrome?.connected ? "Browser connected" : "Browser disconnected",
        }
      : {
          automation: data.scheduler?.running ? "Registering" : data.scheduler?.enabled ? "Scheduled" : "Idle",
          helper: data.scheduler?.nextRunAt ? `Next run ${data.scheduler.nextRunAt}` : "No run scheduled",
        };
    return {
      id: service.id,
      name: service.name,
      description: service.description,
      port,
      online: true,
      responseMs: Date.now() - started,
      ...detail,
    };
  } catch {
    return {
      id: service.id,
      name: service.name,
      description: service.description,
      port,
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

function waitForExit(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: 15_000 }, (error, stdout, stderr) => {
      if (error) reject(new Error((stderr || stdout || error.message).trim()));
      else resolve();
    });
  });
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
    const [protocol, localAddress, , state, pidValue] = columns;
    if (protocol && state.toUpperCase() === "LISTENING" && localAddress.endsWith(`:${port}`)) {
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

  if (!fs.existsSync(/* turbopackIgnore: true */ service.launcher)) throw new Error(`The ${service.name} launcher could not be found.`);
  runDetached("cmd.exe", ["/c", "start", "", service.launcher], { cwd: service.path });
  await notify(service, `${service.name} launch requested from Local Control.`);
  return {
    message: service.id === "recgov"
      ? "Launch requested. Windows may ask for time-sync approval on the computer."
      : "Launch requested. The service should be ready shortly.",
  };
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

  await waitForExit("taskkill.exe", ["/PID", String(pid), "/T", "/F"]);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const after = await probeService(service);
  if (after.online) throw new Error(`${service.name} did not stop. Try again in a moment.`);
  await notify(service, `${service.name} was stopped from Local Control.`);
  return { message: `${service.name} was stopped.` };
}

module.exports = { SERVICES, findListeningPid, getServicePort, getStatuses, monitorServices, startService, stopService };
