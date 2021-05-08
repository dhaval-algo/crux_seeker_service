const newsService = require("../services/newsService");
const NewsService = new newsService();


module.exports = {
    getNewsContent(req,res){
        const slug = req.params.slug;
        NewsService.getNewsContent(slug, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    }
}
