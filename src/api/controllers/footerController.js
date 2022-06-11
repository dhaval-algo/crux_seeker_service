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

    aboutUs(req,res){
        footerService.aboutUs(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    },

    leadership(req,res){
        footerService.leadership(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    },

    team(req,res){
        footerService.team(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    },

    career(req,res){
        footerService.career(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    },

    termandcondition(req,res){
        footerService.termandcondition(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    },

    privacypolicy(req,res){
        footerService.privacypolicy(req, (err, data) => {
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
