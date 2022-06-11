const { getAllTimeSessionKPIs, getRecentSessionKPIs } = require("../utils/sessionActivity");


const entityQueryMapping = {
    'learn-content': { status: 'published', prefix_field: "title", fuzziness_fields: ["title^16", "skills^4", "topics^3", "what_will_learn^3", "categories^3", "sub_categories^3", "provider_name^2"], fields: ["title^18", "skills^4", "topics^4", "what_will_learn^3", "categories^3", "sub_categories^3", "provider_name^2"],kpis: ["topics", "skills", "categories", "sub_categories"] },
    'learn-path': { status: 'approved', prefix_field: "title", fuzziness_fields: ["title^13.5", "courses.title^12", "topics^10", "categories^8", "sub_categories^6"], fields: ["title^13.5", "courses.title^12", "topics^10", "categories^8", "sub_categories^6", "description^4"] },
    'provider': { status: 'approved', prefix_field: "name", fuzziness_fields: ["name^7"], fields: ['name^7'] },
    'article': { status: 'published', prefix_field: "title", fuzziness_fields: ["title^14", "article_skills^13", "article_topics^12", "categories^10", "article_sub_categories^8"], fields: ["title^14.5", "article_skills^13", "article_topics^12", "categories^10", "article_sub_categories^8", "content^4"] }
};


const weightForKeywordBoosting = process.env.KEYWORD_BOOST_WEIGHT || 1.5;

const getFunctionScoreFunction = (kpiKey, kpis, weight = weightForKeywordBoosting) => {
    return {
        filter: {
            terms: {

                [`${kpiKey}.keyword`]: kpis

            }
        },
        weight: weight
    }
}



const getCourseSearchTemplate = async (query, userId = null) => {

    const courseQueryMapping = entityQueryMapping['learn-content'];
    const template = {
        function_score: {
            functions: [
                {
                    field_value_factor: {
                        field: "activity_count.all_time.course_views",
                        modifier: "log2p",
                        missing: 0
                    }
                }
            ],
            score_mode: "multiply",
            boost_mode: "multiply",
            query: {
                bool: {
                    must: [
                        {
                            term: {
                                "status.keyword": courseQueryMapping.status
                            }
                        },
                        {
                            term: {
                                _index: "learn-content"
                            }
                        }
                    ],
                    should: [
                        {
                            multi_match: {
                                query: query,
                                type: "bool_prefix",
                                boost: 50,
                                fields: [
                                    courseQueryMapping.prefix_field
                                ]
                            }
                        },
                        {
                            match_phrase_prefix: {
                                [courseQueryMapping.prefix_field]: {
                                    query: query,
                                    boost: 30
                                }
                            }
                        },
                        {
                            multi_match: {
                                fields: courseQueryMapping.fields,
                                query: query,
                                boost: 35
                            }
                        },
                        {
                            multi_match: {
                                fields: courseQueryMapping.fuzziness_fields,
                                query: query,
                                fuzziness: "AUTO",
                                prefix_length: 0,
                                boost: 5
                            }
                        }
                    ]
                }
            }
        }
    }

    if (userId) {
        const recentSessionKPIs = await getRecentSessionKPIs(userId);
        const allTimeSessionKPIs = await getAllTimeSessionKPIs(userId);
        for (const kpiKey of courseQueryMapping.kpis) {

            let kpis = [];

            if (recentSessionKPIs[kpiKey]) kpis.push(...recentSessionKPIs[kpiKey]);
            if (allTimeSessionKPIs.topKPIs && allTimeSessionKPIs.topKPIs[kpiKey]) kpis.push(...allTimeSessionKPIs.topKPIs[kpiKey]);

            kpis = Array.from(new Set(kpis));
            if (kpis.length) {

                const functionScoreFunction = getFunctionScoreFunction(kpiKey, kpis);
                template.function_score.functions.push(functionScoreFunction);

            }

        }

    }



    return template;

}



const getLearnPathSearchTemplate = (query) => {

    const learnPathQueryMapping = entityQueryMapping['learn-path'];
    const template = {
        bool: {
            must: [
                {
                    term: {
                        "status.keyword": learnPathQueryMapping.status
                    }
                }

            ],
            should: [
                {
                    multi_match: {
                        query: query,
                        type: "bool_prefix",
                        boost: 50,
                        fields: [
                            learnPathQueryMapping.prefix_field
                        ]
                    }
                },
                {
                    match_phrase_prefix: {
                        [learnPathQueryMapping.prefix_field]: {
                            query: query,
                            boost: 30
                        }
                    }
                },
                {
                    multi_match: {
                        fields: learnPathQueryMapping.fields,
                        query: query,
                        boost: 35
                    }
                },
                {
                    multi_match: {
                        fields: learnPathQueryMapping.fuzziness_fields,
                        query: query,
                        fuzziness: "AUTO",
                        prefix_length: 0,
                        boost: 5
                    }
                }
            ]

        }
    };

    return template;

}


const getArticleSearchTemplate = (query) => {

    const articleQueryMapping = entityQueryMapping['article'];
    const template = {
        bool: {
            must: [
                {
                    term: {
                        "status.keyword": articleQueryMapping.status
                    }
                }

            ],
            should: [
                {
                    multi_match: {
                        query: query,
                        type: "bool_prefix",
                        boost: 50,
                        fields: [
                            articleQueryMapping.prefix_field
                        ]
                    }
                },
                {
                    match_phrase_prefix: {
                        [articleQueryMapping.prefix_field]: {
                            query: query,
                            boost: 30
                        }
                    }
                },
                {
                    multi_match: {
                        fields: articleQueryMapping.fields,
                        query: query,
                        boost: 35
                    }
                },
                {
                    multi_match: {
                        fields: articleQueryMapping.fuzziness_fields,
                        query: query,
                        fuzziness: "AUTO",
                        prefix_length: 0,
                        boost: 5
                    }
                }
            ]

        }
    };

    return template;

}


const getProviderSearchTemplate = (query) => {

    const providerQueryMapping = entityQueryMapping['provider'];
    const template = {
        bool: {
            must: [
                {
                    term: {
                        "status.keyword": providerQueryMapping.status
                    }
                }

            ],
            should: [
                {
                    multi_match: {
                        query: query,
                        type: "bool_prefix",
                        boost: 50,
                        fields: [
                            providerQueryMapping.prefix_field
                        ]
                    }
                },
                {
                    match_phrase_prefix: {
                        [providerQueryMapping.prefix_field]: {
                            query: query,
                            boost: 30
                        }
                    }
                },
                {
                    multi_match: {
                        fields: providerQueryMapping.fields,
                        query: query,
                        boost: 35
                    }
                },
                {
                    multi_match: {
                        fields: providerQueryMapping.fuzziness_fields,
                        query: query,
                        fuzziness: "AUTO",
                        prefix_length: 0,
                        boost: 5
                    }
                }
            ]

        }
    };

    return template;

}




module.exports = {

    getCourseSearchTemplate,
    getLearnPathSearchTemplate,
    getArticleSearchTemplate,
    getProviderSearchTemplate
}