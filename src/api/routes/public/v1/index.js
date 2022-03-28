const express = require('express');
const router = express.Router();

const learnContentController = require('../../../controllers/learnContentController');
const providerController = require('../../../controllers/providerController');
const categoryController = require('../../../controllers/categoryController');
const partnerController = require('../../../controllers/partnerController');
const searchController = require('../../../controllers/searchController');
const ArticleController = require('../../../controllers/articleController');
const customPageController = require('../../../controllers/customPageController');
const newsController = require('../../../controllers/newsController');
const sectionController = require('../../../controllers/sectionController');
const homeController = require('../../../controllers/homeController');
const rankingController = require('../../../controllers/rankingController');
const footerController = require('../../../controllers/footerController');

const learnPathController = require('../../../controllers/learnPathController');
const injectTokenPayload = require("../../../../services/v1/middleware/injectTokenPayload");
const enquiryController = require("../../../controllers/enquiryController")
const listUsersController = require("../../../controllers/listUsersController")
const listEnquiriesController = require("../../../controllers/listEnquiriesController")

router.get('/learn-content/', learnContentController.getLearnContentList);
router.get('/learn-content-list/', learnContentController.getLearnContentListing);
router.get('/learn-content-filters/', learnContentController.getLearnContentFilters);
router.get('/learn-content/:slug',injectTokenPayload, learnContentController.getSingleLearnContent);
router.get('/learn-content-reviews/:courseId',learnContentController.getReviews);

router.get('/learn-path/',learnPathController.getLearnPathList);
router.get('/learn-path/:slug',learnPathController.getSingleLearnPath);
router.get('/learn-path-reviews/:learnPathId',learnPathController.getReviews);
router.get('/learn-path-explore/',learnPathController.exploreLearnPath);

router.get('/related-courses/:courseId', learnContentController.getRelatedCourses);
router.get('/popular-courses/:type', learnContentController.getPopularCourses);
router.get('/popular-learnpaths/:type', learnPathController.getPopularLearnPaths);
router.get('/custom-pages/:slug', customPageController.getCustomPageContent);

router.get('/news', newsController.getNewsContent);
router.get('/news/:slug', newsController.getNewsBySlug);

router.get('/footer', footerController.getFooter);

router.get('/categories/', learnContentController.getCategoryList);
router.get('/courses-by-ids/', learnContentController.getCourseByIds);
router.get('/learnpaths-by-ids/', learnPathController.getLearnPathByIds);
router.get('/course-option-by-categories/', learnContentController.getCourseOptionByCategories);

router.get('/providers/', providerController.getProviderList);
router.get('/providers/:slug', providerController.getSingleProvider);

router.get('/partners/', partnerController.getPartnerList);
router.get('/partners/:slug', partnerController.getSinglePartner);

router.get('/categories/tree', categoryController.getCategoryTree);
router.get('/topics', categoryController.getTopics);
router.get('/skills', categoryController.getSkills);

router.get('/search/:keyword', searchController.getSearchResult);

router.get('/section/tree',sectionController.getCategoryTree)
router.get('/section/:slug',sectionController.getSectionContent)
router.get('/articles/', ArticleController.getArticleList);
router.get('/articles/:slug', injectTokenPayload, ArticleController.getSingleArticle);
router.get('/section/blog/homepage',sectionController.getBlogHomePageContent)

router.get('/homepage', injectTokenPayload, homeController.getHomePageContent)
router.get('/ranking-homepage',rankingController.getHomePageContent)

router.get('/author/:slug', ArticleController.getAuthor);

router.post('/contact-us',footerController.sendContactEmail);
router.post('/feedback',footerController.sendFeedbackEmail)

router.post('/activity-course-viewed',injectTokenPayload, learnContentController.addActivity);
// course enquiry;
router.post('/enquiry', injectTokenPayload,enquiryController.createEnquiry);
//learnpath enquiry
router.post('/learnpath-enquiry', injectTokenPayload,enquiryController.createLearnpathEnquiry);
//listing all users for admin; temporarily added to this path 
router.post('/listUsers', listUsersController.list)
router.get("/detailedUser/:id", listUsersController.getDetailedUser)
router.post("/listEnquiries", listEnquiriesController.list)
module.exports = router;