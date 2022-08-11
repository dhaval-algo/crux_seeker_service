const elasticService = require("./elasticService");
const helperService = require("../../utils/helper");

const getNewsData = async (data) => {
    let newData = [];
    for(let i=0;i<data.length;i++){
        newData.push(data[i]._source);
    }
    return newData;
}

module.exports = class CustomPageService {
    
    async getNewsContent(slug, callback){

        const query ={
            "match_all":{}
        };
        const payload = {
            "size":100
        }
        
        let result = null;
        try{
            result = await elasticService.search('in_the_news', query,payload);
            
        }catch(e){
            console.log('Error while retriving data',e);
        }
        if(result && result.hits && result.hits.length > 0) {
            let newsData = await getNewsData(result.hits);
            callback(null, {success: true, message: 'Fetched successfully!', data:newsData});
        } else {
            callback(null, {success: false, message: 'No data available!', data: []});
        }

    }

    async getNewsBySlug(slug, callback){
        const query = { 
            "bool": {
             "must":[
                { "match": { "slug.keyword": slug}}
              ]
            }
        };
        
        
        let result = null;
        try{
            result = await elasticService.search('in_the_news', query);
            
        }catch(e){
            console.log('Error while retriving data',e);
        }
        if(result && result.hits && result.hits.length > 0) {
           // let newsData = await getNewsData(result.hits);
            callback(null, {success: true, message: 'Fetched successfully!', data:result.hits[0]._source});
        } else {
            let redirectUrl = await helperService.getRedirectUrl(req);
            if (redirectUrl) {
                return callback(null, { success: false, redirectUrl: redirectUrl, message: 'Redirect' });
            }
            return callback(null, { success: false, message: 'Not found!' });
        }

    }
}