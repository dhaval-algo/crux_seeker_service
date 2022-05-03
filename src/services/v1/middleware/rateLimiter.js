const rateLimit =  require('express-rate-limit');

const rateLimiter = rateLimit({
    // windowMs: 24 * 60 * 60 * 1000, // 24 hrs in milliseconds
    windowMs:  15 * 60 * 1000, // 24 hrs in milliseconds
    max: 100,
    message: 'You have exceeded the 100 requests in 15 minutes limit!', 
    headers: true,
});

module.exports = rateLimiter