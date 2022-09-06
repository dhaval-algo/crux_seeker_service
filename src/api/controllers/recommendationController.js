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
            case "courses-recommendation": 
                response = await RecommendationService.coursesRecommendationForUser(req);
                break;
            case "related-courses-for-learn-path": 
                response = await RecommendationService.relatedCoursesForLearnPath(req);
                break;
            case "jobTitle-based-recommendation": 
                response = await RecommendationService.jobTitleBasedRecommendation(req);
                break;
            case "popular-skill-based-recommendation":
                response = await RecommendationService.popularSkillBasedRecommendation(req);
                break;
            case "popular-goal-based-recommendation":
                response = await RecommendationService.popularGoalBasedRecommendation(req);
                break;
            case "lg-course-recommendation-for-techinical-skill":
                    response = await RecommendationService.lgCourseRecommendationForTechinicalSkill(req);
                    break;
            case "lg-how-to-learn-courses":
                response = await RecommendationService.lgHowToLearncourses(req);
                break; 
            case "cg-courses-with-placement":
                response = await RecommendationService.cgCoursesWithPlacement(req);
                break;  
            case "cg-courses-with-learn-type":
                response = await RecommendationService.cgCoursesWithLearnType(req);
                break;
            case "cg-free-courses":
                response = await RecommendationService.cgFreeCourses(req);
                break;         
                       
            default:
                res.status(200).send({success: false, message: 'Fetched successfully!', data: null});
                break;           
        }
        if(response && response.data)
        {
            if (response.data.list && response.data.list.length > 0)
            {
                response.data.list= response.data.list.filter(item => item != null)
            }
            if (response.data.mlList && response.data.mlList.length > 0)
            {
                response.data.mlList = response.data.mlList.filter(item => item != null)
            }
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
            case "related-articles-for-learnpath":             
                response = await RecommendationService.getRelatedArticlesForLearnPath(req) 
                break;
            case "article-recommendation":             
                response = await RecommendationService.articleRecommendationForUser(req)
                break;
            default:              
                res.status(200).send({success: false, message: 'Fetched successfully!', data: null});
                break;           
        }
        if(response && response.data)
        {
            if (response.data.list && response.data.list.length > 0)
            {
                response.data.list= response.data.list.filter(item => item != null)
            }
            if (response.data.mlList && response.data.mlList.length > 0)
            {
                response.data.mlList = response.data.mlList.filter(item => item != null)
            }
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
        if(response && response.data)
        {
            if (response.data.list && response.data.list.length > 0)
            {
                response.data.list= response.data.list.filter(item => item != null)
            }
            if (response.data.mlList && response.data.mlList.length > 0)
            {
                response.data.mlList = response.data.mlList.filter(item => item != null)
            }
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

    getArticleAdvice: async (req, res) =>{
        const response = await RecommendationService.getArticleAdvice(req)
        if(response && response.data)
        {
            if (response.data.list && response.data.list.length > 0)
            {
                response.data.list= response.data.list.filter(item => item != null)
            }
            if (response.data.mlList && response.data.mlList.length > 0)
            {
                response.data.mlList = response.data.mlList.filter(item => item != null)
            }
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

    getRecommendedLearnPaths: async (req, res) => {
        const { type } = req.query;
        let response
        switch (type) {
           
            case "related-learnpaths": 
                response = await RecommendationService.relatedLearnPaths(req);
                break;
            case "learn-paths-to-get-started": 
                response = await RecommendationService.getPopularLearnPaths(req);
                break;
            case "learn-paths-recommendations": 
                response = await RecommendationService.getLearnPathRecommendationForUser(req);
                break;
            case "related-learning-path-for-course": 
                response = await RecommendationService.getRelatedLearningPathForCourse(req);
                break;
            case "associated-learn-paths": 
            response = await RecommendationService.getAssociatedLearningPathForCourse(req);
            break;
           
            default:
                res.status(200).send({success: false, message: 'Fetched successfully!', data: null});
                break;           
        }
    
        let finalData = {}
        if(response && response.data)
        {
            if (response.data.list && response.data.list.length > 0)
            {
                response.data.list= response.data.list.filter(item => item != null)
            }
            if (response.data.mlList && response.data.mlList.length > 0)
            {
                response.data.mlList = response.data.mlList.filter(item => item != null)
            }
        }
        if(req.query['fields']){                    
            finalData =  formatResponseField(req.query['fields'], response.data )                    
            res.status(200).send({success:true, message: 'Fetched successfully!', data: finalData});
        }
        else
        {
            res.status(200).send(response);
        }
    },

    getPopularComparison: async (req, res) =>{
        const response = await RecommendationService.getPopularComparison(req)  
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
    
    getRecommendedProviders: async (req, res) => {
        const { type } = req.query;
        let response
        switch (type) {         

            case "popular-providers": 
                response = await RecommendationService.getPopularProviders(req);
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
    getRecommendedTrendingList : async (req, res) => {
        const { type } = req.query;
        let response
        switch (type) {         

            case "related-trending-list": 
                response = await RecommendationService.getRelatedTrendingList(req);
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