const elasticService = require("./elasticService");
const searchTemplates = require("../../utils/searchTemplates");

const MAX_PER_ENTITY = 23;

const entitySearchParams = {
    "learn-content": { searchTemplate: searchTemplates.getCourseSearchTemplate, maxResults: 15, defaultResults: 10, sourceFields: ['title', 'slug', 'reviews', 'provider_name', 'average_rating'] },
    "learn-path": { searchTemplate: searchTemplates.getLearnPathSearchTemplate, maxResults: 12, defaultResults: 6, sourceFields: ['title', 'slug', 'reviews', 'provider_name', 'average_rating'] },
    "article": { searchTemplate: searchTemplates.getArticleSearchTemplate, maxResults: 10, defaultResults: 4, sourceFields: ['title', 'slug', 'section_name', 'section_slug'] },
    "provider": { searchTemplate: searchTemplates.getProviderSearchTemplate, maxResults: 10, defaultResults: 3, sourceFields: ['name', 'slug'] }
}

module.exports = class searchService {
    async getSearchResult(req, callback){
        try{
            const query = decodeURIComponent(req.params.keyword).trim();
            const userId = (req.user && req.user.userId) ? req.user.userId : req.segmentId;
            const entity = req.query.entity;
            const result = [];

            if (!entity || (entity == 'all')) {
                const searchResultPromises = [];
                for (const entity in entitySearchParams) {

                    if (entity == 'learn-content') {
                        const courseSearchTemplate = await entitySearchParams[entity].searchTemplate(query, userId);
                        const promise = elasticService.search(entity, courseSearchTemplate, { from: 0, size: entitySearchParams[entity].defaultResults }, entitySearchParams[entity].sourceFields);
                        searchResultPromises.push(promise);
                    } else {
                        const promise = elasticService.search(entity, entitySearchParams[entity].searchTemplate(query), { from: 0, size: entitySearchParams[entity].defaultResults }, entitySearchParams[entity].sourceFields);
                        searchResultPromises.push(promise);
                    }
                }

                const searchResults = await Promise.all(searchResultPromises);
                for (const searchResult of searchResults) {
                    if (searchResult && searchResult.total && searchResult.total.value) result.push(...searchResult.hits);
                }

            } else {

                let searchResult = null;
                if (entity == 'learn-content') {
                    const courseSearchTemplate = await entitySearchParams[entity].searchTemplate(query, userId);
                    searchResult = await elasticService.search(entity, courseSearchTemplate, { from: 0, size: entitySearchParams[entity].maxResults }, entitySearchParams[entity].sourceFields);

                } else {
                    searchResult = await elasticService.search(entity, entitySearchParams[entity].searchTemplate(query), { from: 0, size: entitySearchParams[entity].maxResults }, entitySearchParams[entity].sourceFields);
                }

                if (searchResult && searchResult.total && searchResult.total.value) result.push(...searchResult.hits);

            }

        let data = {
            result: [],
            totalCount: 0,
            viewAll: false
        };
        if(result.length){            

            for(const hit of result){
                
                let data_source = hit._index;
                let cardData = await this.getCardData(data_source, hit._source);
                data.result.push(cardData);
                                 
                data.totalCount++;
                if(data.totalCount > MAX_PER_ENTITY){
                    data.viewAll = true;
                }  
            }
          //  data.result = matchSorter(data.result, keyword, {keys: ['title'], threshold: matchSorter.rankings.NO_MATCH});
         
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data });
        }else{
            callback(null, {status: 'success', message: 'No records found!', data: data});
        } 
        
     

    }catch(error){
        console.log("Error Occured while Searching",error);
        callback(null, {status: 'success', message: 'No records found!', data:{}});
    }
         
    }



    async getCardData(data_source, entityData){
        let data = {};
        if(data_source == 'learn-content' || data_source.includes("learn-content-v")){
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


    async getSearchKeyword(req, callback){
        const word = decodeURIComponent(req.params.word);
        let  suggest = {
            "keyword_suggest": {
              "prefix": word,        
              "completion": {         
                  "field": "word",
                  "size": MAX_PER_ENTITY  ,
                  "skip_duplicates" :true,
                  "fuzzy": {
                      "fuzziness": "auto"
                    }
              }
            }
        }
        const result = await elasticService.search("search_keyword_suggestion", null, {},null,suggest);
        let data = []
        if(result && result.keyword_suggest.length > 0){            
            for(const keyword_suggest of result.keyword_suggest){
                for(const option of keyword_suggest.options){
                    data.push(option.text);  
                }
            }

            callback(null, {status: 'success', message: 'Fetched successfully!', data: data });
        }else{
            callback(null, {status: 'success', message: 'No records found!', data: data});
        }
    }

    async getSearchWithSuggestion(req, callback){
        const keyword = decodeURIComponent(req.params.word);
        const entity = req.query.entity;
        const queryEntities = [];
        let sourceFields = [];
        
        let query = { 
                    "bool": {
                        "should": []
                    }
                };
        
        for (const [key, value] of Object.entries(entityQueryMapping)) {
            queryEntities.push(key);
            sourceFields = [...sourceFields, ...entityQueryMapping[key]['source_fields']];
            const entityQuery = generateEntityQuery(key, keyword);
            query.bool.should.push(entityQuery);

        }            

        let  suggest = {
            "keyword_suggest": {
              "prefix": keyword,        
              "completion": {         
                  "field": "word",
                  "size": MAX_PER_ENTITY  ,
                  "skip_duplicates" :true,
                  "fuzzy": {
                      "fuzziness": "auto"
                    }
              }
            }
        }
       
       // const result = await elasticService.search(queryEntities.join(","), query, {from: 0, size: MAX_RESULT});
        let [result, result2] = await Promise.all([elasticService.search(queryEntities.join(","), query, {from: 0, size: MAX_RESULT}), elasticService.search("search_keyword_suggestion", null, {},null,suggest)]);
        
        console.log("result", result)
        console.log("result2", result2)
        let data = {
            result: [],
            keywords : [],
            totalCount: 0,
            viewAll: false
        };
        if(result.total && result.total.value > 0){            

            for(const hit of result.hits){
                let data_source = hit._index;
                let cardData = await this.getCardData(data_source, hit._source);
                
                if(data.result.length < MAX_PER_ENTITY){
                    data.result.push(cardData);
                }                    
                data.totalCount++;
                if(data.totalCount > MAX_PER_ENTITY){
                    data.viewAll = true;
                }  
            }
        }

        
        if(result2 && result2.keyword_suggest.length > 0){            
            for(const keyword_suggest of result2.keyword_suggest){
                for(const option of keyword_suggest.options){
                    data.keywords.push(option.text);  
                }
            }
        }
        if(data.totalCount > 0 || data.keywords.length > 0){
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data });
        }else{
            callback(null, {status: 'success', message: 'No records found!', data: data});
        }
    }
}