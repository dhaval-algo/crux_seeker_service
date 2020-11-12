const categoryService = require("../services/categoryService");
let CategoryService = new categoryService();

module.exports = {

    getCategoryTree: async (req, res) => {
        CategoryService.getTree(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

};