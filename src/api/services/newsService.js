const elasticService = require("./elasticService");
const helperService = require("../../utils/helper");
const {getPaginationQuery, formatImageResponse } = require("../utils/general");

const keywordFields = ['name'];


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
        callback(null, {success: true, message: 'Fetched successfully!', data})
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

const generateSingleViewData = async (result, isList = false, currency=process.env.DEFAULT_CURRENCY) =>
{    
    let data = 
    {
        title: result.title,
        slug: result.slug,
        id: result._id,
        cover_image: result.cover_image? result.cover_image :null,
        sidebar_listing_image: result.sidebar_listing_image? result.sidebar_listing_image : null,            
        logo: result.logo? result.logo: null,
        card_image: result.card_image? result.card_image: null,
        card_image_mobile: result.card_image_mobile? result.card_image_mobile: null,
        regions: result.regions? result.regions: null,
        partners: result.partners? result.partners : null,     // check this send obj
        skills: result.skills? result.skills: null,
        categories: result.categories? result.categories: null,
        sub_categories: result.sub_categories? result.categories: null,
        topics: result.topics? result.topics: null,
        section: result.section ? result.section : null,
        author_info: result.author_info,
        type: result.type,
        banner: result.banner? {type: result.banner.type} : null,

    }

  

    if(!isList)
    {
        if(result.course)//custom
        {
            data.course = result.course;
            if(data.course.learn_content.slug)
                data.course.learn_content = await getCourseDetails(data.course.learn_content.slug)
        }
        else
            data.course = {}

        data.summary = result.summary ? result.summary: null; //gen
        data.partners_section = result.partners_section ? result.partners_section : []; //gen

        if(result.author_info && result.authors.length) //common
        {
            let authors = result.authors;

            try{
                let query = { "bool": {"filter": [{"terms": {"id": authors} }]}}

                authors = await elasticService.search('author', query);

            }catch(err) {
                console.log("single view news author fetch err: ",err);
                data.author = [];
            }
            if(authors && authors.hits && authors.hits.length)
            {
                
                data.author = authors.hits.map(hit => {
                    hit = hit._source; 
                    if(hit.image)
                        hit.image = formatImageResponse(hit.image)

                    return {
                            bio: hit.bio? hit.bio: null,
                            designation: hit.designation? hit.designation: null,
                            image: hit.image? hit.image: null,
                            first_name: hit.first_name? hit.first_name: null,
                            last_name: hit.last_name? hit.last_name: null,
                            facebook_url: hit.facebook_url? hit.facebook_url: null,
                            twitter_url: hit.twitter_url? hit.twitter_url: null,
                            linkedin_url: hit.linkedin_url? hit.linkedin_url: null }
                })
            }
        }
        else
            data.author = [];

         
        data.contents = result.contents ? result.contents : null; //common

        data.key_faculties = result.key_faculties ? result.key_faculties: null; //custom

        if(result.banner)  //custom
        {
            data.banner = result.banner;
            if(result.banner.learn_content.slug)
                data.banner.learn_content = await getCourseDetails(result.banner.learn_content.slug);
        }
        else
            data.banner = {}

        if(result.key_takeaways) 
            data.key_takeaways = { title: "Key Takeaways", values: result.key_takeaways}
        else
            data.key_takeaways = [];
    }

    return data;
}

const getCourseDetails = async (courseSlug) =>
{
    
    let lc, data = {}, query = { "bool": { "must": [{ "match": { "slug.keyword": courseSlug } }] }}

    try
    {
        lc = await elasticService.search('learn-content', query, {}, ['title','slug','sale_price','regular_price','course_enrollment_end_date', 'partner_name', 'partner_slug']);
    }
    catch(err) {
        console.log("single view news course fetch err: ", err)
        return data; //empty
    }

    if(lc && lc.hits && lc.hits.length)
    {
        lc = lc.hits[0]._source;
        daysLeft = 9; //hard set, will calc latr
        data = {
            title: lc.title,
            slug: lc.slug,
            partner: lc.partner_name ? lc.partner_name: null,
            enrollmentEndDate: lc.course_enrollment_end_date? lc.course_enrollment_end_date: null,
            daysLeft: daysLeft ? daysLeft : 1,
            regularPrice: lc.regular_price ? lc.regular_price: null,
            salePrice: lc.sale_price ? lc.sale_price: null
        }
    }
    if(lc.partner_slug)
    {
        let partner, query = { "bool": { "must": [{ "match": { "slug.keyword": lc.partner_slug } }] }}

        try
        {
            partner = await elasticService.search('partner', query, {}, ['name','logo']);
        }
        catch(err)
        {
            console.log("single view news partner fetch err: ",err)
            return data; //empty
        }

        if(partner && partner.hits && partner.hits.length)
        {
            partner = partner.hits[0]._source;
            data.partner = {
                name: partner.name,
                slug: lc.partner_slug,
                logo: partner.logo ? formatImageResponse(partner.logo) : null,
            }
        }
    }
    return data;
}

module.exports = {
    getNewsList,
    getNewsBySlug,
}