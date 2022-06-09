const homePageService = require('../services/homePageService');
const HomePageService = new homePageService();
const {formatResponseField } = require("../utils/general");
module.exports = {
    getHomePageContent: async(req, res) => {
        
        HomePageService.getHomePageContent(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });
    },

    getHomePageTopCategories: async(req, res) => {
        let result = await HomePageService.getHomePageTopCategories(req);
        if(req.query['fields']){                    
            let finalData =  formatResponseField(req.query['fields'], result.data)                    
            res.status(200).send({status: 'success', message: 'Fetched successfully!', data: finalData});
        }else
        {
            res.status(200).send(result);

        }
    },

    getHomePageTopPartners: async(req, res) => {
        let result = await HomePageService.getHomePageTopPartners(req);
        if(req.query['fields']){                    
            let finalData =  formatResponseField(req.query['fields'], result.data)                    
            res.status(200).send({status: 'success', message: 'Fetched successfully!', data: finalData});
        }else
        {
            res.status(200).send(result);

        }
    },

    getHomePageTopInstitutes: async(req, res) => {
        let result = await HomePageService.getHomePageTopInstitutes(req);
        if(req.query['fields']){                    
            let finalData =  formatResponseField(req.query['fields'], result.data)                    
            res.status(200).send({status: 'success', message: 'Fetched successfully!', data: finalData});
        }else
        {
            res.status(200).send(result);

        }
    }
}