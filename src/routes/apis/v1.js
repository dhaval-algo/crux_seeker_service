const userController = require('../../controllers/v1/apis/user');
const courseController = require('../../controllers/v1/apis/courses');
const express = require('express');
let router = express.Router();
router.use('/users', userController);
router.use('/courses',courseController);
module.exports = router;