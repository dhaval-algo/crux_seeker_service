const elasticService = require("./elasticService");
const { getSearchTemplate } = require("../../utils/searchTemplates");
const recommendationService = require("./recommendationService");
let RecommendationService = new recommendationService();

const courseFields = ["id","partner_name","total_duration_in_hrs","basePrice","images","total_duration","total_duration_unit","conditional_price","finalPrice","provider_name","partner_slug","sale_price","average_rating_actual","provider_slug","learn_content_pricing_currency","slug","partner_currency","level","pricing_type","medium","title","regular_price","partner_id","ratings","reviews", "display_price","schedule_of_sale_price","activity_count","cv_take","listing_image", "card_image", "card_image_mobile", "coupons"]
const articleFields = ["id","author_first_name","author_last_name","created_by_role","cover_image","slug","author_id","short_description","title","premium","author_slug","co_authors","partners","activity_count","section_name","section_slug", "listing_image", "card_image", "card_image_mobile"]
const learnPathFields = ["id","title","slug","images","total_duration","total_duration_unit","levels","finalPrice","sale_price","average_rating_actual","currency","pricing_type","medium","regular_price","ratings","reviews","display_price","courses","activity_count","cv_take", "listing_image", "card_image", "card_image_mobile"]
const providerFields = ["id","name","slug","cover_image","card_image","card_image_mobile","logo","programs","institute_types","study_modes","reviews","address_line1","address_line2","city","state","pincode","country","phone","email","course_count","rating","ranks"]

const entitySearchParams = {
    "learn-content": { maxResults: process.env.MAX_SEARCH_RESULT_COURSE || 5, sourceFields: courseFields },
    "learn-path": { maxResults: process.env.MAX_SEARCH_RESULT_LP || 5, sourceFields: learnPathFields },
    "article": { maxResults: process.env.MAX_SEARCH_RESULT_ARTICLE || 5, sourceFields: articleFields },
    "provider": { maxResults: process.env.MAX_SEARCH_RESULT_PROVIDER || 5, sourceFields: providerFields}

}


const entitySearchSuggestionParams = {
    'keyword-suggestion': { maxResults: process.env.MAX_SEARCH_SUGGESTION_KEYWORD || 6, sourceFields: ['suggestion'] },
    "learn-content": { maxResults: process.env.MAX_SEARCH_SUGGESTION_COURSE || 5, sourceFields: ['title', 'slug'] },
    "learn-path": { maxResults: process.env.MAX_SEARCH_SUGGESTION_LP || 4, sourceFields: ['title', 'slug'] },
    "article": { maxResults: process.env.MAX_SEARCH_SUGGESTION_ARTICLE || 4, sourceFields: ['title', 'slug','section_slug'] },
    "provider": { maxResults: process.env.MAX_SEARCH_SUGGESTION_PROVIDER || 3, sourceFields: ['name', 'slug'] }
}


module.exports = class searchService {
    async getSearchResult(req, callback) {
        try {
            const query = decodeURIComponent(req.params.keyword).trim();
            const userId = (req.user && req.user.userId) ? req.user.userId : req.segmentId;
            const entity = req.query.entity;
            const result = [];

            if (!entity || (entity == 'all')) {
                const indices = [];
                const queries = [];
                for (const entity in entitySearchParams) {

                    const entitySearchTemplate = await getSearchTemplate(entity, query, userId, req);

                    indices.push(entity);
                    queries.push({ size: entitySearchParams[entity].maxResults, query: entitySearchTemplate, _source: entitySearchParams[entity].sourceFields });

                }

                const searchResults = await elasticService.multiSearch(indices, queries);
                for (const searchResult of searchResults) {

                    if (searchResult && !searchResult.error && searchResult.hits && searchResult.hits.hits && searchResult.hits.hits.length) {
                        result.push(...searchResult.hits.hits);

                    }
                }

            } else {

                const entitySearchTemplate = await getSearchTemplate(entity, query, userId, req);
                const searchResult = await elasticService.search(entity, entitySearchTemplate, { from: 0, size: entitySearchParams[entity].maxResults }, entitySearchParams[entity].sourceFields);

                if (searchResult && searchResult.total && searchResult.total.value) result.push(...searchResult.hits);

            }

            const data = {
                courses: [],
                "learn-paths": [],
                articles: [],
                institutes: []
            };
            if (result.length) {

                for (const hit of result) {

                    const cardData = await this.getCardData(hit._index, hit._source, req.query.currency);
                    switch (cardData.index) {

                        case "learn-content": data.courses.push(cardData);
                            break;
                        case "learn-path": data['learn-paths'].push(cardData);
                            break;
                        case "article": data.articles.push(cardData);
                            break;
                        case "provider": data.institutes.push(cardData);

                    }

                }

                callback(null, { success: true, message: 'Fetched successfully!', data: data });
            } else {
                callback(null, { success: true, message: 'No records found!', data: data });
            }


        } catch (error) {
            console.log("Error Occured while Searching", error);
            callback(null, { success: true, message: 'No records found!', data: {} });
        }

    }


    async getSearchSuggestions(req, callback) {
        try {

            const query = decodeURIComponent(req.params.word).trim();
            const userId = (req.user && req.user.userId) ? req.user.userId : req.segmentId;
            const entity = req.query.entity;
            const result = [];

            if (!entity || (entity == 'all')) {
                const indices = [];
                const queries = [];
                for (const entity in entitySearchSuggestionParams) {

                    const entitySearchTemplate = await getSearchTemplate(entity, query, userId, req);
                    indices.push(entity);
                    queries.push({ size: entitySearchSuggestionParams[entity].maxResults, query: entitySearchTemplate, _source: entitySearchSuggestionParams[entity].sourceFields });
                }

                const searchResults = await elasticService.multiSearch(indices, queries);
                for (const searchResult of searchResults) {
                    if (searchResult && !searchResult.error && searchResult.hits && searchResult.hits.hits && searchResult.hits.hits.length) {
                        result.push(...searchResult.hits.hits);
                    }
                }

            } else {

                const entitySearchTemplate = await getSearchTemplate(entity, query, userId, req);
                const searchResult = await elasticService.search(entity, entitySearchTemplate, { from: 0, size: entitySearchSuggestionParams[entity].maxResults }, entitySearchSuggestionParams[entity].sourceFields);
                if (searchResult && searchResult.total && searchResult.total.value) result.push(...searchResult.hits);

            }

            const data = result.map((hit) => {
                const source = hit['_source'];

                if (hit['_index'].includes('keyword-suggestion')) return { type: 'keyword-suggestion', suggestion: source['suggestion'] }
                if (hit['_index'].includes('learn-content')) return { type: 'learn-content', suggestion: source['title'], slug: source['slug'] }
                if (hit['_index'].includes('learn-path')) return { type: 'learn-path', suggestion: source['title'], slug: source['slug'] }
                if (hit['_index'].includes('article')) return { type: 'article', suggestion: source['title'], slug: `${source['section_slug']}/${source['slug']}` }
                if (hit['_index'].includes('provider')) return { type: 'provider', suggestion: source['name'], slug: source['slug'] }
            });

            if (data.length) {

                callback(null, { success: true, message: 'Fetched successfully!', data: data });
            }
            else {
                callback(null, { success: false, message: 'No records found!', data: [] });
            }

        } catch (error) {
            console.log("Error Occured while getting search suggestions", error);
            callback(null, { success: false, message: 'No records found!', data: [] });
        }
    }


    async getCardData(data_source, entityData, currency) {
        let data = {};
        if (data_source == 'learn-content' || data_source.includes("learn-content-v")) {
            // data = {
            //     index: "learn-content",
            //     title: entityData.title,
            //     slug: entityData.slug,
            //     rating: entityData.average_rating,
            //     reviews_count: entityData.reviews.length,
            //     provider: entityData.provider_name
            // };
            data = await RecommendationService.generateCourseFinalResponse(entityData, currency)
            data.index = "learn-content"
        } else if (data_source == 'learn-path' || data_source.includes("learn-path-v")) {
            // data = {
            //     index: "learn-path",
            //     title: entityData.title,
            //     slug: entityData.slug,
            //     rating: entityData.average_rating,
            //     reviews_count: entityData.reviews.length


            // };
            data = await RecommendationService.generateLearnPathFinalResponse(entityData, currency)
            data.index = "learn-path"
        }
        else if (data_source == 'provider' || data_source.includes("provider-v")) {
            // data = {
            //     index: 'provider',
            //     title: entityData.name,
            //     slug: entityData.slug,
            //     description: "Institute"
            // };
            data = await RecommendationService.generateproviderFinalResponse(entityData)
            data.index = "provider"
        } else if (data_source == 'article' || data_source.includes("article-v")) {
            // data = {
            //     index: 'article',
            //     title: entityData.title,
            //     slug: entityData.slug,
            //     section_name: entityData.section_name,
            //     section_slug: entityData.section_slug,
            //     description: "Advice"
            // };
            data = await RecommendationService.generateArticleFinalResponse(entityData)
            data.index = "article"
        }

        return data;
    }

}