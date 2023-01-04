const express = require('express');
const router = express.Router();

const searchController = require("../../../controllers/searchController");
const learnContentController = require("../../../controllers/learnContentController");
const authenticateJWT = require("../../../../services/v1/middleware/authenticate");

router.post("/user-last-search", authenticateJWT, searchController.userLastSearch);
router.get("/get-user-last-search", authenticateJWT, searchController.getUserLastSearch);
router.post("/remove-search-record", authenticateJWT, searchController.removeUserLastSearch);

module.exports = router;