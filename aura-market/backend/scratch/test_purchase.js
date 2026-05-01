require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Product = require('../models/Product.model');
const Order = require('../models/Order.model');
const Transaction = require('../models/Transaction.model');
const paymentController = require('../controllers/payment.controller');
const orderController = require('../controllers/order.controller');

async function runTest() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  try {
    // 1. Get the user
    const user = await User.findOne({ email: 'brandonasah11@gmail.com' });
    if (!user) throw new Error('User not found');
    console.log(`User found: ${user.name} (${user.email})`);

    // Credit wallet for the test
    user.wallet_balance = 50000;
    await user.save();
    console.log(`Wallet credited. Current balance: ${user.wallet_balance} XAF`);

    // 2. Get an active product
    const product = await Product.findOne({ status: 'active' });
    if (!product) throw new Error('No active product found');
    console.log(`Product found: ${product.name} - Price: ${product.price}`);

    // Test 2: Eversend Mobile Money Live
    console.log(`\n[Test 2: Mobile Money (Eversend Live)]`);
    
    // Create another order for Eversend
    const orderData = {
      customer_id: user._id,
      vendor_id: product.vendor_id,
      products: [{
        product_id: product._id,
        name: product.name,
        quantity: 1,
        price: product.price,
      }],
      subtotal: product.price,
      shipping_fee: 0,
      total_amount: product.price,
      payment_method: 'eversend',
      shipping_method: 'vendor_managed',
      payment_status: 'pending',
      order_status: 'placed',
    };
    const orderEversend = await Order.create(orderData);
    console.log(`Created Order for Eversend: ${orderEversend._id}`);

    // Format phone number
    let phone = user.phone;
    if (phone && !phone.startsWith('+')) {
      if (phone.startsWith('237')) {
        phone = '+' + phone;
      } else {
        phone = '+237' + phone;
      }
    }

    console.log(`Using phone number: ${phone}`);

    const makeRequest = async (otpObj) => {
      return new Promise((resolve) => {
        const req = {
          body: {
            amount: orderEversend.total_amount,
            currency: 'XAF',
            phone: phone,
            country: 'CM',
            order_ids: [orderEversend._id.toString()],
            otp: otpObj
          },
          user: user,
          app: { get: () => null }
        };
        const res = {
          status: function(code) {
            this.statusCode = code;
            return this;
          },
          json: function(data) {
            resolve({ statusCode: this.statusCode, data });
          }
        };
        paymentController.eversendInitialize(req, res, console.error);
      });
    };

    console.log('Executing Eversend Initialization...');
    let result = await makeRequest();
    
    if (result.statusCode === 400 && result.data.message.includes('OTP')) {
       console.log('OTP Required. Requesting OTP...');
       const otpReq = { body: { phone } };
       const otpRes = await new Promise((resolve) => {
          const res = {
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) { resolve({ statusCode: this.statusCode, data }); }
          };
          paymentController.eversendRequestOTP(otpReq, res);
       });
       
       if (otpRes.statusCode === 200 && otpRes.data.success) {
          const pinId = otpRes.data.data.pinId;
          console.log('OTP Sent! PinId:', pinId);
          
          const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
          });
          const pin = await new Promise(r => readline.question('Enter OTP from phone: ', ans => {
             readline.close();
             r(ans);
          }));
          
          console.log('Re-submitting with OTP...');
          result = await makeRequest({ pinId, pin });
          console.log('Final Result:', JSON.stringify(result, null, 2));
       } else {
          console.log('Failed to request OTP:', otpRes);
       }
    } else {
       console.log('Init Result:', JSON.stringify(result, null, 2));
    }

    // Verify order status after Eversend initialization
    const finalOrder = await Order.findById(orderEversend._id);
    console.log(`Eversend Order final payment_status: ${finalOrder.payment_status}`);
    
    const finalUser = await User.findById(user._id);
    console.log(`Final wallet balance: ${finalUser.wallet_balance} XAF`);

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    mongoose.disconnect();
    console.log('Disconnected');
  }
}

runTest();
