const express = require('express');
const router = express.Router();

const recommendationController = require("../../../controllers/recommendationController");
const recommendationMiddleware = require("../../../../services/v1/middleware/recommendation");
router.get('/recommended-courses/',recommendationMiddleware, recommendationController.getRecommendedCourses);
router.get('/recommended-articles/',recommendationMiddleware, recommendationController.getRecommendedArticles);
router.get('/recommended-learn-paths/',recommendationMiddleware, recommendationController.getRecommendedLearnPaths);
router.get('/featured-articles/',recommendationMiddleware, recommendationController.getFeaturedArticles);
router.get('/article-advice/',recommendationMiddleware, recommendationController.getArticleAdvice);
module.exports = router;