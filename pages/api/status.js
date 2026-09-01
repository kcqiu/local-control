const { getStatuses } = require("../../lib/services");

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  res.setHeader("Cache-Control", "no-store");
  const services = await getStatuses();
  res.status(200).json({ services, checkedAt: new Date().toISOString() });
}
