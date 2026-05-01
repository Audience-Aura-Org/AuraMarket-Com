require("dotenv").config();
const axios = require("axios");

// This test doesn't need a token because it hits the backend, 
// but the backend route /api/payments/eversend/initialize is Private.
// I'll test by calling the controller method directly if I can, or just mock the request.

const controller = require("../controllers/payment.controller");
const mongoose = require("mongoose");

async function testSandboxInit() {
  try {
    // Mock req and res
    const req = {
      body: {
        amount: 500,
        currency: "XAF",
        phone: "670000000",
        country: "CM",
        order_ids: []
      },
      user: {
        _id: new mongoose.Types.ObjectId(),
        name: "Test User",
        email: "test@example.com"
      }
    };
    const res = {
      status: (code) => {
        console.log("Status:", code);
        return res;
      },
      json: (data) => {
        console.log("JSON:", JSON.stringify(data, null, 2));
        return res;
      }
    };

    console.log("--- Testing Eversend Initialization (Sandbox) ---");
    await controller.eversendInitialize(req, res);
    
  } catch (error) {
    console.error("Test Error:", error);
  } finally {
    // mongoose.disconnect();
  }
}

// Since I need a DB connection for the controller to work (Transaction.create), 
// I'll just check if process.env.EVERSEND_SANDBOX_MODE is true.
console.log("EVERSEND_SANDBOX_MODE:", process.env.EVERSEND_SANDBOX_MODE);
console.log("EVERSEND_ORIGIN:", process.env.EVERSEND_ORIGIN);

// If I run this it will fail without a DB connection.
// testSandboxInit();
