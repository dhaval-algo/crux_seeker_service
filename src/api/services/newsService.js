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
            "size": 20,  
            "query": {
            "bool": {
              "must_not": [
                  { "match": { "slug.keyword":   ""}}
              ]
            }
            }
        };
        console.log('Query',query);
        let result = null;
        try{
            result = await elasticService.search('in_the_news', query);
            console.log(result);
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
        console.log('Slug==',slug);
        const query = { 
            "bool": {
             "must":[
                { "match": { "slug.keyword": slug}}
              ]
            }
        };
        
        console.log('Query',query);
        let result = null;
        try{
            result = await elasticService.search('in_the_news', query);
            console.log(result);
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