const trendingNowService = require("../services/trendingNowService");


module.exports = {

    getTrendingNowCategories: async (req, res) => {
        trendingNowService.getTrendingNowCategories(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },
    getTrendingNowList: async (req, res) => {
        trendingNowService.getTrendingNowList(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },


}