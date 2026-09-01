const fs = require("node:fs");
const path = require("node:path");

const settingsDirectory = path.join(process.cwd(), "data");
const settingsFile = path.join(settingsDirectory, "settings.json");
const defaults = Object.freeze({
  notificationsEnabled: true,
  notifyOffline: true,
  notifyOnline: true,
});

function getNotificationSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
    return {
      notificationsEnabled: typeof saved.notificationsEnabled === "boolean" ? saved.notificationsEnabled : defaults.notificationsEnabled,
      notifyOffline: typeof saved.notifyOffline === "boolean" ? saved.notifyOffline : defaults.notifyOffline,
      notifyOnline: typeof saved.notifyOnline === "boolean" ? saved.notifyOnline : defaults.notifyOnline,
    };
  } catch {
    return { ...defaults };
  }
}

function saveNotificationSettings(changes) {
  const current = getNotificationSettings();
  const next = { ...current };
  for (const key of Object.keys(defaults)) {
    if (typeof changes[key] === "boolean") next[key] = changes[key];
  }
  fs.mkdirSync(settingsDirectory, { recursive: true });
  const temporaryFile = `${settingsFile}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(next, null, 2));
  fs.renameSync(temporaryFile, settingsFile);
  return next;
}

module.exports = { getNotificationSettings, saveNotificationSettings };
