const elasticService = require("./elasticService");

module.exports = class CustomPageService {
    
    async getNewsContent(slug, callback){

        const query = {
            "from": 0,  
            "size": 9,   
            "query": {
                "match_all": {}
            }
        }
            

        const result = await elasticService.search('in-the-news', query);
        if(result.hits && result.hits.hits && result.hits.hits.length > 0) {
            callback(null, {status: 'success', message: 'Fetched successfully!', data:{ content:result.hits.hits} });
        } else {
            callback(null, {status: 'failed', message: 'No data available!', data: {}});
        }

    }
}