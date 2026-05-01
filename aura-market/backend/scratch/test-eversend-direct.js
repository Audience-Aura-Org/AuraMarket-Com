require("dotenv").config();
const axios = require("axios");

async function testInitialize() {
  try {
    const response = await axios.post("http://localhost:5000/api/payments/eversend/initialize", {
      amount: 100,
      currency: "XAF",
      phone: "+237670000000",
      country: "CM",
      order_ids: []
    }, {
      headers: {
        // I need a JWT token for this. I'll try to find a user or skip auth if possible.
        // Wait, the route is Private.
      }
    });
    console.log("Success:", response.data);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
  }
}

// Since I don't have a token easily, I'll test the service directly.
const eversend = require("../services/eversend.service");

async function testWithOrigin(origin) {
  console.log(`\n--- Testing with Origin: ${origin} ---`);
  // Monkey patch the client creation or just use axios directly with the same logic
  try {
     const token = await eversend.getAccessToken();
     const res = await axios.post("https://api.eversend.co/v1/collections/momo", {
        amount: 100,
        currency: "XAF",
        phone: "+237670000000",
        country: "CM",
        transactionRef: "TEST-" + Date.now(),
        customer: JSON.stringify({ email: "test@example.com", firstName: "Test", lastName: "User" })
     }, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Origin": origin
        },
        validateStatus: false
     });
     console.log(`HTTP ${res.status}:`, JSON.stringify(res.data));
  } catch (err) {
     console.error("Error:", err.message);
  }
}

async function run() {
  const origins = [
    "https://aura-market-com.vercel.app",
    "http://localhost:3000",
    "http://localhost:5000",
    "https://app.eversend.co"
  ];
  for (const o of origins) {
    await testWithOrigin(o);
  }
}

run();
