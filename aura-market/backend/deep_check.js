const express = require('express');
const path = require('path');
const fs = require('fs');

// Mock dependencies needed for imports
process.env.JWT_SECRET = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/test';

function checkRouter(router, prefix = '') {
  const stack = router.stack || (router._router && router._router.stack);
  if (!stack) return;

  stack.forEach(layer => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
      const path = prefix + layer.route.path;
      layer.route.stack.forEach((item, index) => {
        if (typeof item.handle !== 'function') {
          console.error(`❌ [ERROR] Layer ${index} in ${methods} ${path} is NOT a function! Value:`, item.handle);
        }
      });
    } else if (layer.name === 'router' && layer.handle.stack) {
      checkRouter(layer.handle, prefix + (layer.regexp.source.replace('\\/?(?=\\/|$)', '').replace('^\\/', '/') || '/'));
    }
  });
}

try {
  console.log('--- Starting Deep Route Audit ---');
  const v1Router = require('./routes/v1.router');
  checkRouter(v1Router, '/api/v1');
  console.log('--- Audit Complete ---');
} catch (err) {
  console.error('❌ [FATAL] Failed to load v1.router:', err.message);
  console.error(err.stack);
}
