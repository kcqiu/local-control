const { startService, stopService } = require("../../lib/services");

function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  if (!isSameOrigin(req)) return res.status(403).json({ error: "Request origin was rejected." });
  const { id, action } = req.body || {};
  if (!id || !["start", "stop"].includes(action)) return res.status(400).json({ error: "Invalid action." });
  try {
    const result = action === "start" ? await startService(id) : await stopService(id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || "The action could not be completed." });
  }
}
