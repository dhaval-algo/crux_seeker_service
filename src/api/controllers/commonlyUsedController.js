const { getCategoriesWithOfferBuckets } = require('../services/commonlyUsedService');


const getCategoriesWithOfferBucketsController = async (req, res) => {

    try {

        const { topicType, count = 6 } = req.query;

        const result = await getCategoriesWithOfferBuckets(topicType, count);

        res.status(200).send({ success: true, message: 'Fetched successfully!', data: result });
    }
    catch (error) {
        console.log("Error Occured While getting catgeories with offer buckets " + error);
        res.status(200).send({ success: false, message: 'Unable to get categories with offer buckets', data: [] });
    }

}


module.exports = {
    getCategoriesWithOfferBucketsController
}