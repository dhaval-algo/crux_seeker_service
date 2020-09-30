const elasticService = require("./elasticService");

module.exports = class learnContentService {

    async getLearnContent(slug, callback){
        const query = { "bool": {
            "must": [
              {term: { "slug.keyword": slug }},
              {term: { "status.keyword": 'published' }}
            ]
        }};
        const result = await elasticService.search('learn-content', query);
        if(result && result.length > 0){
            let data = {
                ...result[0]
            };
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data});
        }else{
            callback({status: 'failed', message: 'Not found!'}, null);
        }        
    }

}