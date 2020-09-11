require('dotenv').config();
const express = require('express');
const cors = require('cors');
var path = require('path');
global.appRoot = path.resolve(__dirname);

const routes = require('./src/routes');


// create 
const app = express();
app.use(express.json());
app.use(cors({ origin: true }));


// Set up routes
routes.init(app);
//start server
const port = process.env.PORT || "3001";
app.listen(port)