const articleService = require("../services/articleService");
let ArticleService = new articleService();

module.exports = {

    getArticleList: async (req, res) => {
        ArticleService.getArticleList(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getSingleArticle: async (req, res) => {
        const slug = req.params.slug;
        ArticleService.getArticle( slug, req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getAuthor: async (req, res) => {
        const slug = req.params.slug;
        ArticleService.getAuthorBySlug(slug, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

};