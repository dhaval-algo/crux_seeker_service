const elasticService = require("./elasticService");
const searchTemplates = require("../../utils/searchTemplates");


const MAX_COURSES = 10;
const MAX_LEARN_PATHS = 6;
const MAX_ARTICLES = 4;
const MAX_PROVIDERS = 3;
const MAX_PER_ENTITY = 23;

module.exports = class searchService {
    async getSearchResult(req, callback){
        try{
        const query = decodeURIComponent(req.params.keyword).trim();
        const userId = (req.user && req.user.userId)?req.user.userId:req.segmentId;
        const entity = req.query.entity;
        const result = [];
        
        if(!entity || (entity == 'all')){
            const courseSearchTemplate = await searchTemplates.getCourseSearchTemplate(query,userId);
            const learnPathSearchTemplate = searchTemplates.getLearnPathSearchTemplate(query);
            const articleSearchTemplate = searchTemplates.getArticleSearchTemplate(query);
            const providerSearchTemplate = searchTemplates.getProviderSearchTemplate(query);

            const courses = await elasticService.search('learn-content', courseSearchTemplate, {from: 0, size: MAX_COURSES},['title','slug','reviews','provider_name','average_rating']);
            const learnPaths = await elasticService.search('learn-path', learnPathSearchTemplate, {from: 0, size: MAX_LEARN_PATHS},['title','slug','reviews','provider_name','average_rating']);
            const articles = await elasticService.search('article', articleSearchTemplate, {from: 0, size: MAX_ARTICLES},['title','slug','section_name','section_slug']);
            const providers = await elasticService.search('provider', providerSearchTemplate, {from: 0, size: MAX_PROVIDERS},['name','slug']);
            
            if(courses && courses.total && courses.total.value) result.push(...courses.hits);
            if(learnPaths && learnPaths.total && learnPaths.total.value) result.push(...learnPaths.hits);
            if(articles && articles.total && articles.total.value) result.push(...articles.hits);
            if(providers && providers.total && providers.total.value) result.push(...providers.hits);
                      
        }else{

     
        }

        let data = {
            result: [],
            totalCount: 0,
            viewAll: false
        };
        if(result.length){            

            for(const hit of result){
                
                let data_source = hit._index;
                let cardData = await this.getCardData(data_source, hit._source);
                data.result.push(cardData);
                                 
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
        console.log("Error Occured while Searching",error);
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
                reviews_count: entityData.reviews.length
                
                
            };
        }
        else if(data_source == 'provider' || data_source=='provider-v3'){
            data = {
                index: 'provider',
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