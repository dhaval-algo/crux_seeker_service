const learnContentService = require("../services/learnContentService");
let LearnContentService = new learnContentService();

module.exports = {

    getLearnContentList: async (req, res) => {
        LearnContentService.getLearnContentList(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getSingleLearnContent: async (req, res) => {
        const slug = req.params.slug;
        LearnContentService.getLearnContent(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getCategoryList: async (req, res) => {
        LearnContentService.getCategories((err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getCourseByIds: async (req, res) => {
        LearnContentService.getCourseByIds(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getCourseOptionByCategories: async (req, res) => {
        LearnContentService.getCourseOptionByCategories(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },


};