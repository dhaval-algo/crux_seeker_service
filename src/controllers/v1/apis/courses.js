const express = require('express');
const courseSerivces = require('../../../services/v1/courses/courses');
const authenticateJWT = require('../../../services/v1/middleware/authenticate');
let router = express.Router();

router.get('/get-courses', authenticateJWT,courseSerivces.getCourses)
//require.post()
module.exports = router;