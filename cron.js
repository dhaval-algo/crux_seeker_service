require('dotenv').config();

const path = require('path');
const cron = require('node-cron')
const Sentry = require("@sentry/node");

global.appRoot = path.resolve(__dirname);
const { createSiteMap, copySiteMapS3ToFolder , createNewsSiteMap} = require('./src/services/v1/sitemap');
const { storeActivity, learnpathActivity, articleActivity, providerActivity, setTrendingPopularityThreshold,
    newsActivity,} = require('./src/utils/activityCron');
const { invalidateCategoryTree,invalidateEntityLabelCache,invalidateLearnTypeImages,
    invalidateCurrencies,invalidateFilterConfigs, invalidateRankingFilter,
    invalidatTopics, invalidateAboutUs, invalidateLeadership, invalidateTeam,
    invalidateCareer, invalidatePP, invalidateTNM, invalidatSkills,
    invalidPopularCategories, invalidatePartnerWithUs, invalidateLearnersPage, invalidateFacilities,invalidateFaqCategories, invalidateCountries, setLatestRankingYear,invalidateRankings } = require('./src/utils/cacheInvalidationCron');
const { storeTopTenGoal } = require('./src/utils/topTenGoalCron');
const PartnerService = require("./src/api/services/partnerService");
let partnerService = new PartnerService();

Sentry.init({
    attachStacktrace:true,
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  })

  if(process.env.SENTRY_DSN != undefined &&   process.env.SENTRY_DSN != ''){
    
    global.console.log = (data, data1) => {

        //for multiple cases console.log('msg', err) or console.log(err, 'msg'); we have to consider data, data1
      let err = [data, data1];
      err = err.filter(e =>{ return e != undefined } )
        //for printing error in console, only when environment is set to 'development' and 'staging'
      const logInDevStag = (process.env.SENTRY_ENVIRONMENT == 'development' || process.env.SENTRY_ENVIRONMENT == 'staging')            

      err.forEach(data => {
        //if error is simple message (string)
        if (typeof data === 'string' || data instanceof String){
          Sentry.captureMessage(data);
          if(logInDevStag)
            process.stdout.write(data+'\n')
        }
          //if error is object (derived from Error class)
        else{

          Sentry.captureException(data);
          if(logInDevStag){
            let {message = '', name = '', stack = '' } = data
            process.stdout.write(name+ '\n'+ message+ '\n'+ stack +'\n')
          }
        }

      })

    }
  }

// cron jobs
const ENABLE_TOP_TEN_CRON = process.env.ENABLE_TOP_TEN_CRON || false
if(ENABLE_TOP_TEN_CRON){
    cron.schedule(process.env.TOP_TEN_CRON_TIME, async function () {
        try {        
            await storeTopTenGoal()
        } catch (error) {
            console.log("Error in storing top ten goals", error);
        }
    });
}

const ENABLE_SITEMAP_CRON = process.env.ENABLE_SITEMAP_CRON || false;
if(ENABLE_SITEMAP_CRON)
{
    cron.schedule(process.env.SITEMAP_GENERATE_CRON_TIME, async function () {
        try {        
            await createSiteMap()
        } catch (error) {
            console.log("Error in cron", error);
        }
    });

    cron.schedule(process.env.SITEMAP_COPY_CRON_TIME, async function () {
        try {        
            await copySiteMapS3ToFolder()
        } catch (error) {
            console.log("Error in copying", error);
        }
    });
}

const ENABLE_NEWS_SITEMAP_CRON = process.env.ENABLE_NEWS_SITEMAP_CRON || false;
if(ENABLE_NEWS_SITEMAP_CRON)
{
    cron.schedule(process.env.NEWS_SITEMAP_GENERATE_CRON_TIME, async function () {
        try {        
            await createNewsSiteMap()
        } catch (error) {
            console.log("Error in cron", error);
        }
    });

    cron.schedule(process.env.NEWS_SITEMAP_COPY_CRON_TIME, async function () {
        try {        
            await copySiteMapS3ToFolder('news.xml')
            await copySiteMapS3ToFolder('rss.xml')
        } catch (error) {
            console.log("Error in copying", error);
        }
    });
}


const ENABLE_ACTVITY_LOG_CRON = process.env.ENABLE_ACTVITY_LOG_CRON || false;
if(ENABLE_ACTVITY_LOG_CRON)
{
    cron.schedule( process.env.ACIVITY_TRACKING_CRON_TIME, async function () {
        try { 
            console.log("cron started")
            await learnpathActivity()       
            await storeActivity()
            await articleActivity()
            await newsActivity();
            await setTrendingPopularityThreshold()
        } catch (error) {
            console.log("Error in cron", error);
        }
    });
}


const ENABLE_CACHE_INVALIDATION_CRON = process.env.ENABLE_CACHE_INVALIDATION_CRON || false;
if(ENABLE_CACHE_INVALIDATION_CRON)
{
    cron.schedule( process.env.CACHE_INVALIDATION_CRON_TIME, async function () {
        try {    
            await invalidateCategoryTree()
            await invalidateFaqCategories()
            await invalidateCountries()
            await invalidateEntityLabelCache()
            await invalidateLearnTypeImages()
            await invalidateCurrencies()
            await invalidateFilterConfigs()
            await invalidateRankingFilter()
            await invalidatTopics()
            await invalidateAboutUs()
            await invalidateLeadership()
            await invalidateTeam()
            await invalidateCareer()
            await invalidatePP()
            await invalidateTNM()
            await invalidatSkills()
            await invalidPopularCategories()
            await invalidatePartnerWithUs()
            await invalidateLearnersPage()
            await setLatestRankingYear()
            await invalidateFacilities();
            await invalidateRankings();
            await partnerService.cachePartnersCourseImages();
            await setTrendingPopularityThreshold()
           
        } catch (error) {
            console.log("Error in cron", error);
        }
    });
}  

//Redis cache invalidation consumer
const CACHE_INVALIDATION_CONSUMER = process.env.CACHE_INVALIDATION_CONSUMER || false;
if(CACHE_INVALIDATION_CONSUMER)
{
    // const rankingHomeService = require('./src/services/v1/redis/rankingHomeService');
    // const rankingHome = new rankingHomeService();
    // rankingHome.rankingHomeSQSConsumer();

    // const blogHomeService = require('./src/services/v1/redis/blogHomeService');
    // const blogHome = new blogHomeService();
    // blogHome.blogHomeSQSConsumer();

    // const sectionPageService = require('./src/services/v1/redis/sectionPageService');
    // const sectionPage = new sectionPageService();
    // sectionPage.sectionSQSConsumer();

    const learnContentListService = require('./src/services/v1/redis/learnContentListService');
    const learnContentList = new learnContentListService();
    learnContentList.learnContentListSQSConsumer(); 
    
    const articleService = require('./src/services/v1/redis/articleService');
    const article = new articleService();
    article.articleSQSConsumer();
    
    // const FooterService = require('./src/services/v1/redis/footerService');
    // const footerService = new FooterService();
    // footerService.footerSQSConsumer();

    // const CustomPageService = require('./src/services/v1/redis/customPageService');
    // const customPageService = new CustomPageService();
    // customPageService.customPageSQSConsumer();

    // const CategoryTreeService = require('./src/services/v1/redis/categoryTreeService');
    // const categoryTreeService = new CategoryTreeService();
    // categoryTreeService.categoryTreeSQSConsumer();

    const ProviderService = require('./src/services/v1/redis/providerService');
    const providerService = new ProviderService();
    providerService.providerSQSConsumer();
}



