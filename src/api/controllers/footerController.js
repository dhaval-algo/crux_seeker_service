const FooterService = require("../services/footerService");
const footerService = new FooterService();


module.exports = {
    getFooter(req,res){
        const slug = req.params.slug;
        footerService.getFooter(slug, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    }
}
