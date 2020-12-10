const express = require('express');
const router = express.Router();

const learnContentController = require('../../../controllers/learnContentController');
const providerController = require('../../../controllers/providerController');
const categoryController = require('../../../controllers/categoryController');
const partnerController = require('../../../controllers/partnerController');
const searchController = require('../../../controllers/searchController');
const ArticleController = require('../../../controllers/articleController');

router.get('/learn-content/', learnContentController.getLearnContentList);
router.get('/learn-content/:slug', learnContentController.getSingleLearnContent);

router.get('/categories/', learnContentController.getCategoryList);
router.get('/courses-by-ids/', learnContentController.getCourseByIds);
router.get('/course-option-by-categories/', learnContentController.getCourseOptionByCategories);

router.get('/providers/', providerController.getProviderList);
router.get('/providers/:slug', providerController.getSingleProvider);

router.get('/partners/', partnerController.getPartnerList);
router.get('/partners/:slug', partnerController.getSinglePartner);

router.get('/categories/tree', categoryController.getCategoryTree);

router.get('/search/:keyword', searchController.getSearchResult);

router.get('/articles/', ArticleController.getArticleList);
router.get('/articles/:slug', ArticleController.getSingleArticle);

module.exports = router;