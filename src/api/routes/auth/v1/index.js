const express = require('express');
const router = express.Router();

const learnContentController = require("../../../controllers/learnContentController");
const orderController = require("../../../controllers/orderController");
const authenticateJWT = require("../../../../services/v1/middleware/authenticate");

router.post("/course/buy", authenticateJWT, learnContentController.buyCourse);
router.get("/order/status", authenticateJWT, orderController.getOrderStatus);

module.exports = router;