const faqService = require("../../api/services/faqService");
const {formatResponseField } = require("../utils/general");

module.exports = {

    getFaq: async (req, res) => {
        let result = await faqService.getFaq(req);
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result)
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: result });

        }
    },
    getFaqCategories: async (req, res) => {
        let result = await faqService.getFaqCategories();
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result)
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: result });

        }
    }

}