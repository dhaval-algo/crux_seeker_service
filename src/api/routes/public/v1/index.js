const express = require('express');
const router = express.Router();

const learnContentController = require('../../../controllers/learnContentController');

router.get('/learn-content/', learnContentController.getLearnContentList);
router.get('/learn-content/:slug', learnContentController.getSingleLearnContent);

router.get('/categories/', learnContentController.getCategoryList);

module.exports = router;