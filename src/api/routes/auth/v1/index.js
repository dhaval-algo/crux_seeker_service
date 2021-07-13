const express = require('express');
const router = express.Router();

const searchController = require("../../../controllers/searchController");
const learnContentController = require("../../../controllers/learnContentController");
const orderController = require("../../../controllers/orderController");
const authenticateJWT = require("../../../../services/v1/middleware/authenticate");

router.post("/course/buy", authenticateJWT, learnContentController.buyCourse);
router.get("/order/status", authenticateJWT, orderController.getOrderStatus);

router.post("/user-last-search", authenticateJWT, searchController.userLastSearch);
router.get("/get-user-last-search", authenticateJWT, searchController.getUserLastSearch);
router.post("/remove-search-record", authenticateJWT, searchController.removeUserLastSearch);

module.exports = router;