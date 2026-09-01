const { getNotificationSettings, saveNotificationSettings } = require("../../lib/settings");

function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json(getNotificationSettings());
  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed." });
  if (!isSameOrigin(req)) return res.status(403).json({ error: "Request origin was rejected." });
  const settings = saveNotificationSettings(req.body || {});
  return res.status(200).json(settings);
}
