const categoryService = require("../services/categoryService");
let CategoryService = new categoryService();

module.exports = {

    getCategoryTree: async (req, res) => {
        CategoryService.getTree(req, (err, data) => {
            if (data) {
                if(process.env.API_CACHE_CONTROL_HEADER)
                {
                    res.set('Cache-control', process.env.API_CACHE_CONTROL_HEADER)
                }
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getTopics: async (req, res) => {
        CategoryService.getTopics(req, (err, data) => {
            if (data) {                
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getSkills: async (req, res) => {
        CategoryService.getSkills(req, (err, data) => {
            if (data) {                
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

};