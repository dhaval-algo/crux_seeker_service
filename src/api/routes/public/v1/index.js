const express = require('express');
const router = express.Router();

const learnContentController = require('../../../controllers/learnContentController');

router.get('/learn-content/', learnContentController.getLearnContentList);
router.get('/learn-content/:slug', learnContentController.getSingleLearnContent);

router.get('/categories/', learnContentController.getCategoryList);
router.get('/courses-by-ids/', learnContentController.getCourseByIds);
router.get('/course-option-by-categories/', learnContentController.getCourseOptionByCategories);

module.exports = router;