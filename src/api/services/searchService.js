const mSorter = require("match-sorter");
let {matchSorter} = mSorter;
const elasticService = require("./elasticService");
const learnContentService = require("./learnContentService");
let LearnContentService = new learnContentService();

const entityQueryMapping = {
    'learn-content': { label: 'Course', status: 'published', prefix_field: "title", fuzziness_fields: [ "title^8","skills^7","topics^6","what_will_learn^5","categories^5","sub_categories^4","provider_name^3","level^2","medium"], fields: ["title^10", "skills^9", "topics^8", "what_will_learn^7", "categories^6", "sub_categories^5", "provider_name^4","description^3","level^2","medium"], source_fields: ['title']},
    'learn-path': { label: 'Learn Path', status: 'approved', prefix_field: "title", fuzziness_fields: ["title^13.5","courses.title^12","topics^10","categories^8","sub_categories^6"], fields: ["title^13.5","courses.title^12","topics^10","categories^8","sub_categories^6","description^4"], source_fields: ['title'] },
    'provider': { label: 'Institute', status: 'approved', prefix_field: "name", fuzziness_fields: ["name^7"], fields: ['name^7'], source_fields: ['name', 'slug'] },
    'article': { label: 'Article', status: 'published', prefix_field: "title", fuzziness_fields: ["title^14","article_skills^13","article_topics^12","categories^10","article_sub_categories^8"], fields: ["title^14.5","article_skills^13","article_topics^12","categories^10","article_sub_categories^8","content^4"], source_fields: ['title', 'slug', 'section_name', 'section_slug'] }
};

const MAX_PER_ENTITY = 20;
const MAX_RESULT = 30;

const generateEntityQuery = (entity, keyword) => {
    const entityConfig = entityQueryMapping[entity];
    const entity_query = {
        bool: {
            must: [
                {
                    term: {
                        "status.keyword": entityConfig.status
                    }
                },
                {
                    term: {
                        _index: entity
                    }
                }
                
            ],
            should: [
                {
                    multi_match: {
                        query: decodeURIComponent(keyword).trim(),
                        type: "bool_prefix",
                        boost: 50,
                        fields: [
                            entityConfig.prefix_field
                        ]
                    }
                },
                {
                    match_phrase_prefix: {
                        [entityConfig.prefix_field]: {
                            query: decodeURIComponent(keyword).trim(),
                            boost: 30
                        }
                    }
                },
                {
                    multi_match: {
                        fields: entityConfig.fields,
                        query: decodeURIComponent(keyword).trim(),
                        boost: 35
                    }
                },
                {
                    multi_match: {
                        fields: entityConfig.fuzziness_fields,
                        query: decodeURIComponent(keyword).trim(),
                        fuzziness: "AUTO",
                        prefix_length: 0,
                        boost: 5
                    }
                }
            ]

        }
    };
    return entity_query;
};

module.exports = class searchService {
    async getSearchResult(req, callback){
        try{
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
       
        const result = await elasticService.search(queryEntities.join(","), query, {from: 0, size: MAX_RESULT});
        
        
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
          //  data.result = matchSorter(data.result, keyword, {keys: ['title'], threshold: matchSorter.rankings.NO_MATCH});

            callback(null, {status: 'success', message: 'Fetched successfully!', data: data });
        }else{
            callback(null, {status: 'success', message: 'No records found!', data: data});
        } 
        
     

    }catch(error){
        callback(null, {status: 'success', message: 'No records found!', data:{}});
    }
         
    }



    async getCardData(data_source, entityData){
        let data = {};
        if(data_source == 'learn-content' || data_source.includes("learn-content-v")){
            data = {
                index: "learn-content",
                title: entityData.title,
                slug: entityData.slug,
                rating: entityData.average_rating,
                reviews_count: entityData.reviews.length,
                provider: entityData.provider_name
            };
        }else if(data_source == 'learn-path'){
            data = {
                index: "learn-path",
                title: entityData.title,
                slug: entityData.slug,
                rating: entityData.average_rating,
                reviews_count: entityData.reviews.length,
                image: entityData.images,
                courses_count: entityData.courses.length
            };
        }
        else if(data_source == 'provider'){
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