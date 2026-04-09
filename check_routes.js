const express = require('express');
const router = require('./backend/routes/v1.router');

function checkRouter(r, path = '') {
  if (r.stack) {
    r.stack.forEach(layer => {
      if (layer.route) {
        layer.route.stack.forEach(s => {
          if (typeof s.handle !== 'function') {
            console.log(`[ERROR] Undefined handler found at route: ${path}${layer.route.path}`);
          }
        });
      } else if (layer.name === 'router') {
        checkRouter(layer.handle, `${path}${layer.regexp.toString()} `);
      } else if (typeof layer.handle !== 'function') {
        console.log(`[ERROR] Undefined middleware found at path: ${path}`);
      }
    });
  }
}

try {
  checkRouter(router);
  console.log('Router check completed.');
} catch (err) {
  console.error('Error during router check:', err);
}
