const learnContentService = require("../services/learnContentService");
let LearnContentService = new learnContentService();

module.exports = {

    getSingleLearnContent: async (req, res) => {
        const slug = req.params.slug;
        LearnContentService.getLearnContent(slug, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },


};