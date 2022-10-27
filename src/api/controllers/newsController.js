const newsService = require("../services/newsService");


module.exports = {
    getNewsList(req,res){

        newsService.getNewsList(req, (err, data) => {
            if(data)
                res.status(200).send(data);
            else
                res.status(200).send(err);
        });
    },

    getNewsBySlug(req,res){
        const slug = req.params.slug;
        newsService.getNewsBySlug(slug, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    }
}
