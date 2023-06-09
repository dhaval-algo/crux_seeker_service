const express = require('express');
const authenticateJWT = require('../../../services/v1/middleware/authenticate');
const authenticateAdminJWT = require('../../../services/v1/middleware/authenticateAdmin');
const injectTokenPayload = require('../../../services/v1/middleware/injectTokenPayload');
const { rateLimiter, forgotPasswordLimiter } = require('../../../services/v1/middleware/rateLimiter')

const orderService = require('../../../services/v1/orders/order');
let router = express.Router();
router.get('/order-details',rateLimiter,authenticateJWT, orderService.oderDetails);
router.get('/order-history',rateLimiter,authenticateJWT, orderService.orderHistory);
router.get('/cancellation-details',rateLimiter,authenticateJWT, orderService.cancellationDetails);
router.get('/cancellation-progress',rateLimiter,authenticateJWT, orderService.cancellationProgress);

module.exports = router;            