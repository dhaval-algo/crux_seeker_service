const rankingService = require('../services/rankingService');
const RankingService = new rankingService();
module.exports = {
    getHomePageContent: async(req, res) => {
        RankingService.getHomePageContent(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });    
    },
}