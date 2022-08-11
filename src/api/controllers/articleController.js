const articleService = require("../services/articleService");
let ArticleService = new articleService();
const {formatResponseField } = require("../utils/general");

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
            if(req.query['fields']){                    
                finalData =  formatResponseField(req.query['fields'], data.data )                    
                res.status(200).send({success: true, message: 'Fetched successfully!', data: finalData});
            }
            else
            {
                res.status(200).send(data);
            }
        }); 
        
        
    },

    getAuthor: async (req, res) => {        
        ArticleService.getAuthorBySlug(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

};