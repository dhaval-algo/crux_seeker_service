const recommendationService = require("../services/recommendationService");
let RecommendationService = new recommendationService();
const userService = require("../../services/v1/users/user");

module.exports = {   
    getRecommendedCourses: async (req, res) => {
        const { type } = req.query;
        let response
        switch (type) {
            case "related-courses":             
                response = await RecommendationService.getRelatedCourses(req)                     
                res.status(200).send(response);             
                break;
            case "courses-to-get-started": 
                response = await RecommendationService.getPopularCourses(req)
                res.status(200).send(response); 
                break;
            case "explore-courses-from-top-categories": 
                response = await  RecommendationService.exploreCoursesFromTopCatgeories(req);
                res.status(200).send(response); 
                break;

            case "top-picks-for-you":  
                response = await RecommendationService.getTopPicksForYou(req);
                res.status(200).send(response); 
                break;

            case "recently-viewed-courses":             
                response = await RecommendationService.getRecentlyViewedCourses(req)                     
                res.status(200).send(response);             
                break;
           
            case "recently-searched-courses": 
                response = await RecommendationService.recentlySearchedCourses(req)
                res.status(200).send(response);
                break;

            case "people-are-also-viewing": 
                response = await RecommendationService.peopleAreAlsoViewing(req);
                res.status(200).send(response);
                break;
            case "enquiry-based-recommendation": 
                response = await RecommendationService.enquiryBasedRecommendation(req);
                res.status(200).send(response);
                break;
            case "wishlist-based-recommendation": 
                response = await RecommendationService.wishlistBasedRecommendation(req);
                res.status(200).send(response);
                break;
            case "courses-recommendation": 
                response = await RecommendationService.coursesRecommendationForUser(req);
                res.status(200).send(response);
                break;
            case "related-courses-for-learn-path": 
                response = await RecommendationService.relatedCoursesForLearnPath(req);
                res.status(200).send(response);
                break;
            case "related-courses-for-article": 
                response = await RecommendationService.relatedCoursesForArticle(req);
                res.status(200).send(response);
                break;
            default:
                res.status(200).send({});
                break;
        }
    },
    getRecommendedArticles : async(req,res)=>{

        const { type } = req.query;

        switch (type) {
 
            case "recently-viewed-articles": {
                const response = await RecommendationService.getRecentlyViewedArticles(req);
                res.status(200).send(response);
            }
            break;

            case "recently-searched-articles": {
                const response = await RecommendationService.getRecentlySearchedArticles(req);
                res.status(200).send(response);
            }
            break;


            case "people-are-also-viewing":{
                const response = await RecommendationService.getPeopleAreAlsoViewingArticles(req);
                res.status(200).send(response);
            }

            break;

            case "top-picks-for-you":{
                const response = await RecommendationService.getTopPicksForYouArticles(req);
                res.status(200).send(response);
            }
            break;

            case "popular-articles":{
                const response = await RecommendationService.getPopularArticles(req);
                res.status(200).send(response);
            }
            break;
            case "related-articles":             
                response = await RecommendationService.getRelatedArticle(req)
                res.status(200).send(response);             
                break;
            case "recommendation-for-article":             
                response = await RecommendationService.getRecommendationForArticle(req) 
                res.status(200).send(response);             
                break;
            case "recommendation-articles-for-courses":             
                response = await RecommendationService.getRecommendationArticlesforCourse(req) 
                res.status(200).send(response);             
                break;
            case "related-articles-for-learnpath":             
                response = await RecommendationService.getRelatedArticlesForLearnPath(req) 
                res.status(200).send(response);             
                break;
            case "article-recommendation":             
                response = await RecommendationService.articleRecommendationForUser(req) 
                res.status(200).send(response);             
                break;
            default:
                res.status(200).send({});
                break;
        }
    },

    getFeaturedArticles: async (req, res) =>{
        const response = await RecommendationService.getFeaturedArticles(req)                     
                res.status(200).send(response);  
    },

    getArticleAdvice: async (req, res) =>{
        const response = await RecommendationService.getArticleAdvice(req)                     
                res.status(200).send(response);  
    },

    getRecommendedLearnPaths: async (req, res) => {
        const { type } = req.query;
        let response
        switch (type) {
           
            case "related-learnpaths": 
                response = await RecommendationService.relatedLearnPaths(req);
                res.status(200).send(response);  
                break;
            case "learn-paths-to-get-started": 
                response = await RecommendationService.getPopularLearnPaths(req);
                res.status(200).send(response);  
                break;
            case "learn-paths-recommendations": 
                response = await RecommendationService.getLearnPathRecommendationForUser(req);
                res.status(200).send(response);  
                break;
            case "related-learning-path-for-course": {
                const response = await RecommendationService.getRelatedLearningPathForCourse(req);
                res.status(200).send(response);  
            }
                break;
           
            default:
                res.status(200).send({});
                break;
        }
    },
};