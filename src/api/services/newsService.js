const elasticService = require("./elasticService");
const fetch = require("node-fetch");
const apiBackendUrl = process.env.API_BACKEND_URL;

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
            /***
             * We are checking slug and checking(from the strapi backend APIs) if not there in the replacement.
             */
            let response = await fetch(`${apiBackendUrl}/url-redirections?old_url_eq=${slug}`);
            if (response.ok) {
                let urls = await response.json();
                if(urls.length > 0){  
                    slug = urls[0].new_url
                    return callback(null, {success: false,slug:slug, message: 'Redirect', data: []});
                }else{
                    return callback(null, {success: false, message: 'No data available!', data: []});
                }
            }
            callback(null, {success: false, message: 'No data available!', data: []});
        }

    }
}