const fs = require('fs');
const path = require('path');
const express = require('express');

// Mock dependencies
process.env.JWT_SECRET = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/test';

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir);

console.log('--- Auditing Route Files ---');

console.log('--- Auditing v1.router.js ---');
try {
  const v1 = require('./routes/v1.router');
  if (v1.stack) {
    v1.stack.forEach((layer, i) => {
      if (layer.route) {
        layer.route.stack.forEach((item, j) => {
          if (typeof item.handle !== 'function') {
            console.error(`❌ [ERROR] v1.router.js: Route ${layer.route.path} has an undefined handler at index ${j}`);
          }
        });
      } else if (layer.name === 'router') {
        // This is a sub-router mount
        if (typeof layer.handle !== 'function') {
          console.error(`❌ [ERROR] v1.router.js: Router mount at index ${i} is NOT a function!`);
        }
      }
    });
  }
} catch (err) {
  console.error(`❌ [FATAL] v1.router.js failed to load:`, err.message);
}

console.log('--- Audit Complete ---');
