const express = require('express');
const router = express.Router();

const learnContentController = require("../../../controllers/learnContentController");
const authenticateJWT = require("../../../../services/v1/middleware/authenticate");

router.get("/course/buy", authenticateJWT, learnContentController.buyCourse);

module.exports = router;