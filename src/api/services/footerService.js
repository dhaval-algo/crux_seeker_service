const elasticService = require("./elasticService");

module.exports = class FooterService {
    
    async getFooter(slug, callback){

        const query = {
            "match_all": {}
        };

        let result = null;
        try{
            result = await elasticService.search('footer', query);
            console.log(result);
        }catch(e){
            console.log('Error while retriving footer data',e);
        }
        if(result && result.hits && result.hits.length > 0) {
            callback(null, {status: 'success', message: 'Fetched successfully!', data:result.hits[0]._source.content});
        } else {
            callback(null, {status: 'failed', message: 'No data available!', data: []});
        }

    }
}