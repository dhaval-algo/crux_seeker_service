const express = require('express');
const userService = require('../../services/users/user');
let router = express.Router();

router.get('/login', userService.login);

//require.post()
module.exports = router;