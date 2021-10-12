require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer();
const path = require('path');
const cron = require('node-cron')

global.appRoot = path.resolve(__dirname);

const routes = require('./src/routes');
const { createSiteMap, copySiteMapS3ToFolder } = require('./src/services/v1/sitemap');
const { storeActivity} = require('./src/utils/activityCron');

// create 
const app = express();
app.set('trust proxy', true)
app.use(bodyParser.json({ limit: '50mb' }));
//resource path 
app.use(express.static(path.join(__dirname, '/public')));

app.use(require('express-useragent').express())

// for parsing application/xwww-
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
//form-urlencoded
// for parsing multipart/form-data
app.use(upload.array());
app.use(express.json());
app.use(cors({ origin: true }));

//dirty middleware patch for token verification error when request coming from domain with and alias eg: www.xyz.com.
const renameHeaderOrigin = (req, res, next)=>{
    let origin = req.headers.origin;
    if(origin) req.headers.origin = origin.replace("www.","");
    next();
}

app.use(renameHeaderOrigin);

app.use("/api", require("./src/api/routes"));

// Set up routes
routes.init(app);

// cron jobs
const ENABLE_SITEMAP_CRON = process.env.ENABLE_SITEMAP_CRON || false;
if(ENABLE_SITEMAP_CRON)
{
    cron.schedule('0 3 * * *', async function () {
        try {        
            await createSiteMap()
        } catch (error) {
            console.log("Error in cron", error);
        }
    });

    cron.schedule('0 4 * * * ', async function () {
        try {        
            await copySiteMapS3ToFolder()
        } catch (error) {
            console.log("Error in copying", error);
        }
    });


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

    const CategoryTreeService = require('./src/services/v1/redis/categoryTreeService');
    const categoryTreeService = new CategoryTreeService();
    categoryTreeService.categoryTreeSQSConsumer();

    const ProviderService = require('./src/services/v1/redis/providerService');
    const providerService = new ProviderService();
    providerService.providerSQSConsumer();
}

//Redis SQS consumers

const ENABLE_ACTVITY_LOG_CRON = process.env.ENABLE_ACTVITY_LOG_CRON || false;
if(ENABLE_ACTVITY_LOG_CRON)
{
    cron.schedule( process.env.ACIVITY_TRACKING_CRON_TIME, async function () {
        try {        
            await storeActivity()
        } catch (error) {
            console.log("Error in cron", error);
        }
    });
}
   

//start server
const port = process.env.PORT || "3001";
app.listen(port)