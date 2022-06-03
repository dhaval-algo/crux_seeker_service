const recommendationService = require("../services/recommendationService");
let RecommendationService = new recommendationService();
const userService = require("../../services/v1/users/user");
const {formatResponseField } = require("../utils/general");

module.exports = {   
    getRecommendedCourses: async (req, res) => {
        const { type } = req.query;
        let response
        switch (type) {
            case "related-courses":             
                response = await RecommendationService.getRelatedCourses(req);          
                break;

            case "courses-to-get-started": 
                response = await RecommendationService.getPopularCourses(req);
                break;

            case "explore-courses-from-top-categories": 
                response = await  RecommendationService.exploreCoursesFromTopCatgeories(req);
                break;

            case "top-picks-for-you":  
                response = await RecommendationService.getTopPicksForYou(req);
                break;

            case "recently-viewed-courses":             
                response = await RecommendationService.getRecentlyViewedCourses(req);
                break;
           
            case "recently-searched-courses": 
                response = await RecommendationService.recentlySearchedCourses(req)                
                break;

            case "people-are-also-viewing": 
                response = await RecommendationService.peopleAreAlsoViewing(req);
                break;

            case "enquiry-based-recommendation": 
                response = await RecommendationService.enquiryBasedRecommendation(req);
                break;

            case "wishlist-based-recommendation": 
                response = await RecommendationService.wishlistBasedRecommendation(req);
                break;

            default:
                res.status(200).send({success: false, message: 'Fetched successfully!', data: null});
                break;           
        }

        let finalData = {}
        if(req.query['fields']){                    
            finalData =  formatResponseField(req.query['fields'], response.data )                    
            res.status(200).send({success:true, message: 'Fetched successfully!', data: finalData});
        }
        else
        {
            res.status(200).send(response);
        }
    },
    getRecommendedArticles : async(req,res)=>{

        const { type } = req.query;
        let response
        switch (type) {
 
            case "recently-viewed-articles": {
                response = await RecommendationService.getRecentlyViewedArticles(req);
            }
            break;

            case "recently-searched-articles": {
                response = await RecommendationService.getRecentlySearchedArticles(req);
            }
            break;

            case "people-are-also-viewing":{
                response = await RecommendationService.getPeopleAreAlsoViewingArticles(req);
            }

            break;

            case "top-picks-for-you":{
                response = await RecommendationService.getTopPicksForYouArticles(req);
            }
            break;

            case "popular-articles":{
                response = await RecommendationService.getPopularArticles(req);
            }
            break;
            case "related-articles":             
                response = await RecommendationService.getRelatedArticle(req)
                break;
            case "recommendation-for-article":             
                response = await RecommendationService.getRecommendationForArticle(req)
                break;
            case "recommendation-articles-for-courses":             
                response = await RecommendationService.getRecommendationArticlesforCourse(req)
                break;
                default:
                    res.status(200).send({success: false, message: 'Fetched successfully!', data: null});
                    break;           
        }

        let finalData = {}
        if(req.query['fields']){                    
            finalData =  formatResponseField(req.query['fields'], response.data )                    
            res.status(200).send({success:true, message: 'Fetched successfully!', data: finalData});
        }
        else
        {
            res.status(200).send(response);
        }
    },

    getFeaturedArticles: async (req, res) =>{
        const response = await RecommendationService.getFeaturedArticles(req) 
        let finalData = {}
        if(req.query['fields']){                    
            finalData =  formatResponseField(req.query['fields'], response.data )                    
            res.status(200).send({success:true, message: 'Fetched successfully!', data: finalData});
        }
        else
        {
            res.status(200).send(response);
        }
    },

    getArticleAdvice: async (req, res) =>{
        const response = await RecommendationService.getArticleAdvice(req)  
        let finalData = {}
        if(req.query['fields']){                    
            finalData =  formatResponseField(req.query['fields'], response.data )                    
            res.status(200).send({success:true, message: 'Fetched successfully!', data: finalData});
        }
        else
        {
            res.status(200).send(response);
        }
    },

    getRecommendedLearnPaths: async (req, res) => {
        const { type } = req.query;
        let response
        switch (type) {
           
            case "learn-paths-to-get-started": 
                response = await RecommendationService.getPopularLearnPaths(req);
                break;
            case "related-learning-path-for-course": 
                response = await RecommendationService.getRelatedLearningPathForCourse(req);
                break;
           
            default:
                res.status(200).send({success: false, message: 'Fetched successfully!', data: null});
                break;           
        }
    
        let finalData = {}
        if(req.query['fields']){                    
            finalData =  formatResponseField(req.query['fields'], response.data )                    
            res.status(200).send({success:true, message: 'Fetched successfully!', data: finalData});
        }
        else
        {
            res.status(200).send(response);
        }
    },
};