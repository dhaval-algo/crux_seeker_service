const sectionService = require('../services/sectionService');
const SectionService = new sectionService()
const {formatResponseField } = require("../utils/general");
module.exports = {
    getCategoryTree: async(req, res) => {
        SectionService.getCategoryTree(req, (err, data) => {
            if (data) {
                let finalData = {}
                if(req.query['fields']){                    
                    finalData =  formatResponseField(req.query['fields'], data.data )               
                    res.status(200).send({sucess: 'true', message: 'Fetched successfully!', data: finalData});
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
    countPage: async(req, res) => {
        SectionService.countPage(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });    
    },
    getSectionContent: async (req, res) => {
        const slug = req.params.slug;
        
        SectionService.getSectionContent(slug, (err, data) => {
            if (data) {
                let finalData = {}
                if (req.query['fields']) {
                    finalData = formatResponseField(req.query['fields'], data.data)
                    res.status(200).send({ sucess: 'true', message: 'Fetched successfully!', data: finalData });
                }
                else {
                    res.status(200).send(data);
                }
            } else {
                res.status(200).send(err);
            }
        });        
    },
    getBlogHomePageContent: async (req, res) => {
        const slug = req.params.slug;

        SectionService.getBlogHomePageContent(slug, (err, data) => {
            if (data) {
                let finalData = {}
                if (req.query['fields']) {
                    finalData = formatResponseField(req.query['fields'], data.data)
                    res.status(200).send({ sucess: 'true', message: 'Fetched successfully!', data: finalData });
                }
                else {
                    res.status(200).send(data);
                }
            } else {
                res.status(200).send(err);
            }
        });
    },
}