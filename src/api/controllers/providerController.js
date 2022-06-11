const providerService = require("../services/providerService");
let ProviderService = new providerService();
const {formatResponseField } = require("../utils/general");

module.exports = {

    getProviderList: async (req, res) => {
        ProviderService.getProviderList(req, (err, data) => {
            if (data) {
                let finalData = {}
                if(req.query['fields']){                    
                    finalData =  formatResponseField(req.query['fields'], data.data )                    
                    res.status(200).send({status: 'success', message: 'Fetched successfully!', data: finalData});
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

    getSingleProvider: async (req, res) => {        
        ProviderService.getProvider(req, (err, data) => {
            if (data) {
                let finalData = {}
              if(req.query['fields']){                    
                  finalData =  formatResponseField(req.query['fields'], data.data )                    
                  res.status(200).send({status: 'success', message: 'Fetched successfully!', data: finalData});
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