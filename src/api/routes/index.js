const express = require('express');
const router = express.Router();

router.use('/public', require('./public'));
router.use('/auth', require('./auth'));
router.use('/recommendation', require('./recommendation'));

module.exports = router;