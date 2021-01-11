const mSorter = require("match-sorter");
let {matchSorter} = mSorter;
const elasticService = require("./elasticService");
const learnContentService = require("./learnContentService");
let LearnContentService = new learnContentService();

const entityQueryMapping = {
    'learn-content': {label: 'Course', status: 'published', fields: ['title','categories','sub_categories','provider_name','level','learnng_mediums','partner_name'], source_fields: ['title']},
    'provider': {label: 'Institute', status: 'approved', fields: ['name','program_types'], source_fields: ['name','slug']},
    'article': {label: 'Article', status: 'published', fields: ['title', 'section_name', 'author_first_name', 'author_last_name'], source_fields: ['title', 'slug', 'section_name', 'section_slug']}
};

const MAX_PER_ENTITY = 20;
const MAX_RESULT = 30;

const generateEntityQuery = (entity, keyword) => {
    let entityConfig = entityQueryMapping[entity];
    let entity_query = {
        "bool": {
          "must": [
            {
              "term": {
                "status.keyword": entityConfig.status
              }
            },
            /* {
              "multi_match": {
                "query": `${decodeURIComponent(keyword)}`,
                "fields": entityConfig.fields
              }
            }, */
            {
            "query_string" : {
                "query" : `*${decodeURIComponent(keyword)}*`,
                "fields" : entityConfig.fields,
                "analyze_wildcard" : true,
                "allow_leading_wildcard": true
            }
        },
            {
              "term": {
                "_index": entity
              }
            }
          ]
        }
      };
      return entity_query;
};


module.exports = class searchService {
    async getSearchResult(req, callback){
        const keyword = decodeURIComponent(req.params.keyword);
        const entity = req.query.entity;
        const queryEntities = [];
        let sourceFields = [];
        
        let query = { 
                    "bool": {
                        "should": []
                    }
                };
        if(!entity || (entity == 'all')){
            for (const [key, value] of Object.entries(entityQueryMapping)) {
                queryEntities.push(key);
                sourceFields = [...sourceFields, ...entityQueryMapping[key]['source_fields']];
                const entityQuery = generateEntityQuery(key, keyword);
                query.bool.should.push(entityQuery);
            }            
        }else{
            queryEntities.push(entity);
            sourceFields = [...sourceFields, ...entityQueryMapping[entity]['source_fields']];
            const entityQuery = generateEntityQuery(entity, keyword);
            query.bool.should.push(entityQuery);
        }

        const uniqueFields = sourceFields.filter(function(item, pos, self) {
            return self.indexOf(item) == pos;
        });

        console.log("Query <> ", JSON.stringify(query));       

        const result = await elasticService.search(queryEntities.join(","), query, {from: 0, size: MAX_RESULT});
        //console.log("Result Reponse <<>>>>>> <> ", JSON.stringify(result));
        let data = {
            result: [],
            totalCount: 0,
            viewAll: false
        };
        if(result.total && result.total.value > 0){            

            for(const hit of result.hits){
                let data_source = hit._index;
                let cardData = await this.getCardData(data_source, hit._source);
                
                if(data.result.length < MAX_PER_ENTITY){
                    data.result.push(cardData);
                }                    
                data.totalCount++;
                if(data.totalCount > MAX_PER_ENTITY){
                    data.viewAll = true;
                }  
            }
            data.result = matchSorter(data.result, keyword, {keys: ['title'], threshold: matchSorter.rankings.NO_MATCH});

            callback(null, {status: 'success', message: 'Fetched successfully!', data: data });
        }else{
            callback(null, {status: 'success', message: 'No records found!', data: data});
        } 
        
        
        /* let allHits = [];
        let query = null;
        let data = {
            result: [],
            totalCount: 0,
            viewAll: false
        };

        if(entity){
            let entityConfig = entityQueryMapping[entity];
            query = {
                "query_string" : {
                    "query" : `*${decodeURIComponent(keyword)}*`,
                    "fields" : entityConfig.fields,
                    "analyze_wildcard" : true,
                    "allow_leading_wildcard": true
                }
            };
            const result = await elasticService.search(entity, query);
            if(result.total && result.total.value > 0){ 
                allHits = [...allHits, ...result.hits];
            }
        }else{
            for (const [key, value] of Object.entries(entityQueryMapping)) {
                let entityConfig = entityQueryMapping[key];
                query = {
                    "bool": {
                        "must": [
                            {
                                "term": {
                                  "status.keyword": entityConfig.status
                                }
                              },
                          {
                    "query_string" : {
                        "query" : `*${decodeURIComponent(keyword)}*`,
                        "fields" : entityConfig.fields,
                        "analyze_wildcard" : true,
                        "allow_leading_wildcard": true
                    }
                }
            ]
        }
                };
                const result = await elasticService.search(key, query);
                if(result.total && result.total.value > 0){ 
                    allHits = [...allHits, ...result.hits];
                }
            }
        }
        if(allHits.length > 0){            

            for(const hit of allHits){
                let data_source = hit._index;
                
                let entityConfig = entityQueryMapping[data_source];
                if(hit._source.status !== entityConfig.status){
                    console.log("skipping <> ", hit._source.status);
                    //continue;
                }
                let cardData = await this.getCardData(data_source, hit._source);
                
                if(data.result.length < MAX_PER_ENTITY){
                    data.result.push(cardData);
                }                    
                data.totalCount++;
                if(data.totalCount > MAX_PER_ENTITY){
                    data.viewAll = true;
                }  
            }            
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data });
        }else{
            callback(null, {status: 'success', message: 'No records found!', data: data});
        }  */
    }



    async getCardData(data_source, entityData){
        let data = {};
        if(data_source == 'learn-content'){
            data = {
                index: data_source,
                title: entityData.title,
                slug: entityData.slug,
                rating: entityData.average_rating,
                reviews_count: entityData.reviews.length,
                provider: entityData.provider_name
            };
        }else if(data_source == 'provider'){
            data = {
                index: data_source,
                title: entityData.name,
                slug: entityData.slug,
                description: "Institute"
            };
        }else if(data_source == 'article'){
            data = {
                index: data_source,
                title: entityData.title,
                slug: entityData.slug,
                section_name: entityData.section_name,
                section_slug: entityData.section_slug,
                description: "Advice"
            };
        }
        return data;
    }
    


}