require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer();
const path = require('path');
const cron = require('node-cron')
const compression = require('compression')
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");

global.appRoot = path.resolve(__dirname);

const routes = require('./src/routes');
const { createSiteMap, copySiteMapS3ToFolder } = require('./src/services/v1/sitemap');
const { storeActivity, learnpathActivity} = require('./src/utils/activityCron');

Sentry.init({
  //dsn: "https://f23bb5364b9840c582710a48e3bf03ef@o1046450.ingest.sentry.io/6022217",

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

const app = express();
// compress all responses
app.use(compression())

app.use(Sentry.Handlers.requestHandler());

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

app.use(Sentry.Handlers.errorHandler());

//start server
const port = process.env.PORT || "3001";
app.listen(port)