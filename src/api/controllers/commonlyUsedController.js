const { getCategoriesWithOfferBuckets, getCoursesWithOffers } = require('../services/commonlyUsedService');


// constants
const defaultOfferBucket_gte = process.env.DEFAULT_OFFER_BUCKET_GTE || 0;
const defaultOfferBucket_lte = process.env.DEFAULT_OFFER_BUCKET_LTE || 20;

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

const getCoursesWithOffersController = async (req, res) => {

    try {

        const { topicType, category, offer_gte = defaultOfferBucket_gte, offer_lte = defaultOfferBucket_lte } = req.query;
        const result = await getCoursesWithOffers(topicType, category, offer_lte, offer_gte);

        res.status(200).send({ success: true, message: 'Fetched successfully!', data: result });
    }
    catch (error) {
        console.log("Error Occured While getting courses with offers " + error);
        res.status(200).send({ success: false, message: 'Unable to get courses with offers', data: [] });
    }
}


module.exports = {
    getCategoriesWithOfferBucketsController,
    getCoursesWithOffersController
}