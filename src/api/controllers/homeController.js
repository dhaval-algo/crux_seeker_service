const homePageService = require('../services/homePageService');
const HomePageService = new homePageService();
module.exports = {
    getHomePageContent: async(req, res) => {
        
        HomePageService.getHomePageContent(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });
    },

    getHomePageTopCategories: async(req, res) => {
        let result = await HomePageService.getHomePageTopCategories(req);
        res.status(200).send(result);
    }
}