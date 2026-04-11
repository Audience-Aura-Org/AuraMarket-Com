require("dotenv").config();
const axios = require("axios");
const BASE = "https://api.eversend.co/v1";

(async () => {
  const authRes = await axios.get(`${BASE}/auth/token`, {
    headers: { clientId: process.env.EVERSEND_CLIENT_ID, clientSecret: process.env.EVERSEND_CLIENT_SECRET },
    validateStatus: false
  });
  const token = authRes.data.token;
  if (!token) { console.error("No token:", authRes.data); return; }
  console.log("✅ Auth OK");

  const payload = {
    amount: 100, currency: "XAF", phone: "+237670000000",
    country: "CM", transactionRef: "AURA-" + Date.now()
  };

  const origins = [
    null,
    "https://app.eversend.co",
    "https://eversend.co",
    "http://localhost:3000",
    "http://localhost:5000",
    process.env.WEB_CLIENT_URL || "http://localhost:3000"
  ];

  for (const origin of origins) {
    const label = origin || "(no Origin header)";
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {}),
    };
    const r = await axios.post(`${BASE}/collections/momo`, payload, { headers, validateStatus: false });
    console.log(`\nOrigin: ${label} → HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 120)}`);
    if (r.status !== 401) {
      console.log("✅ WORKS with origin:", label);
      console.log("Full body:", JSON.stringify(r.data, null, 2));
      break;
    }
  }
})().catch(e => console.error("Fatal:", e.message));
