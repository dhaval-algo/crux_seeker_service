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

        switch (type) {
           
            case "learn-paths-to-get-started": 
                const response = await RecommendationService.getPopularLearnPaths(req);
                res.status(200).send(response);  
                break;
           
            default:
                res.status(200).send({});
                break;
        }
    },
};