const express = require('express');
const authenticateJWT = require('../../../services/v1/middleware/authenticate');
const authenticateAdminJWT = require('../../../services/v1/middleware/authenticateAdmin');
const injectTokenPayload = require('../../../services/v1/middleware/injectTokenPayload');
const { createSiteMap } = require('../../../services/v1/sitemap');
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
router.post('/add-course-to-recently-viewed',authenticateJWT, userService.addCourseToRecentlyViewed);
router.post('/fetch-recently-viewed-courses',authenticateJWT, userService.getRecentlyViewedCourses);
router.post('/remove-from-wishlist',authenticateJWT, userService.removeCourseFromWishList);
router.post('/fetch-wishlist',authenticateJWT, userService.fetchWishListIds);
router.get('/fetch-bookmarked-courses',authenticateJWT, userService.wishListCourseData);
router.get('/fetch-enquiries', authenticateJWT, userService.getEnquiryList);
router.post ('/upload-profile',authenticateJWT, userService.uploadProfilePic);
router.post ('/upload-resume',authenticateJWT, userService.uploadResumeFile);
router.post ('/upload-skills',authenticateJWT, userService.uploadSkills);
router.get ('/delete-resume',authenticateJWT, userService.deleteResumeFile);
router.get('/remove-profile', authenticateJWT, userService.removeProfilePic);
router.post('/bookmark-article',authenticateJWT, userService.bookmarkArticle);
router.post('/remove-bookmark-article',authenticateJWT, userService.removeBookmarkArticle);
router.get('/fetch-bookmark-article',authenticateJWT, userService.bookmarkArticleData);
router.post('/fetch-bookmark',authenticateJWT, userService.fetchbookmarkIds);
router.post('/suspend-account',authenticateAdminJWT, userService.suspendAccount);
router.post('/reactivate-account', authenticateAdminJWT, userService.reactivateAccount);
router.post('/update-phone',authenticateJWT, userService.updatePhone);
router.get('/create-sitemap', async (req,res) => {
    const res1 = await createSiteMap()
    res.setHeader('Content-Type', 'text/json')
    return res.status(200).send(res1)
})


//require.post()
module.exports = router;            