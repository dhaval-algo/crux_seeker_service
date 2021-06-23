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

app.use("/api", require("./src/api/routes"));

// Set up routes
routes.init(app);

// cron jobs
cron.schedule('0 3 * * *', async function () {
    try {        
        await createSiteMap()
        console.log("Site map generated");
    } catch (error) {
        console.log("Error in cron");
    }
});

cron.schedule('* 5 * * * *', async function () {
    try {        
        await copySiteMapS3ToFolder()
        
    } catch (error) {
        console.log("Error in copying", error);
    }
});

//start server
const port = process.env.PORT || "3001";
app.listen(port)