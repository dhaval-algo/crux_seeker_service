const elasticService = require("./elasticService");
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();
const fetch = require("node-fetch");
const apiBackendUrl = process.env.API_BACKEND_URL;

const getFaq = async (req) => {

    try {
        let { pageType, category, learn_content_id, learning_path_id } = req.query;
        let cacheKey = `Faq-${pageType}-${category || 'category'}-${learn_content_id || 'learn_content_id'}-${learning_path_id || 'learning_path_id'}`;
        let cachedData = await RedisConnection.getValuesSync(cacheKey);
        if (cachedData.noCacheData != true) {
            cachedData;
            return cachedData;
        }
        let query = {
            "match_all": {}
        };
        const payload = {
            "size": 1000,
            "_source": ['question', 'answer']
        }
        const faqs = [];
        if (learn_content_id) {
            if (typeof learn_content_id === 'string' && learn_content_id.includes("LRN_CNT_PUB_")) {
                learn_content_id = parseInt(learn_content_id.replace("LRN_CNT_PUB_", ""))
            }

            query = {
                "bool": {
                    "must": [{
                        "bool": {
                            "should": [
                                { term: { "learn_content_id": learn_content_id } },
                                {
                                    "bool": {
                                        "must_not": [
                                            {
                                                "exists": {
                                                    "field": "learn_content_id"
                                                }
                                            },
                                            {
                                                "exists": {
                                                    "field": "learning_path_id"
                                                }
                                            }
                                        ]

                                    }
                                }
                            ]
                        }
                    }
                    ]
                }

            };
        } else if (learning_path_id) {
            if (typeof learning_path_id === 'string' && learning_path_id.includes("LRN_PTH_")) {
                learning_path_id = parseInt(learning_path_id.replace("LRN_PTH_", ""))
            }
            query = {
                "bool": {
                    "must": [{
                        "bool": {
                            "should": [
                                { term: { "learning_path_id": learning_path_id } },
                                {
                                    "bool": {
                                        "must_not": [
                                            {
                                                "exists": {
                                                    "field": "learn_content_id"
                                                }
                                            },
                                            {
                                                "exists": {
                                                    "field": "learning_path_id"
                                                }
                                            }
                                        ]

                                    }
                                }
                            ]
                        }
                    }
                    ]
                }

            };
        }
        else {
            query = {
                "bool": {
                    "must_not": [
                        {
                            "exists": {
                                "field": "learn_content_id"
                            }
                        },
                        {
                            "exists": {
                                "field": "learning_path_id"
                            }
                        }
                    ]
                }

            };
        }
        if (category) {
            if (!query.bool.must) query.bool.must = []
            query.bool.must.push({ term: { "faq_category.keyword": category } })
        }



        if (pageType) {
            switch (pageType) {
                case "issuePage":
                    if (!query.bool.must) query.bool.must = []
                    query.bool.must.push({ term: { "show_on_issue_page": true } })

                    break;
                case "cancellationPage":
                    if (!query.bool.must) query.bool.must = []
                    query.bool.must.push({ term: { "show_on_cancellation_page": true } })

                default:
                    break;
            }
        }
        let result = await elasticService.search('faq', query, payload);

        if (result && result.hits && result.hits.length > 0) {
            for (const faqData of result.hits) {
                faqs.push(faqData._source);
            }
        }
        await RedisConnection.set(cacheKey, faqs);

        RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_FAQ || 1200);

        return faqs


    } catch (error) {

        console.log("Error Ocurred while fetching faqs", error);
        return []
    }

}

const getFaqCategories = async (skipCache) => {
    try {
        let cacheName = `faq-categories`
        let useCache = false
        if (skipCache != true) {
            let cacheData = await RedisConnection.getValuesSync(cacheName);
            if (cacheData.noCacheData != true) {
                return cacheData
            }
            else {
                return []
            }
        }
        if (useCache != true) {
            let response = await fetch(`${apiBackendUrl}/faq-categories?_limit=-1`);
            let data
            if (response.ok) {
                data = await response.json();
                data = data.map(function (el) {
                    return {
                        'label': el["default_display_label"],
                        'image': el["image"] ? el["image"].url :null
                    }
                })
                if (data) {
                    RedisConnection.set(cacheName, data);
                }
            }
        }
    } catch (err) {
        console.log("err", err)
        return []
    }
}


module.exports = {
    getFaq,
    getFaqCategories
}