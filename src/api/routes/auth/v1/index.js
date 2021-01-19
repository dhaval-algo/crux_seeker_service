const express = require('express');
const router = express.Router();

const learnContentController = require("../../../controllers/learnContentController");

router.get("/course/buy", learnContentController.buyCourse);

module.exports = router;