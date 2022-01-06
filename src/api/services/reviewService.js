const elasticService = require("./elasticService");

module.exports = class reviewService {

    async getReviews(index, targetId, req) {

        return new Promise(async(resolve, reject) => {

            const sortingkeys = ["newest", "highest_rated", "lowest_rated"];
            const {
                page = 1,
                limit = 5,
                sort = "highest_rated",
                filters = {
                    keyword: null,
                },
            } = req.query;

            let nestedQuery = {
                match_all: {}
            }

            let innerHits = {
                highlight: {
                    fields: {
                        "reviews.review": {},
                    },
                },
                from: (page - 1) * limit,
                size: limit,
            };

            switch (sort) {
                case "highest_rated": case "lowest_rated":
                    innerHits.sort = { "reviews.rating": { order: sort == "highest_rated" ? "desc" : "asc" } };
                    break;
                default:
                    innerHits.sort = { "reviews.review_date": { order: "desc" } };
                    break;
            }

            if (filters && filters.keyword) {
                nestedQuery = {
                    match: {
                        "reviews.review": filters.keyword,
                    }
                }
            }

            let query = {
                bool: {
                    filter: [
                        { term: { _id: { value: targetId } } }
                    ],
                    should: [
                        {
                            nested: {
                                path: "reviews",
                                query: nestedQuery,
                                inner_hits: innerHits,
                            },
                        },
                    ],
                },
            };

            let keywordTerms = {
                field: "reviews.review",
                min_doc_count: 5,
                exclude: ["a", "A", "an", "is", "are", "etc", "the", "this", "that", "those", "here", "there", "and", "of", "or", "then", "to", "in", "i", "course", "my", "as", "with", "me", "also", "it", "across", "was", "for", "you", "all"],
            };

            let queryPayload = {
                from: 0,
                size: 1,
                aggs: {
                    reviews: {
                        nested: {
                            path: "reviews",
                        },
                        aggs: {
                            keywords: {},
                        },
                    },
                },
                _source: ["title"]
            };

            queryPayload.aggs.reviews.aggs.keywords[process.env.REVIEW_AGG_TYPE || "terms"] = keywordTerms;

            let response = {
                list: [],
                totalCount: 0,
                filters: filters,
                keywords: [],
                sortKeys: sortingkeys,
            };

            try {
                const result = await elasticService.searchWithAggregate(index, query, queryPayload);
                if (result.hits.total.value > 0) {
                    let innerReviewHits = result.hits.hits[0].inner_hits.reviews.hits;
                    if (innerReviewHits && innerReviewHits.total.value > 0) {
                        response.totalCount = innerReviewHits.total.value;
                        let reviews = innerReviewHits.hits;
                        if (reviews.length > 0) {
                            for (let hitObject of reviews) {
                                response.list.push({ ...hitObject._source, highlight: hitObject.highlight ? hitObject.highlight['reviews.review'] : [] });
                            }
                        }
                    }
                    response.keywords = result.aggregations.reviews.keywords.buckets;
                    resolve(response);
                } else {
                    reject(new Error("No item found for :" + targetId));
                }
            } catch (error) {
                reject(error);
            }

        })

    }

}