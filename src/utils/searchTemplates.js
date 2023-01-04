const { getAllTimeSessionKPIs, getRecentSessionKPIs } = require("../utils/sessionActivity");


const entityQueryMapping = {
    'learn-content': { status: 'published', prefix_field: "title", total_view_field: "activity_count.all_time.course_views", fields: ["title^10", "subtitle^8", "categories^6", "sub_categories^6", "topics^5", "skills^4", "what_will_learn^3", "content^3", "description^2"], kpis: ["topics", "skills", "categories", "sub_categories"] },
    'learn-path': { status: 'approved', prefix_field: "title", total_view_field: "activity_count.all_time.learnpath_views", fuzziness_fields: ["title^10", "courses.title^4"], fields: ["title^10", "categories^8", "sub_categories^8", "topics^6", "courses.title^4", "description^2"], kpis: ["topics", "categories", "sub_categories"] },
    'provider': { status: 'approved', prefix_field: "name", fuzziness_fields: ["name^4"], fields: ["name^4", "overview^2"] },
    'article': { status: 'published', prefix_field: "title", total_view_field: "activity_count.all_time.article_views", fuzziness_fields: ["title^10"], fields: ["title^10", "short_description^6", "article_skills^6", "article_topics^6", "categories^6", "article_sub_categories^6", "content^2"], kpis: ["topics", "skills", "categories", "sub_categories"] },
    'keyword-suggestion': { prefix_field: 'suggestion', total_view_field: 'clicks', fuzziness_fields: ["suggestion^6"], fields: ["suggestion^6", "sub_categories^4", "categories^4", "topics^2"], kpis: ["topics", "categories", "sub_categories"] }
};


const weightForKeywordBoosting = process.env.KEYWORD_BOOST_WEIGHT || 1.5;
const boostForMultiMatchPrefix = process.env.MULTI_MATCH_PREFIX_BOOST || 50;
const boostForMatchPhrasePrefix = process.env.MATCH_PHRASE_PREFIX_BOOST || 30;
const boostForMultiMatchAndOp = process.env.MULTI_MATCH_AND_OP_BOOST || 40;
const boostForFuzzinessField = process.env.FUZZINESS_FIELD_BOOST || 5;

const entityKPIKeyElasticFieldMap = {

    "article": {
        "topics": "article_topics",
        "skills": "article_skills",
        "categories": "categories",
        "sub_categories": "article_sub_categories"
    },

    "learn-content": {
        "topics": "topics",
        "skills": "skills",
        "categories": "categories",
        "sub_categories": "sub_categories"
    },
    "learn-path": {
        "topics": "topics",
        "categories": "categories",
        "sub_categories": "sub_categories"

    },

    "keyword-suggestion": {
        "topics": "topics",
        "categories": "categories",
        "sub_categories": "sub_categories"

    }
}

const getSessionBasedFunctionScoreFunctions = async (entity, userId, weight = weightForKeywordBoosting) => {

    const functions = [];

    if (userId) {
        const recentSessionKPIs = await getRecentSessionKPIs(userId);
        const allTimeSessionKPIs = await getAllTimeSessionKPIs(userId);
        const entityKpiKeys = entityQueryMapping[entity].kpis;

        for (const kpiKey of entityKpiKeys) {

            let kpis = [];

            if (recentSessionKPIs[kpiKey]) kpis.push(...recentSessionKPIs[kpiKey]);
            if (allTimeSessionKPIs.topKPIs && allTimeSessionKPIs.topKPIs[kpiKey]) kpis.push(...allTimeSessionKPIs.topKPIs[kpiKey]);

            kpis = Array.from(new Set(kpis));
            if (kpis.length) {

                functions.push({
                    filter: {
                        terms: {

                            [`${entityKPIKeyElasticFieldMap[entity][kpiKey]}.keyword`]: kpis

                        }
                    },
                    weight: weight
                });

            }

        }

    }

    return functions;

}


const getUserKpis = async (entity, userId, weight = weightForKeywordBoosting) => {

    return await getSessionBasedFunctionScoreFunctions(entity , userId , weight);

}

const getSearchTemplate = async (entity, query, userId = null, req = null) => {

    if (entity == 'provider') return getProviderSearchTemplate(query);

    const entityQueryFields = entityQueryMapping[entity];
    const template = {
        function_score: {
            functions: [
                {
                    field_value_factor: {
                        field: entityQueryFields.total_view_field,
                        modifier: "log2p",
                        missing: 8
                    }
                }
            ],
            score_mode: "multiply",
            boost_mode: "multiply",
            query: {
                bool: {
                    must: [
                        {

                            bool: {

                                should: [
                                    {
                                        multi_match: {
                                            query: query,
                                            type: "bool_prefix",
                                            boost: boostForMultiMatchPrefix,
                                            fields: [
                                                entityQueryFields.prefix_field
                                            ]
                                        }
                                    },
                                    {
                                        match_phrase_prefix: {
                                            [entityQueryFields.prefix_field]: {
                                                query: query,
                                                boost: boostForMatchPhrasePrefix
                                            }
                                        }
                                    },
                                    {
                                        multi_match: {
                                            fields: entityQueryFields.fields,
                                            query: query,
                                            boost: boostForMultiMatchAndOp,
                                            operator: "AND"
                                        }
                                    }

                                ]
                            }
                        }
                    ]
                }
            }
        }
    }


    if (entityQueryFields.status) {

        template.function_score.query.bool.must.push({
            term: {
                "status.keyword": entityQueryFields.status
            }
        });
    }

    if (entity == 'learn-path' || entity == 'article' || entity == 'keyword-suggestion') {
        template.function_score.query.bool.must[0].bool.should.push(
            {
                multi_match: {
                    fields: entityQueryFields.fuzziness_fields,
                    query: query,
                    fuzziness: "AUTO",
                    prefix_length: 0,
                    boost: boostForFuzzinessField
                }
            }

        );

    }

    if (entity == 'article') {
        let region = (req && req.query && req.query['c697d2981bf416569a16cfbcdec1542b5398f3cc77d2b905819aa99c46ecf6f6']) ? req.query['c697d2981bf416569a16cfbcdec1542b5398f3cc77d2b905819aa99c46ecf6f6'] : 'India'
        template.function_score.query.bool.must.push({
            "bool": {
                "should": [
                    {
                        "bool": {
                            "filter": [
                                {
                                    "terms": {
                                        "template.keyword": [
                                            "ARTICLE",
                                            "LEARN_GUIDE",
                                            "LEARN_ADVICE"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "bool": {
                            "filter": [
                                {
                                    "term": {
                                        "template.keyword": "CAREER_GUIDE"
                                    }
                                },
                                {
                                    "term": {
                                        "career_level.keyword": "Level 1"
                                    }
                                },
                                {
                                    "term": {
                                        "region.keyword": region
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        })
    }

    const functions = await getUserKpis(entity, userId);
    template.function_score.functions.push(...functions);

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
                },
                {

                    bool: {
                        should: [
                            {
                                multi_match: {
                                    query: query,
                                    type: "bool_prefix",
                                    boost: boostForMultiMatchPrefix,
                                    fields: [
                                        providerQueryMapping.prefix_field
                                    ]
                                }
                            },
                            {
                                match_phrase_prefix: {
                                    [providerQueryMapping.prefix_field]: {
                                        query: query,
                                        boost: boostForMatchPhrasePrefix
                                    }
                                }
                            },
                            {
                                multi_match: {
                                    fields: providerQueryMapping.fields,
                                    query: query,
                                    boost: boostForMultiMatchAndOp,
                                    operator: "AND",
                                }
                            },
                            {
                                multi_match: {
                                    fields: providerQueryMapping.fuzziness_fields,
                                    query: query,
                                    fuzziness: "AUTO",
                                    prefix_length: 0,
                                    boost: boostForFuzzinessField
                                }
                            }
                        ]
                    }
                }
            ]

        }
    };

    return template;

}

module.exports = {

    getSearchTemplate,
    getUserKpis
}