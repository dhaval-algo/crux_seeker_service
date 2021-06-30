const providerService = require("../services/providerService");
let ProviderService = new providerService();

module.exports = {

    getProviderList: async (req, res) => {
        ProviderService.getProviderList(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getSingleProvider: async (req, res) => {        
        ProviderService.getProvider(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

};