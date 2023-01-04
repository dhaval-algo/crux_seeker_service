const express = require('express');
const authenticateJWT = require('../../../services/v1/middleware/authenticate');
const authenticateAdminJWT = require('../../../services/v1/middleware/authenticateAdmin');
const injectTokenPayload = require('../../../services/v1/middleware/injectTokenPayload');
const { rateLimiter, forgotPasswordLimiter } = require('../../../services/v1/middleware/rateLimiter')

const { createSiteMap } = require('../../../services/v1/sitemap');
const userService = require('../../../services/v1/users/user');
const enquiryController = require('../../../api/controllers/enquiryController');
let router = express.Router();
router.post('/sign-in',rateLimiter, userService.login);
router.post('/send-otp',rateLimiter, userService.sendOtp);
router.post('/verify-otp',rateLimiter, authenticateJWT, userService.verifyOtp);
router.get('/verify-token', authenticateJWT, userService.verifyUserToken);
router.post('/social-signin', userService.socialSignIn);
router.post('/sign-up',rateLimiter, injectTokenPayload, userService.signUp);
router.post('/user-exist',rateLimiter, userService.isUserEmailExist);
router.post('/resend-verification-link',authenticateJWT, userService.resendVerificationLink);
router.post('/resend-email-verification-OTP',authenticateJWT, userService.resendEmailVerificationOPT);
router.post('/verify-account', userService.verifyAccount);
router.post('/forgot-password', forgotPasswordLimiter, userService.forgotPassword);
router.post('/reset-password', rateLimiter, userService.resetPassword);
router.get('/get-profile-progress',authenticateJWT, userService.getProfileProgress);
router.post('/add-to-wishlist',authenticateJWT, userService.addCourseToWishList);
router.post('/add-goal',authenticateJWT, userService.addGoals);
router.get('/get-goals',authenticateJWT, userService.getGoals);
router.post('/remove-goal',authenticateJWT, userService.removeGoal);
router.post('/edit-goal',authenticateJWT, userService.editGoal);
router.post('/add-to-learnpathwishlist',authenticateJWT, userService.addLearnPathToWishList);
router.post('/add-course-to-recently-viewed',authenticateJWT, userService.addCourseToRecentlyViewed);
router.post('/fetch-recently-viewed-courses',authenticateJWT, userService.getRecentlyViewedCourses);
router.post('/remove-from-wishlist',authenticateJWT, userService.removeCourseFromWishList);
router.post('/remove-from-learnpathwishlist',authenticateJWT, userService.removeLearnPathFromWishList);
router.post('/fetch-wishlist',authenticateJWT, userService.fetchWishListIds);
router.post('/add-to-course-share',authenticateJWT, userService.addCourseToShare);
router.post('/add-to-learnpath-share',authenticateJWT, userService.addLearnPathToShare);
router.post('/add-to-article-share',authenticateJWT, userService.addArticleToShare);
router.post('/fetch-learnpathwishlist',authenticateJWT, userService.fetchLearnPathWishListIds);
router.get('/fetch-bookmarked-courses',authenticateJWT, userService.wishListCourseData);
router.get('/fetch-bookmarked-learnpaths',authenticateJWT, userService.wishListLearnPathData);
router.get('/fetch-enquiries', authenticateJWT, userService.getEnquiryList);
router.get('/fetch-learnpath-enquiries', authenticateJWT, userService.getLearnPathEnquiryList);
router.post ('/upload-profile',authenticateJWT, userService.uploadProfilePic);
router.post ('/upload-resume',authenticateJWT, userService.uploadResumeFile);
router.get('/get-personal-details',authenticateJWT, userService.getPersonalDetails);
router.post('/edit-personal-details',authenticateJWT, userService.editPersonalDetails);
router.post('/add-work-experience',authenticateJWT, userService.addWorkExperience);
router.post('/edit-work-experience',authenticateJWT, userService.editWorkExperience);
router.post('/delete-work-experience',authenticateJWT, userService.deleteWorkExperience);
router.get('/get-work-experiences',authenticateJWT, userService.getWorkExperiences);
router.post('/add-education',authenticateJWT, userService.addEducation);
router.post('/edit-education',authenticateJWT, userService.editEducation);
router.post('/delete-education',authenticateJWT, userService.deleteEducation);
router.post('/add-address',authenticateJWT, userService.addAddress);
router.post('/edit-address',authenticateJWT, userService.editAddress);
router.get('/get-address',authenticateJWT, userService.getAddress);
router.get('/get-user-profile',authenticateJWT, userService.getUserProfile);
router.get('/get-skills',authenticateJWT, userService.getSkills);
router.get('/get-key-skills',authenticateJWT, userService.getKeySkills);
router.get('/get-educations',authenticateJWT, userService.getEducations);
router.post ('/add-skills',authenticateJWT, userService.addSkills);
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
router.post('/add-article-to-recently-viewed',authenticateJWT,userService.addArticleToRecentlyViewed);
router.get('/create-sitemap', async (req,res) => {
    const res1 = await createSiteMap()
    res.setHeader('Content-Type', 'text/json')
    return res.status(200).send(res1)
})
// new get enquiry endpoints, one for course and second for learnpath enquiry
router.get('/enquiry',authenticateJWT, enquiryController.fetchEnquiry)
router.get('/learnpath-enquiry',authenticateJWT, enquiryController.fetchLearnpathEnquiry)

// institute wishlist endpoints
router.post("/add-institute-wishlist", authenticateJWT, userService.addInstituteToWishList);
router.post("/fetch-institute-wishlist", authenticateJWT, userService.fetchInstituteWishList)
router.post("/remove-institute-wishlist", authenticateJWT, userService.removeInstituteFromWishList)


//require.post()
module.exports = router;            