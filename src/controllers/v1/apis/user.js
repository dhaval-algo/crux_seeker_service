const express = require('express');
const userService = require('../../../services/v1/users/user');
let router = express.Router();

router.post('/sign-in', userService.login);
router.post('/send-otp', userService.sendOtp);
router.post('/verify-otp', userService.verifyOtp);

//require.post()
module.exports = router;