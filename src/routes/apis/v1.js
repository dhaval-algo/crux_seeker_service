const userController = require('../../controllers/v1/apis/user');
const courseController = require('../../controllers/v1/apis/courses');
const formsConstroller = require('../../controllers/v1/apis/forms');
const express = require('express');
let router = express.Router();
router.use('/users', userController);
router.use('/courses',courseController);
router.use('/forms', formsConstroller);
module.exports = router;