const elasticService = require("./elasticService");
const redisConnection = require('../../services/v1/redis');
const fetch = require("node-fetch");
const apiBackendUrl = process.env.API_BACKEND_URL;


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
                    return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
                }
            }catch(error){
                console.warn(`Redis cache failed for : ${cacheKey}`,error);
            }
        }

        const result = await elasticService.search('custom_pages', query);
        if(result.hits && result.hits.length > 0) {

            let data = { content:result.hits[0]._source };
            RedisConnection.set(cacheKey, data);
            RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_CUSTOM_PAGE); 

            callback(null, {success: true, message: 'Fetched successfully!', data:data});
        } else {
            /***
             * We are checking slug and checking(from the strapi backend APIs) if not there in the replacement.
             */
            let response = await fetch(`${apiBackendUrl}/url-redirections?old_url_eq=${slug}`);
            if (response.ok) {
                let urls = await response.json();
                if(urls.length > 0){  
                    slug = urls[0].new_url
                    return callback(null, {success: false,slug:slug, message: 'Redirect', data: {}});
                }else{
                    return callback(null, {success: false, message: 'No data available!', data: {}});
                }
            }
            callback(null, {success: false, message: 'No data available!', data: {}});
        }

    }
}