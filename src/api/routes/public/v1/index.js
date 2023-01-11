const express = require('express');
const router = express.Router();

const geoIpController = require('../../../controllers/geoIpControlller');
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
const recommendationMiddleware = require("../../../../services/v1/middleware/recommendation");
const jobController = require("../../../controllers/jobController");
const listUsersController = require("../../../controllers/listUsersController")
const listEnquiriesController = require("../../../controllers/listEnquiriesController")
const sessionKPIController = require("../../../controllers/sessionController")
const graphController = require("../../../controllers/graphController")
const trendingListController = require("../../../controllers/trendingListController")

//course API
router.get('/learn-content/', injectTokenPayload,learnContentController.getLearnContentList);
router.get('/learn-content-list/', learnContentController.getLearnContentListing);
router.get('/learn-content-filters/', learnContentController.getLearnContentFilters);
router.get('/learn-content/:slug',injectTokenPayload, learnContentController.getSingleLearnContent);
router.get('/learn-content-reviews/:courseId',learnContentController.getReviews);

//Course Landing page
router.get('/course-landing-page', learnContentController.getCourseLandingPage)
router.get('/course-landing-page-categories', learnContentController.geCourseLandingPageTopCategories)
router.get('/popular-categories', learnContentController.getPopularCategories)

//Institute Landing page 
router.get('/institute-landing-page', providerController.getInstituteLandingPage)

//Learn path APi
router.get('/learn-path/',injectTokenPayload,learnPathController.getLearnPathList);
router.get('/learn-path/:slug',injectTokenPayload,learnPathController.getSingleLearnPath);
router.get('/learn-path-reviews/:learnPathId',learnPathController.getReviews);
router.get('/learn-path-explore/',learnPathController.exploreLearnPath);

router.get('/recommended-courses/',recommendationMiddleware, learnContentController.getRecommendedCourses);
router.get('/popular-courses/:type', learnContentController.getPopularCourses);
router.get('/popular-learnpaths/:type', learnPathController.getPopularLearnPaths);
router.get('/custom-pages/:slug', customPageController.getCustomPageContent);
router.get('/get-top-categories/', learnContentController.getTopCategories);

//news endpoints
router.get('/news', injectTokenPayload, newsController.getNewsList);
router.get('/news/:slug', injectTokenPayload, newsController.getNewsBySlug);
router.get('/news-by-ids', newsController.getNewsByIds);

// static content API
router.get('/footer', footerController.getFooter);
router.get('/about-us', footerController.aboutUs);
router.get('/leadership', footerController.leadership);
router.get('/team', footerController.team);
router.get('/career', footerController.career);
router.get('/terms-and-conditions', footerController.termandcondition);
router.get('/privacy-policy', footerController.privacypolicy);
router.get('/partner-with-us', footerController.partnerWithUs);
router.get('/learners-page', footerController.learners);

router.get('/categories/', learnContentController.getCategoryList);
router.get('/courses-by-ids/', learnContentController.getCourseByIds);
router.get('/learnpaths-by-ids/', learnPathController.getLearnPathByIds);
router.get('/course-option-by-categories/', learnContentController.getCourseOptionByCategories);

//api for providers
router.get('/providers/', providerController.getProviderList);
router.get('/providers/:slug', providerController.getSingleProvider);
router.get('/rankings', providerController.ranking)
router.get('/providers-ranking/:slug', providerController.getSingleProviderRanking);
router.get('/providers-placements/:id', providerController.getProviderPlacements);

router.get('/partners/', partnerController.getPartnerList);
router.get('/partners/:slug', partnerController.getSinglePartner);


router.get('/categories/tree', categoryController.getCategoryTree);
router.get('/topics', categoryController.getTopics);
router.get('/skills', categoryController.getSkills);

router.get('/search/:keyword', injectTokenPayload,searchController.getSearchResult);
router.get('/search-suggestions/:word', injectTokenPayload,searchController.getSearchSuggestions);

router.get('/count-page',sectionController.countPage)
router.get('/section/tree',sectionController.getCategoryTree)
router.get('/section/:slug',sectionController.getSectionContent)
router.get('/articles/',injectTokenPayload, ArticleController.getArticleList);
router.get('/articles/:slug', injectTokenPayload, ArticleController.getSingleArticle);
router.get('/section/blog/homepage',sectionController.getBlogHomePageContent)
router.get('/ranking-homepage',rankingController.getHomePageContent)
router.get('/author/:slug', ArticleController.getAuthor);
router.get('/articles-by-author/:id', ArticleController.getArticlesByAuthor);

// Jobs api
router.get('/get-job-listing',jobController.getJobListing);
router.get('/get-job-data',jobController.getJobData);
router.post('/save-job-application',jobController.saveJobApplication);

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
router.get("/detailedEnquiry/:id", listEnquiriesController.getDetailedEnquiry)
router.post("/listLearnpathEnquiries", listEnquiriesController.listLearnpath)
router.get("/detailedLearnpathEnquiry/:id", listEnquiriesController.getDetailedLearnpathEnquiry)

//Home page API
router.get('/homepage', homeController.getHomePageContent)
router.get('/homepage-top-categories', homeController.getHomePageTopCategories)
router.get('/homepage-top-partners-categories', homeController.getHomePageTopPartnersCategories)
router.get('/homepage-top-institutes-region', homeController.getHomePageTopInstitutesRegion)
router.get('/homepage-top-partners-by-categories', homeController.getHomePageTopPartnersByCategories)
router.get('/homepage-top-institutes-by-region', homeController.getHomePageTopInstitutesByRegion)


//Category page API
router.get('/learn-content-learn-types', learnContentController.getLearnContentLearntypes)
router.get('/learn-content-topics', learnContentController.getLearnContentTopics)

//Learn Path API
router.get('/learn-path-learn-types', learnPathController.getLearnPathLearntypes)
router.get('/learn-path-topics', learnPathController.getLearnPathTopics)

// graph / data tables api
router.get('/graph/:id', graphController.getGraph)
router.get('/data-table/:id', graphController.getDataTable)


router.post('/save-session-kpi',injectTokenPayload,sessionKPIController.saveSessionKPIController);

router.get('/getIpDetails', geoIpController.getIpDetails )

//Trending list API
router.get('/trending-list',injectTokenPayload,trendingListController.getTrendingList);
router.get('/trending-list/:slug',injectTokenPayload,trendingListController.getSingleTrendingList);
router.get('/trending-list-top-learning-plateform/:slug',injectTokenPayload,trendingListController.getTopLearningplatform);
router.get('/trending-list-synopsis/:slug',injectTokenPayload,trendingListController.getTrendingListSynopsis);
router.get('/trending-list-courses/:slug',injectTokenPayload,trendingListController.getTrendingListCourses);
router.get('/trending-list-navigation-dropdown/:slug',injectTokenPayload,trendingListController.getTrendingListNavigationDropdown);
router.get('/navigate-to-trending-list',injectTokenPayload,trendingListController.navigateToTrendingList);
module.exports = router;
