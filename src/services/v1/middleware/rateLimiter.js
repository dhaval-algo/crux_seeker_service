const rateLimit =  require('express-rate-limit');

const rateLimiter = rateLimit({
    // windowMs: 24 * 60 * 60 * 1000, // 24 hrs in milliseconds
    windowMs:  15 * 60 * 1000, // 15 minutes in milliseconds
    max: 100,
    message: 'You have exceeded the 100 requests in 15 minutes limit!', 
    headers: true,
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hrs in milliseconds
    // windowMs:  15 * 60 * 1000, // 24 hrs in milliseconds
    max: 10,
    message: 'You have exceeded the 10 requests in 24 Hours limit!', 
    headers: true,
});

module.exports = {rateLimiter,forgotPasswordLimiter}