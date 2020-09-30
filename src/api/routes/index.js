const express = require('express');
const router = express.Router();

router.use('/public', require('./public'));
router.use('/auth', require('./auth'));

module.exports = router;