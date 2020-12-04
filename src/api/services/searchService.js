const elasticService = require("./elasticService");
const learnContentService = require("./learnContentService");
let LearnContentService = new learnContentService();

const entityQueryMapping = {
    'learn-content': {label: 'Course', status: 'published', fields: ['title','slug','learn_type','categories','sub_categories','topics','provider_name','medium','instruction_type','level','languages','accessibilities','availabilities','pricing_type','finance_option','skills_gained','content','instructors','learnng_mediums','partner_name','skill_tags'], source_fields: ['title']},
    'provider': {label: 'Institute', status: 'approved', fields: ['name','slug','institute_types','programs','program_types','study_modes'], source_fields: ['name','slug']},
    //'article': {label: 'Article', status: 'published', fields: ['title'], source_fields: ['title']}
};

const MAX_PER_ENTITY = 20;

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
            {
              "multi_match": {
                "query": decodeURIComponent(keyword),
                "fields": entityConfig.fields
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
        const keyword = req.params.keyword;
        const entity = req.query.entity;
        const queryEntities = [];
        let sourceFields = [];
        let query = { 
                    "bool": {
                        "should": []
                    }
                };
        if(entity){
            queryEntities.push(entity);
            sourceFields = [...sourceFields, ...entityQueryMapping[entity]['source_fields']];
            const entityQuery = generateEntityQuery(entity, keyword);
            query.bool.should.push(entityQuery);
        }else{
            for (const [key, value] of Object.entries(entityQueryMapping)) {
                queryEntities.push(key);
                sourceFields = [...sourceFields, ...entityQueryMapping[key]['source_fields']];
                const entityQuery = generateEntityQuery(key, keyword);
                query.bool.should.push(entityQuery);
            }
        }

        const uniqueFields = sourceFields.filter(function(item, pos, self) {
            return self.indexOf(item) == pos;
        });
        console.log("Unique Fields <> ", uniqueFields);

        //query['_source'] = uniqueFields;

        console.log("Query <> ", JSON.stringify(query));

        const result = await elasticService.search(queryEntities.join(","), query);
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

                /* let existing = data.find(o => o.index === data_source);
                if(existing){
                    if(existing.result.length < MAX_PER_ENTITY){
                        existing.result.push(cardData);
                    }                    
                    existing.totalResult++;
                    if(existing.totalResult > MAX_PER_ENTITY){
                        existing.viewAll = true;
                    } 
                }else{
                    data.push({
                        label: entityQueryMapping[data_source]['label'],
                        index: data_source,
                        result: [cardData],
                        totalResult: 1,
                        viewAll: false
                    });
                }    */       
            }            
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data });
        }else{
            callback(null, {status: 'success', message: 'No records found!', data: data});
        }        
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
        }
        return data;
    }
    


}