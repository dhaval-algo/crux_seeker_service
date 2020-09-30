const express = require('express');
const router = express.Router();

const learnContentController = require('../../../controllers/learnContentController');

router.get('/learn-content/:slug', learnContentController.getSingleLearnContent);

module.exports = router;