const express = require('express');
const router = express.Router();

const learnContentController = require('../../../controllers/learnContentController');
const providerController = require('../../../controllers/providerController');
const categoryController = require('../../../controllers/categoryController');

router.get('/learn-content/', learnContentController.getLearnContentList);
router.get('/learn-content/:slug', learnContentController.getSingleLearnContent);

router.get('/categories/', learnContentController.getCategoryList);
router.get('/courses-by-ids/', learnContentController.getCourseByIds);
router.get('/course-option-by-categories/', learnContentController.getCourseOptionByCategories);

router.get('/providers/', providerController.getProviderList);
router.get('/providers/:slug', providerController.getSingleProvider);

router.get('/categories/tree', categoryController.getCategoryTree);

module.exports = router;