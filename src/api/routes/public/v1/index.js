const express = require('express');
const router = express.Router();

const learnContentController = require('../../../controllers/learnContentController');
const providerController = require('../../../controllers/providerController');
const categoryController = require('../../../controllers/categoryController');
const partnerController = require('../../../controllers/partnerController');
const searchController = require('../../../controllers/searchController');
const ArticleController = require('../../../controllers/articleController');
const customPageController = require('../../../controllers/customPageController');

const sectionController = require('../../../controllers/sectionController');
const homeController = require('../../../controllers/homeController');
const rankingController = require('../../../controllers/rankingController');

const injectTokenPayload = require("../../../../services/v1/middleware/injectTokenPayload");

router.get('/learn-content/', learnContentController.getLearnContentList);
router.get('/learn-content/:slug', learnContentController.getSingleLearnContent);

router.get('/custom-pages/:slug', customPageController.getCustomPageContent);

router.get('/categories/', learnContentController.getCategoryList);
router.get('/courses-by-ids/', learnContentController.getCourseByIds);
router.get('/course-option-by-categories/', learnContentController.getCourseOptionByCategories);

router.get('/providers/', providerController.getProviderList);
router.get('/providers/:slug', providerController.getSingleProvider);

router.get('/partners/', partnerController.getPartnerList);
router.get('/partners/:slug', partnerController.getSinglePartner);

router.get('/categories/tree', categoryController.getCategoryTree);

router.get('/search/:keyword', searchController.getSearchResult);

router.get('/section/tree',sectionController.getCategoryTree)
router.get('/section/:slug',sectionController.getSectionContent)
router.get('/articles/', ArticleController.getArticleList);
router.get('/articles/:slug', ArticleController.getSingleArticle);
router.get('/section/blog/homepage',sectionController.getBlogHomePageContent)

router.get('/homepage', injectTokenPayload, homeController.getHomePageContent)
router.get('/ranking-homepage',rankingController.getHomePageContent)

router.get('/author/:slug', ArticleController.getAuthor);

module.exports = router;