const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { 
  getAddresses, 
  addAddress, 
  updateAddress, 
  deleteAddress 
} = require('../controllers/address.controller');

router.use(protect);

router.get('/', getAddresses);
router.post('/', addAddress);
router.patch('/:id', updateAddress);
router.delete('/:id', deleteAddress);

module.exports = router;
