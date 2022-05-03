const express = require('express');
const authenticateJWT = require('../../../services/v1/middleware/authenticate');
const authenticateAdminJWT = require('../../../services/v1/middleware/authenticateAdmin');
const injectTokenPayload = require('../../../services/v1/middleware/injectTokenPayload');
const rateLimiter = require('../../../services/v1/middleware/rateLimiter')

const { createSiteMap } = require('../../../services/v1/sitemap');
const userService = require('../../../services/v1/users/user');
let router = express.Router();
router.post('/sign-in',rateLimiter, userService.login);
router.post('/send-otp',rateLimiter, userService.sendOtp);
router.post('/verify-otp',rateLimiter, authenticateJWT, userService.verifyOtp);
router.get('/verify-token', authenticateJWT, userService.verifyUserToken);
router.post('/social-signin', userService.socialSignIn);
router.post('/sign-up',rateLimiter, injectTokenPayload, userService.signUp);
router.post('/resend-verification-link',authenticateJWT, userService.resendVerificationLink);
router.post('/verify-account', userService.verifyAccount);
router.post('/forgot-password', rateLimiter, userService.forgotPassword);
router.post('/reset-password', rateLimiter, userService.resetPassword);
router.get('/get-profile-progress',authenticateJWT, userService.getProfileProgress);
router.post('/add-to-wishlist',authenticateJWT, userService.addCourseToWishList);
router.post('/add-to-learnpathwishlist',authenticateJWT, userService.addLearnPathToWishList);
router.post('/add-course-to-recently-viewed',authenticateJWT, userService.addCourseToRecentlyViewed);
router.post('/fetch-recently-viewed-courses',authenticateJWT, userService.getRecentlyViewedCourses);
router.post('/remove-from-wishlist',authenticateJWT, userService.removeCourseFromWishList);
router.post('/remove-from-learnpathwishlist',authenticateJWT, userService.removeLearnPathFromWishList);
router.post('/fetch-wishlist',authenticateJWT, userService.fetchWishListIds);
router.post('/fetch-learnpathwishlist',authenticateJWT, userService.fetchLearnPathWishListIds);
router.get('/fetch-bookmarked-courses',authenticateJWT, userService.wishListCourseData);
router.get('/fetch-bookmarked-learnpaths',authenticateJWT, userService.wishListLearnPathData);
router.get('/fetch-enquiries', authenticateJWT, userService.getEnquiryList);
router.get('/fetch-learnpath-enquiries', authenticateJWT, userService.getLearnPathEnquiryList);
router.post ('/upload-profile',authenticateJWT, userService.uploadProfilePic);
router.post ('/upload-resume',authenticateJWT, userService.uploadResumeFile);
router.post ('/upload-skills',authenticateJWT, userService.uploadSkills);
router.post ('/upload-primary-skills',authenticateJWT, userService.uploadPrimarySkills);
router.get ('/delete-resume',authenticateJWT, userService.deleteResumeFile);
router.get('/remove-profile', authenticateJWT, userService.removeProfilePic);
router.post('/bookmark-article',authenticateJWT, userService.bookmarkArticle);
router.post('/remove-bookmark-article',authenticateJWT, userService.removeBookmarkArticle);
router.get('/fetch-bookmark-article',authenticateJWT, userService.bookmarkArticleData);
router.post('/fetch-bookmark',authenticateJWT, userService.fetchbookmarkIds);
router.post('/suspend-account',authenticateAdminJWT, userService.suspendAccount);
router.post('/reactivate-account', authenticateAdminJWT, userService.reactivateAccount);
router.post('/update-phone',authenticateJWT, userService.updatePhone);
router.get('/fetch-user-pending-actions',authenticateJWT,userService.getUserPendingActions);
router.post('/update-email',rateLimiter, authenticateJWT, userService.updateEmail);
router.post('/add-category-to-recently-viewed',authenticateJWT, userService.addCategoryToRecentlyViewed);
router.get('/create-sitemap', async (req,res) => {
    const res1 = await createSiteMap()
    res.setHeader('Content-Type', 'text/json')
    return res.status(200).send(res1)
})


//require.post()
module.exports = router;            