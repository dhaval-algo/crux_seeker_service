const elasticService = require("./elasticService");
const learnContentService = require("./learnContentService");
let LearnContentService = new learnContentService();



module.exports = class searchService {
    async getSearchResult(req, callback){
        const keyword = req.params.keyword;
        console.log("Search Keyword <> ", keyword);
        const query = { 
            "bool": {
                "should": [
                  {
            "bool": {
                "must": [
                    {term: { "status.keyword": 'published' }},
                    {
                        "multi_match": {
                          "query": keyword,
                          "fields": [
                            "title",
                            "provider_name"
                          ]
                        }
                    },
                    {
                        "term": {
                          "_index": "learn-content"
                        }
                    }                
                ]
            }},
            {
            "bool": {
                "must": [
                    {term: { "status.keyword": 'approved' }},
                    {
                        "multi_match": {
                          "query": keyword,
                          "fields": [
                            "name"
                          ]
                        }
                    },
                    {
                        "term": {
                          "_index": "provider"
                        }
                    }                
                ]
            }}
        ]
    }
        };
        console.log("Final Query <> ", JSON.stringify(query));

        const result = await elasticService.search('learn-content,provider', query);
        if(result.total && result.total.value > 0){

            let data = {};

            for(const hit of result.hits){
                let data_source = hit._index;

                if(!data[data_source]){
                    data[data_source] = [];
                }

                let cardData = await this.getCardData(data_source, hit._source);
                data[data_source].push(cardData);            
            }

            
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data});
        }else{
            callback(null, {status: 'success', message: 'No records found!', data: []});
        }        
    }



    async getCardData(data_source, entityData){
        let data = {};
        if(data_source == 'learn-content'){
            data = {
                title: entityData.title,
                slug: entityData.slug,
                rating: entityData.average_rating,
                reviews_count: entityData.reviews.length,
                provider: entityData.provider_name
            };
        }else if(data_source == 'provider'){
            data = {
                title: entityData.name,
                slug: entityData.slug,
                description: "Institute"
            };
        }
        return data;
    }
    


}