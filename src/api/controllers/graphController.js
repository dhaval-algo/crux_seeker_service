const graphService = require("../services/graphService");
let GraphService = new graphService();
const {formatResponseField } = require("../utils/general");

module.exports = {

    getBarGraph: async (req, res) => {
        const response = await GraphService.getBarGraph(req)
        let finalData = {}
        if (req.query['fields']) {
            finalData = formatResponseField(req.query['fields'], response.data)
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
        }
        else {
            res.status(200).send(response);
        }
    },

    getlineGraph: async (req, res) => {
        const response = await GraphService.getlineGraph(req)
        let finalData = {}
        if (req.query['fields']) {
            finalData = formatResponseField(req.query['fields'], response.data)
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
        }
        else {
            res.status(200).send(response);
        }
    },

    getPieChart: async (req, res) => {
        const response = await GraphService.getPieChart(req)
        let finalData = {}
        if (req.query['fields']) {
            finalData = formatResponseField(req.query['fields'], response.data)
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
        }
        else {
            res.status(200).send(response);
        }
    },

    getDonutChart: async (req, res) => {
        const response = await GraphService.getDonutChart(req)
        let finalData = {}
        if (req.query['fields']) {
            finalData = formatResponseField(req.query['fields'], response.data)
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
        }
        else {
            res.status(200).send(response);
        }
    },

    getDataTable: async (req, res) => {
        const response = await GraphService.getDataTable(req)
        let finalData = {}
        if (req.query['fields']) {
            finalData = formatResponseField(req.query['fields'], response.data)
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
        }
        else {
            res.status(200).send(response);
        }
    },

};