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
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  if (!isSameOrigin(req)) return res.status(403).json({ error: "Request origin was rejected." });

  res.status(202).json({ message: "Local Control is shutting down." });
  setTimeout(() => process.exit(0), 500);
}
