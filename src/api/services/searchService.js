const elasticService = require("./elasticService");
const { getSearchTemplate } = require("../../utils/searchTemplates");

const MAX_PER_ENTITY = 23;

const entitySearchParams = {
    "learn-content": { maxResults: 15, defaultResults: 10, sourceFields: ['title', 'slug', 'reviews', 'provider_name', 'average_rating'] },
    "learn-path": { maxResults: 12, defaultResults: 6, sourceFields: ['title', 'slug', 'reviews', 'provider_name', 'average_rating'] },
    "article": { maxResults: 10, defaultResults: 4, sourceFields: ['title', 'slug', 'section_name', 'section_slug'] },
    "provider": { maxResults: 10, defaultResults: 3, sourceFields: ['name', 'slug'] }

}


const entitySearchSuggestionParams = {
    'keyword-suggestion': { maxResults: 10, sourceFields: ['suggestion'] },
    "learn-content": { maxResults: 15, sourceFields: ['title', 'slug'] },
    "learn-path": { maxResults: 12, sourceFields: ['title', 'slug'] },
    "article": { maxResults: 10, sourceFields: ['title', 'slug',] },
    "provider": { maxResults: 10, defaultResults: 3, sourceFields: ['name', 'slug'] }
}


module.exports = class searchService {
    async getSearchResult(req, callback) {
        try {
            const query = decodeURIComponent(req.params.keyword).trim();
            const userId = (req.user && req.user.userId) ? req.user.userId : req.segmentId;
            const entity = req.query.entity;
            const result = [];

            if (!entity || (entity == 'all')) {
                const searchResultPromises = [];
                for (const entity in entitySearchParams) {

                    const entitySearchTemplate = await getSearchTemplate(entity, query, userId);
                    const promise = elasticService.search(entity, entitySearchTemplate, { from: 0, size: entitySearchParams[entity].defaultResults }, entitySearchParams[entity].sourceFields);
                    searchResultPromises.push(promise);
                }

                const searchResults = await Promise.all(searchResultPromises);
                for (const searchResult of searchResults) {
                    if (searchResult && searchResult.total && searchResult.total.value) result.push(...searchResult.hits);
                }

            } else {


                const entitySearchTemplate = await getSearchTemplate(entity, query, userId);
                const searchResult = await elasticService.search(entity, entitySearchTemplate, { from: 0, size: entitySearchParams[entity].maxResults }, entitySearchParams[entity].sourceFields);

                if (searchResult && searchResult.total && searchResult.total.value) result.push(...searchResult.hits);

            }

            let data = {
                result: [],
                totalCount: 0,
                viewAll: false
            };
            if (result.length) {

                for (const hit of result) {

                    let data_source = hit._index;
                    let cardData = await this.getCardData(data_source, hit._source);
                    data.result.push(cardData);

                    data.totalCount++;
                    if (data.totalCount > MAX_PER_ENTITY) {
                        data.viewAll = true;
                    }
                }
                //  data.result = matchSorter(data.result, keyword, {keys: ['title'], threshold: matchSorter.rankings.NO_MATCH});

                callback(null, { success: true, message: 'Fetched successfully!', data: data });
            } else {
                callback(null, { success: true, message: 'No records found!', data: data });
            }



        } catch (error) {
            console.log("Error Occured while Searching", error);
            callback(null, { success: true, message: 'No records found!', data: {} });
        }

    }


    async getSearchSuggestions(req, callback){
        try {

            const query = decodeURIComponent(req.params.word).trim();
            const userId = (req.user && req.user.userId) ? req.user.userId : req.segmentId;
            const entity = req.query.entity;
            const result = [];

            if (!entity || (entity == 'all')) {
                const searchResultPromises = [];
                for (const entity in entitySearchSuggestionParams) {

                    const entitySearchTemplate = await getSearchTemplate(entity, query, userId);
                    const promise = elasticService.search(entity, entitySearchTemplate, { from: 0, size: entitySearchSuggestionParams[entity].maxResults }, entitySearchSuggestionParams[entity].sourceFields);
                    searchResultPromises.push(promise);
                }

                const searchResults = await Promise.all(searchResultPromises);
                for (const searchResult of searchResults) {
                    if (searchResult && searchResult.total && searchResult.total.value) result.push(...searchResult.hits);
                }

            } else {

                const entitySearchTemplate = await getSearchTemplate(entity, query, userId);
                const searchResult = await elasticService.search(entity, entitySearchTemplate, { from: 0, size: entitySearchSuggestionParams[entity].maxResults }, entitySearchSuggestionParams[entity].sourceFields);
                if (searchResult && searchResult.total && searchResult.total.value) result.push(...searchResult.hits);

            }


           const data = result.map((hit) => {
                const source = hit['_source'];

                if (hit['_index'].includes('keyword-suggestion')) return { type: 'keyword-suggestion', suggestion: source['suggestion'] }
                if (hit['_index'].includes('learn-content')) return { type: 'learn-content', suggestion: source['title'], slug: source['slug'] }
                if (hit['_index'].includes('learn-path')) return { type: 'learn-path', suggestion: source['title'], slug: source['slug'] }
                if (hit['_index'].includes('article')) return { type: 'article', suggestion: source['title'], slug: source['slug'] }
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
            callback(null, { success: false, message: 'No records found!', data: []});
        }
    }


    async getCardData(data_source, entityData) {
        let data = {};
        if (data_source == 'learn-content' || data_source.includes("learn-content-v")) {
            data = {
                index: "learn-content",
                title: entityData.title,
                slug: entityData.slug,
                rating: entityData.average_rating,
                reviews_count: entityData.reviews.length,
                provider: entityData.provider_name
            };
        }else if(data_source == 'learn-path' || data_source.includes("learn-path-v")){
            data = {
                index: "learn-path",
                title: entityData.title,
                slug: entityData.slug,
                rating: entityData.average_rating,
                reviews_count: entityData.reviews.length


            };
        }
        else if(data_source == 'provider' || data_source.includes("provider-v") ){
            data = {
                index: 'provider',
                title: entityData.name,
                slug: entityData.slug,
                description: "Institute"
            };
        }else if(data_source == 'article' || data_source.includes("article-v")){
            data = {
                index: data_source,
                title: entityData.title,
                slug: entityData.slug,
                section_name: entityData.section_name,
                section_slug: entityData.section_slug,
                description: "Advice"
            };
        }

        return data;
    }

}