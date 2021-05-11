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
            let footerData = {};
            for(let i=0;i<result.hits.length;i++){
                if(Object.keys(result.hits[i]._source).length != 0){
                    footerData = result.hits[i]._source.content;
                    break;
                }
            }
            callback(null, {status: 'success', message: 'Fetched successfully!', data:footerData});
        } else {
            callback(null, {status: 'failed', message: 'No data available!', data: []});
        }

    }
}