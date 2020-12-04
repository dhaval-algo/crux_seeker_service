const searchService = require("../services/searchService");
let SearchService = new searchService();

module.exports = {

    getSearchResult: async (req, res) => {
        SearchService.getSearchResult(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

};