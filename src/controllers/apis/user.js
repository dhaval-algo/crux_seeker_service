const express = require('express');
const userService = require('../../services/users/user');
let router = express.Router();

router.post('/sign-in', userService.login);

//require.post()
module.exports = router;