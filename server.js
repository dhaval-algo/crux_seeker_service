require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer();
const path = require('path');
const cron = require('node-cron')
const compression = require('compression')
const sentry = require("./src/services/v1/sentry");
const geoIpService = require("./src/api/services/geoIpService");

global.appRoot = path.resolve(__dirname);

const routes = require('./src/routes');
const { createSiteMap, copySiteMapS3ToFolder } = require('./src/services/v1/sitemap');
const { storeActivity, learnpathActivity} = require('./src/utils/activityCron');


const app = express();
//initialize and setup sentry functionality 
sentry.initialize(app)
// compress all responses
app.use(compression())

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


// if region/currency is not send set it  
  app.use(async function (req, res, next) {
    if(!req.query || (req.query && !req.query['c697d2981bf416569a16cfbcdec1542b5398f3cc77d2b905819aa99c46ecf6f6']))
    {
     try {
        if(!req.query) req.query = {}
         let locationData = await geoIpService.getIpDetails(req.ip)
         if( locationData && locationData.success && locationData.data)
         {
             req.query['c697d2981bf416569a16cfbcdec1542b5398f3cc77d2b905819aa99c46ecf6f6'] = locationData.data.c697d2981bf416569a16cfbcdec1542b5398f3cc77d2b905819aa99c46ecf6f6
             req.query['currency'] = locationData.data.currency
             next()
         }
         else{
             req.query['c697d2981bf416569a16cfbcdec1542b5398f3cc77d2b905819aa99c46ecf6f6'] = 'USA'
             req.query['currency'] = 'USD'
             next()
         }
     } catch (error) {
         console.log("Error detecting location",error )
         req.query['c697d2981bf416569a16cfbcdec1542b5398f3cc77d2b905819aa99c46ecf6f6'] = 'USA'
         req.query['currency'] = 'USD'
         next()
     }    
     
    }
    else
    {
     next()
    }
   })

   // if country is not send set it  
  app.use(async function (req, res, next) {
    if(!req.query || (req.query && !req.query['country']))
    {
     try {
        if(!req.query) req.query = {}
         let locationData = await geoIpService.getIpDetails(req.ip)
         if( locationData && locationData.success && locationData.data)
         {
             req.query['country'] = locationData.data.country_code
             next()
         }
         else{
            req.query['country'] ='US'
             next()
         }
     } catch (error) {
         console.log("Error detecting location",error )
         req.query['country'] = 'US'

         next()
     }
     
    }
    else
    {
     next()
    }
   })

app.use("/api", require("./src/api/routes"));

// Set up routes
routes.init(app);


//start server
const port = process.env.PORT || "3001";
app.listen(port)