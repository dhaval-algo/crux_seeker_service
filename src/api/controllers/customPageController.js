const customPageService = require("../services/customPageService");
const CustomPageService = new customPageService();


module.exports = {
    getCustomPageContent(req,res){
        const slug = req.params.slug;
        CustomPageService.getCustomPageContent(slug, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    }
}
