const homePageService = require('../services/homePageService');
const HomePageService = new homePageService();
const { formatResponseField } = require("../utils/general");
module.exports = {
    getHomePageContent: async (req, res) => {
        let result = await HomePageService.getHomePageContent(req);
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result.data)
            res.status(200).send({ status: 'success', message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send(result);
        }
    },

    getHomePageTopCategories: async (req, res) => {
        let result = await HomePageService.getHomePageTopCategories(req);
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result.data)
            res.status(200).send({ status: 'success', message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send(result);

        }
    },

    getHomePageTopPartnersCategories: async (req, res) => {
        let result = await HomePageService.getHomePageTopPartnersCategories(req);
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result.data)
            res.status(200).send({ status: 'success', message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send(result);

        }
    },

    getHomePageTopInstitutesRegion: async (req, res) => {
        let result = await HomePageService.getHomePageTopInstitutesRegion(req);
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result.data)
            res.status(200).send({ status: 'success', message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send(result);

        }
    },

    getHomePageTopPartnersByCategories: async (req, res) => {
        let result = await HomePageService.getHomePageTopPartnersByCategories(req);
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result.data)
            res.status(200).send({ status: 'success', message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send(result);

        }
    },

    getHomePageTopInstitutesByRegion: async (req, res) => {
        let result = await HomePageService.getHomePageTopInstitutesByRegion(req);
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result.data)
            res.status(200).send({ status: 'success', message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send(result);

        }
    }
}