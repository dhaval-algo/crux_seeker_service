const elasticService = require("./elasticService");

module.exports = class CustomPageService {
    
    async getNewsContent(slug, callback){

        const query = {
            "query": {
                "match_all": {}
            }
        }
        let result = null;
        try{
            result = await elasticService.search('in_the_news', query);
        }catch(e){
            console.log('Error while retriving data',e);
        }
        if(result && result.hits && result.hits.hits && result.hits.hits.length > 0) {
            callback(null, {status: 'success', message: 'Fetched successfully!', data:{ content:result.hits.hits} });
        } else {
            callback(null, {status: 'failed', message: 'No data available!', data: {}});
        }

    }
}