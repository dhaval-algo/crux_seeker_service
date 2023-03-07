const { getTopicsByType, getCategoriesFromTopics, getCurrentDate } = require('../utils/general');
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();
const elasticService = require("./elasticService");

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

module.exports = {
    getCategoriesWithOfferBuckets

}