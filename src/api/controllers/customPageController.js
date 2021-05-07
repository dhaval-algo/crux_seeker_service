const learnContentService = require("../services/customPageService");
const LearnContentService = new learnContentService();


module.exports = class customPageController {
    getCustomPageContent(req,res){
        const slug = req.params.slug;
        LearnContentService.getLearnContent(slug, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    }
}
