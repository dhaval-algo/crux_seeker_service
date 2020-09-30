const express = require('express');
const cors = require('cors');
const routes = require('./src/routes');
require('dotenv').config();

// create 
const app = express();
app.use(cors({ origin: true }));

app.use("/api", require("./src/api/routes"));

// Set up routes
routes.init(app);
console.log(process.env.PORT);
//start server
const port = process.env.PORT || "3001";
app.listen(port)