const express = require('express');
const authenticateJWT = require('../../../services/v1/middleware/authenticate');
const injectTokenPayload = require('../../../services/v1/middleware/injectTokenPayload');
const userService = require('../../../services/v1/users/user');
let router = express.Router();

router.post('/sign-in', userService.login);
router.post('/send-otp', userService.sendOtp);
router.post('/verify-otp', userService.verifyOtp);
router.get('/verify-token', authenticateJWT, userService.verifyUserToken);
router.post('/social-signin', userService.socialSignIn);
router.post('/sign-up', injectTokenPayload, userService.signUp);
router.post('/resend-verification-link',authenticateJWT, userService.resendVerificationLink);
router.post('/verify-account', userService.verifyAccount);
router.post('/forgot-password', userService.forgotPassword);
router.post('/reset-password', userService.resetPassword);
router.get('/get-profile-progress',authenticateJWT, userService.getProfileProgress);
router.post('/add-to-wishlist',authenticateJWT, userService.addCourseToWishList);
router.post('/remove-from-wishlist',authenticateJWT, userService.removeCourseFromWishList);
router.post('/fetch-wishlist',authenticateJWT, userService.fetchWishListIds);
router.get('/fetch-bookmarked-courses',authenticateJWT, userService.wishListCourseData)
router.get('/fetch-enquiries', authenticateJWT, userService.getEnquiryList)


//require.post()
module.exports = router;            