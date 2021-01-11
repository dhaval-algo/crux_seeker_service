const partnerService = require("../services/partnerService");
let PartnerService = new partnerService();

module.exports = {

    getPartnerList: async (req, res) => {
        PartnerService.getPartnerList(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getSinglePartner: async (req, res) => {
        console.log("Request <> ",req);        
        PartnerService.getPartner(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

};