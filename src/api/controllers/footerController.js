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
    },


    sendContactEmail(req,res){
        let requestData = req.body
        footerService.sendContactEmail(requestData, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    },

    sendFeedbackEmail(req,res){
        let requestData = req.body
        footerService.sendFeedbackEmail(requestData, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    }
}
