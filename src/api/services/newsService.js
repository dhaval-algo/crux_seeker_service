const elasticService = require("./elasticService");

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
            callback(null, {status: 'success', message: 'Fetched successfully!', data:newsData});
        } else {
            callback(null, {status: 'failed', message: 'No data available!', data: []});
        }

    }

    async getNewsBySlug(slug, callback){
        
        /***
         * We are checking every incoming slug and checking(from the strapi backend APIs) if not there in the replacement.
         */
         let response = await fetch(`${apiBackendUrl}/url-redirections?old_url_eq=${slug}`);
         if (response.ok) {
             let urls = await response.json();
             if(urls.length > 0){  
                 slug = urls[0].new_url
             }
         }

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
            callback(null, {status: 'success', message: 'Fetched successfully!', data:result.hits[0]._source});
        } else {
            callback(null, {status: 'failed', message: 'No data available!', data: []});
        }

    }
}