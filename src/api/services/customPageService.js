const elasticService = require("./elasticService");

module.exports = class customPageService {
    
    async getLearnContentList(slug, callback){

        const query = { 
            "bool": {
             "must":[
                { "match": { "slug.keyword": slug}}
              ]
            }
        };

        const result = await elasticService.search('custom_pages', query);
        if(result.hits && result.hits.length > 0) {
            callback(null, {status: 'success', message: 'Fetched successfully!', data:{ content:result.hits[0]._source} });
        } else {
            callback(null, {status: 'failed', message: 'No data available!', data: {}});
        }

    }
}