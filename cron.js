require('dotenv').config();

const path = require('path');
const cron = require('node-cron')

global.appRoot = path.resolve(__dirname);
const { createSiteMap, copySiteMapS3ToFolder } = require('./src/services/v1/sitemap');
const { storeActivity, learnpathActivity} = require('./src/utils/activityCron');


// cron jobs
const ENABLE_SITEMAP_CRON = process.env.ENABLE_SITEMAP_CRON || true;
if(ENABLE_SITEMAP_CRON)
{
    cron.schedule('0 3 * * *', async function () {
        try {        
            await createSiteMap()
        } catch (error) {
            console.log("Error in cron", error);
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


