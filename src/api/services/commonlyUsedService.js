const { getTopicsByType, getCategoriesFromTopics, getCurrentDate, getRandomValuesFromArray } = require('../utils/general');
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();
const elasticService = require("./elasticService");

// constants
const defaultOfferBucket_gte = process.env.DEFAULT_OFFER_BUCKET_GTE || 0;
const defaultOfferBucket_lte = process.env.DEFAULT_OFFER_BUCKET_LTE || 20;
const COURSES_WITH_OFFERS_COUNT = process.env.COURSES_WITH_OFFERS_COUNT || 27;


const getCategoriesWithMostCourses = async (topicType) => {

    const cacheName = `categories-with-most-courses-${topicType}`;

    const cacheData = await RedisConnection.getValuesSync(cacheName);
    if (!cacheData.noCacheData) return cacheData;

    const topics = await getTopicsByType(topicType);

    const elasticQuery = {
        bool: {
            should: [
                {
                    terms: {
                        "topics.keyword": topics
                    }
                }
            ],
            minimum_should_match: 1
        }
    }

    const aggs = {
        topics_count: {
            composite: {
                size: 300,
                sources: [
                    {
                        topics: {
                            terms: {
                                field: "topics.keyword"
                            }
                        }
                    }
                ]
            },
            aggs: {
                doc_count: {
                    value_count: {
                        field: "_index"
                    }
                },
                sort_by_doc_count: {
                    bucket_sort: {
                        sort: [
                            {
                                doc_count: {
                                    order: "desc"
                                }
                            }
                        ]
                    }
                }
            }
        }
    }

    const esResult = await elasticService.searchWithAggregate('learn-content', elasticQuery, { size: 0, aggs: aggs });
    const mostCoursesTopics = []
    if (esResult && esResult.aggregations && esResult.aggregations.topics_count) {

        const buckets = esResult.aggregations.topics_count.buckets;

        for (const bucket of buckets) {
            mostCoursesTopics.push(bucket.key.topics);
        }
    }


    const categoriesObject = await getCategoriesFromTopics(mostCoursesTopics.splice(0, 60));
    await RedisConnection.set(cacheName, categoriesObject);
    RedisConnection.expire(cacheName, process.env.CACHE_CATEGORIES_WITH_MOST_COURSES || 43200);

    return categoriesObject;

}


const getCategoriesWithOfferBuckets = async (topicType, count) => {

    const cacheName = `categories-with-offer-buckets-${topicType}-${count}`;

    const cacheData = await RedisConnection.getValuesSync(cacheName);
    if (!cacheData.noCacheData) return cacheData;

    const categoriesObject = await getCategoriesWithMostCourses(topicType);
    const categories = Object.keys(categoriesObject).splice(0, count);

    const response = [];

    const esQuery = (topics) => ({
        bool: {
            must: [
                {
                    bool: {
                        filter: [
                            {
                                bool: {
                                    should: [
                                        {
                                            range: {
                                                "coupons.validity_end_date": {
                                                    gte: getCurrentDate()
                                                }
                                            }
                                        },
                                        {
                                            bool: {
                                                must_not: {
                                                    exists: {
                                                        field: "coupons.validity_end_date"
                                                    }
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                },
                {
                    terms: {
                        "topics.keyword": topics
                    }
                }
            ]
        }
    });

    const aggQuery = {
        discount_buckets: {
            range: {
                field: "coupons.discount_percent",
                ranges: [
                    {
                        "to": 20
                    },
                    {
                        "from": 20,
                        "to": 40
                    },
                    {
                        "from": 40
                    }
                ]
            }
        }
    }

    const promises = [];

    for (const category of categories) {

        const topics = categoriesObject[category];
        const query = esQuery(topics);
        promises.push(elasticService.searchWithAggregate('learn-content', query, { size: 0, aggs: aggQuery }));

    }

    const results = await Promise.all(promises);

    for (let i = 0; i < results.length; i++) {

        const aggs = results[i].aggregations;

        if (aggs && aggs.discount_buckets && aggs.discount_buckets.buckets) {

            const buckets = aggs.discount_buckets.buckets.map((bkt) => ({
                key: bkt.key,
                count: bkt.doc_count
            }))

            response.push({ category_name: categories[i], buckets: buckets })

        }
    }

    if (response.length) {
        await RedisConnection.set(cacheName, response);
        RedisConnection.expire(cacheName, process.env.CACHE_CATEGORIES_WITH_OFFER_BUCKETS || 86400);
    }

    return response;

}


const getCoursesWithOffers = async (topicType, category, offer_lte, offer_gte) => {

    const cacheName = `courses-with-offers-${topicType}-${category}-${offer_gte}-${offer_lte}`;

    let useCache = false;

    if (offer_lte == defaultOfferBucket_lte && offer_gte == defaultOfferBucket_gte) useCache = true;

    if (useCache) {
        const cacheData = await RedisConnection.getValuesSync(cacheName);
        if (!cacheData.noCacheData) return cacheData;
    }

    const categoriesObject = await getCategoriesWithMostCourses(topicType);
    const topics = categoriesObject[category];

    const esQuery = {
        bool: {
            must: [
                {
                    bool: {
                        filter: [
                            {
                                bool: {
                                    should: [
                                        {
                                            range: {
                                                "coupons.validity_end_date": {
                                                    gte: getCurrentDate()
                                                }
                                            }
                                        },
                                        {
                                            bool: {
                                                must_not: {
                                                    exists: {
                                                        field: "coupons.validity_end_date"
                                                    }
                                                }
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                range: {
                                    "coupons.discount_percent": {
                                        gte: offer_gte
                                    }
                                }
                            },
                            {
                                range: {
                                    "coupons.discount_percent": {
                                        lte: offer_lte
                                    }
                                }
                            }
                        ]
                    }
                },
                {
                    terms: {
                        "topics.keyword": topics
                    }
                }
            ]
        }
    }

    const esSort = [{ "activity_count.last_x_days.trending_score": "desc" }, { "ratings": "desc" }];
    const result = await elasticService.search('learn-content', esQuery, { size: 500, sortObject: esSort }, ['title', 'slug', 'images', 'listing_image', 'card_image', 'card_image_mobile.url', 'coupons']);
    let hits = [];
    if (result.hits.length > COURSES_WITH_OFFERS_COUNT)
        hits = getRandomValuesFromArray(result.hits, COURSES_WITH_OFFERS_COUNT);
    else hits = result.hits;

    const courses = [];

    if (hits && hits.length) {

        for (const data of hits) {

            const course = data['_source'];
            const validCoupons = [];
            for (const coupon of course.coupons) {

                if (coupon.discount_percent >= offer_gte && coupon.discount_percent <= offer_lte) validCoupons.push(coupon);
            }

            const sortedCoupons = validCoupons.sort((c1, c2) => (c2.discount_percent - c1.discount_percent));
            course.coupons = undefined;
            course.coupon = sortedCoupons[0];
            courses.push(course);
        }
    }

    if (courses.length && useCache) {
        await RedisConnection.set(cacheName, courses);
        RedisConnection.expire(cacheName, process.env.CACHE_COURSES_WITH_OFFERS || 600);
    }

    return courses;
}


module.exports = {
    getCategoriesWithOfferBuckets,
    getCoursesWithOffers

}