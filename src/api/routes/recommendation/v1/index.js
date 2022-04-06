const express = require('express');
const router = express.Router();

const recommendationController = require("../../../controllers/recommendationController");
const recommendationMiddleware = require("../../../../services/v1/middleware/recommendation");
router.get('/recommended-courses/',recommendationMiddleware, recommendationController.getRecommendedCourses);
module.exports = router;