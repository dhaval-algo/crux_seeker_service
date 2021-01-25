const express = require('express');
const courseSerivces = require('../../../services/v1/courses/courses');
const authenticateJWT = require('../../../services/v1/middleware/authenticate');
const learnContentController = require("../../../api/controllers/learnContentController");
let router = express.Router();

router.get('/get-courses', authenticateJWT,courseSerivces.getCourses)
router.post("/buy", authenticateJWT, learnContentController.buyCourse);
//require.post()
module.exports = router;