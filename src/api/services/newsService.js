const elasticService = require("./elasticService");
const helperService = require("../../utils/helper");
const {getPaginationQuery, formatImageResponse } = require("../utils/general");

const keywordFields = ['name'];


const getNewsData = async (data) => {
    let newData = [];
    for(let i=0;i<data.length;i++){
        newData.push(data[i]._source);
    }
    return newData;
}


const getNewsBySlug = async (slug, callback) =>
{
    const query = { 
        "bool": {
         "must":[
            { "match": { "slug.keyword": slug}}
          ]
        }
    };
    
    
    let result = null;
    try{
        result = await elasticService.search('news', query);
        
    }catch(e){ console.log('Error while retriving news data',e); }

    if(result && result.hits && result.hits.length > 0)
    {
        let data = await generateSingleViewData(result.hits[0]._source, false)
        callback(null, {success: true, message: 'Fetched successfully!', data});
    }
    else
        return callback(null, { success: false, message: 'News Not found!' });

}


 const getNewsList = async (req, callback) =>{
    const query = { 
        "bool": {
            "must": [],
            "filter": []
        }
    };

    let queryPayload = {};
    let paginationQuery = await getPaginationQuery(req.query);
    queryPayload.from = paginationQuery.from;
    queryPayload.size = paginationQuery.size;

    if(!req.query['sort'])
        req.query['sort'] = "updated_at:desc";

    if(req.query['sort']){
        let sort = req.query['sort'];
        let splitSort = sort.split(":");
        if(keywordFields.includes(splitSort[0]))
            sort = `${splitSort[0]}.keyword:${splitSort[1]}`;
    
        queryPayload.sort = [sort];
    }
    
    let queryString = null;
    if(req.query['q']){
        query.bool.must.push( 
            {
                match: {
                    "name": decodeURIComponent(req.query['q']) //change this ######### 
                }
            }
        );            
    }
    

    const result = await elasticService.search('news', query, queryPayload, queryString);
    if(result.total && result.total.value > 0)
    {

        const list = await generateListViewData(result.hits);

        let pagination = {
            page: paginationQuery.page,
            count: list.length,
            perPage: paginationQuery.size,
            totalCount: result.total.value
        }

          let data = {
            list: list,
            filters: [],
            pagination: pagination,
            sort: req.query['sort']
          };

        
        callback(null, {success: true, message: 'Fetched successfully!', data: data});
    }
    else
        callback(null, {success: true, message: 'No records found!', data: {list: [], pagination: {}, filters: []}});      
}

const generateListViewData = async (rows) =>
{
    let dataArr = [];
    for(let row of rows){
        const data = await generateSingleViewData(row._source, true);
        dataArr.push(data);
    }
    return dataArr;
}

const generateSingleViewData = async (result, isList = false, currency=process.env.DEFAULT_CURRENCY) => {    
    let data = {
        title: result.title,
        slug: result.slug,            
        id: result._id,
        cover_image: (result.cover_image)? formatImageResponse(result.cover_image):null,
        sidebar_listing_image: (result.sidebar_listing_image)? formatImageResponse(result.sidebar_listing_image) : null,            
        logo:(result.logo)? formatImageResponse(result.logo): null,
        regions: result.regions? result.regions: null,
        partners: result.partners? result.partners : null,
        authors: (result.authors && result.author_info) ? result.authors: null,
        skills: result.skills? result.skills: null,
        categories: result.categories? result.categories: null,
        sub_categories: result.sub_categories? result.categories: null,
        topics: result.topics? result.topics: null,
        section: result.section ? result.section : null,
        author_info: result.author_info,
        type: result.type,
        key_faculties: result.key_faculties ? result.key_faculties: null, //custom
        summary: result.summary ? result.summary: null, //gen
    };


    if(!isList){
        data.contents = result.contents? result.contents: [];
        data.banner = result.banner ? result.banner: {};
        data.key_takeaways = result.key_takeaways? result.key_takeaways : [];
        data.course =  result.course ? result.course : {};
        data.partners_section = result.partners_section ? result.partners_section : [];
    }

    return data;
}


module.exports = {
    getNewsList,
    getNewsBySlug,
}