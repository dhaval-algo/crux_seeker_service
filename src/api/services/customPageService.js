const elasticService = require("./elasticService");
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();
module.exports = class CustomPageService {
    
    async getCustomPageContent(slug, callback, useCache = true){

        const query = { 
            "bool": {
             "must":[
                { "match": { "slug.keyword": slug}}
              ]
            }
        };

        const cacheKey = "custom-pages-"+slug;

        if(useCache){
            
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    return callback(null, {status: 'success', message: 'Fetched successfully!', data: cacheData});
                }
            }catch(error){
                console.warn(`Redis cache failed for : ${cacheKey}`,error);
            }
        }

        const result = await elasticService.search('custom_pages', query);
        if(result.hits && result.hits.length > 0) {

            let data = { content:result.hits[0]._source };
            RedisConnection.set(cacheKey, data);

            callback(null, {status: 'success', message: 'Fetched successfully!', data:data});
        } else {
            callback(null, {status: 'failed', message: 'No data available!', data: {}});
        }

    }
}