const FooterService = require("../services/footerService");
const footerService = new FooterService();


module.exports = {

    ranking(req,res){
        footerService.ranking((err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    },
    partnerWithUs(req,res){
        footerService.partnerWithUs((err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    },

    learners(req,res){
        footerService.learners((err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    },

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
        footerService.aboutUs((err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    },

    leadership(req,res){
        footerService.leadership((err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    },

    team(req,res){
        footerService.team((err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    },

    career(req,res){
        footerService.career((err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    },

    termandcondition(req,res){
        footerService.termandcondition((err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });      
    },

    privacypolicy(req,res){
        footerService.privacypolicy((err, data) => {
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
