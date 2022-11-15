const partnerService = require("../services/partnerService");
let PartnerService = new partnerService();
const {formatResponseField } = require("../utils/general");

module.exports = {

    partnersByCourseId: async (req, res) => {

        PartnerService.partnersByCourseId(req, (err, data) => {
            if (data)
                res.status(200).send(data);
            else
                res.status(200).send(err);
        });
    },

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
               
        PartnerService.getPartner(req, (err, data) => {
            if (data) {
                let finalData = {}
                if(req.query['fields']){                    
                    finalData =  formatResponseField(req.query['fields'], data.data )                    
                    res.status(200).send({success: true, message: 'Fetched successfully!', data: finalData});
                }
                else
                {
                    res.status(200).send(data);
                }
            } else {
                res.status(200).send(err);
            }
        });        
    },

};