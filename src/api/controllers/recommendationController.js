const recommendationService = require("../services/recommendationService");
let RecommendationService = new recommendationService();
const userService = require("../../services/v1/users/user");

module.exports = {   
    getRecommendedCourses: async (req, res) => {
        const { type } = req.query;

        switch (type) {
            case "related-courses": RecommendationService.getRelatedCourses(req, (err, data) => {
                if (data) {
                    res.status(200).send(data);
                } else {
                    res.status(200).send(err);
                }
            });
                break;
            case "courses-to-get-started": RecommendationService.getPopularCourses(req, (err, data) => {
                if (data) {
                    if (process.env.API_CACHE_CONTROL_HEADER) {
                        res.set('Cache-control', process.env.API_CACHE_CONTROL_HEADER)
                    }
                    res.status(200).send(data);
                } else {
                    res.status(200).send(err);
                }
            });
                break;
            case "explore-courses-from-top-categories": RecommendationService.exploreCoursesFromTopCatgeories(req, (err, data) => {
                if (data) {
                    res.status(200).send(data);
                } else {
                    res.status(200).send(err);
                }
            });

                break;

            case "top-picks-for-you": RecommendationService.getTopPicksForYou(req, (err, data) => {
                if (data) {
                    res.status(200).send(data);
                } else {
                    res.status(200).send(err);
                }
            });
                break;

            case "recently-viewed-courses": userService.recentlyViewedCourses(req,(err, data) => {
                if (data) {
                    res.status(200).send(data);
                } else {
                    res.status(200).send(err);
                }
            });
                
                break;
           
            case "recently-searched-courses": userService.recentlySearchedCourses(req,(err, data) => {
                if (data) {
                    res.status(200).send(data);
                } else {
                    res.status(200).send(err);
                }
            });
                break;

            case "people-are-also-viewing": userService.peopleAreAlsoViewing(req,(err, data) => {
                if (data) {
                    res.status(200).send(data);
                } else {
                    res.status(200).send(err);
                }
            });
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

            default:
                res.status(200).send({});
                break;
        }
    }
};