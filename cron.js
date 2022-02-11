require('dotenv').config();

const path = require('path');
const cron = require('node-cron')

global.appRoot = path.resolve(__dirname);
const { createSiteMap, copySiteMapS3ToFolder } = require('./src/services/v1/sitemap');
const { storeActivity, learnpathActivity} = require('./src/utils/activityCron');
const { invalidateCategoryTree,invalidateEntityLabelCache,invalidateLearnTypeImages, invalidateCurrencies,invalidateFilterConfigs, invalidateRankingFilter, invalidatTopics} = require('./src/utils/cacheInvalidationCron');


// cron jobs
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


const ENABLE_ACTVITY_LOG_CRON = process.env.ENABLE_ACTVITY_LOG_CRON || false;
if(ENABLE_ACTVITY_LOG_CRON)
{
    cron.schedule( process.env.ACIVITY_TRACKING_CRON_TIME, async function () {
        try {        
            await storeActivity()
            await learnpathActivity()
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
            await invalidateEntityLabelCache()
            await invalidateLearnTypeImages()
            await invalidateCurrencies()
            await invalidateFilterConfigs()
            await invalidateRankingFilter()
            await invalidatTopics()
        } catch (error) {
            console.log("Error in cron", error);
        }
    });
}  

//Redis cache invalidation consumer
const CACHE_INVALIDATION_CONSUMER = process.env.CACHE_INVALIDATION_CONSUMER || false;
if(CACHE_INVALIDATION_CONSUMER)
{
    const rankingHomeService = require('./src/services/v1/redis/rankingHomeService');
    const rankingHome = new rankingHomeService();
    rankingHome.rankingHomeSQSConsumer();

    const blogHomeService = require('./src/services/v1/redis/blogHomeService');
    const blogHome = new blogHomeService();
    blogHome.blogHomeSQSConsumer();

    const sectionPageService = require('./src/services/v1/redis/sectionPageService');
    const sectionPage = new sectionPageService();
    sectionPage.sectionSQSConsumer();

    const learnContentListService = require('./src/services/v1/redis/learnContentListService');
    const learnContentList = new learnContentListService();
    learnContentList.learnContentListSQSConsumer(); 
    
    const articleService = require('./src/services/v1/redis/articleService');
    const article = new articleService();
    article.articleSQSConsumer();
    
    const FooterService = require('./src/services/v1/redis/footerService');
    const footerService = new FooterService();
    footerService.footerSQSConsumer();

    const CustomPageService = require('./src/services/v1/redis/customPageService');
    const customPageService = new CustomPageService();
    customPageService.customPageSQSConsumer();

    // const CategoryTreeService = require('./src/services/v1/redis/categoryTreeService');
    // const categoryTreeService = new CategoryTreeService();
    // categoryTreeService.categoryTreeSQSConsumer();

    const ProviderService = require('./src/services/v1/redis/providerService');
    const providerService = new ProviderService();
    providerService.providerSQSConsumer();
}



