const elasticService = require("./elasticService");
const fetch = require("node-fetch");
const learnContentService = require("./learnContentService");
let LearnContentService = new learnContentService();
const articleService = require("./articleService");
let ArticleService = new articleService();

const categoryService = require("./categoryService");
const CategoryService = new categoryService();

const {generateMetaInfo, formatImageResponse} = require('../utils/general');

const apiBackendUrl = process.env.API_BACKEND_URL;
const rangeFilterTypes = ['RangeSlider','RangeOptions'];
const MAX_RESULT = 10000;
const keywordFields = ['name'];


const round = (value, step) => {
    step || (step = 1.0);
    var inv = 1.0 / step;
    return Math.round(value * inv) / inv;
};

const getPaginationQuery = (query) => {
    let page = 1;
    let size = 25;
    let from = 0;
    if(query['page']){
      page = parseInt(query['page']);
    }
    if(query['size']){
      size = parseInt(query['size']);
    }      
    if(page > 1){
      from = (page-1)*size;
    }
    return {
      from,
      size,
      page
    };
};

const getMediaurl = (mediaUrl) => {
    if(mediaUrl !== null && mediaUrl !== undefined){
        const isRelative = !mediaUrl.match(/(\:|\/\\*\/)/);
        if(isRelative){
            mediaUrl = process.env.ASSET_URL+mediaUrl;
        }
    }    
    return mediaUrl;
};

const getPartnerCoursesData = async (partner_name) => {
    const query = {
        "bool": {
            "must": [
                {term: { "status.keyword": 'published' }},
                {term: { "partner_name.keyword": partner_name }}
            ]
         }
    };
     
    const result = await elasticService.search('learn-content', query, {from: 0, size: MAX_RESULT});
    if(result.total && result.total.value > 0){
        return result.hits;
    }else{
        return [];
    }
};

const getAllCategoryTree = async () => {
    let category_tree = [];
    category_tree = CategoryService.getTreeV2(false) || [];
    return category_tree;
};

const getSubCategories = async (partner_name) => {
    let data = await getPartnerCoursesData(partner_name);
    let options = [];
    let others = null;
    for(const esData of data){
        const entity = esData._source;
        let entityData = entity['sub_categories'];
        if(entityData && entityData.length > 0)
        {
            for(const entry of entityData){
                if(entry == 'Others'){
                    if(others != null){
                        others.count++;
                    }else{
                        others = {
                            label: entry,
                            slug: null,
                            count: 1
                        }
                    }                        
                    continue;
                }

                let existing = options.find(o => o.label === entry);
                if(existing){
                    existing.count++;
                }else{
                    options.push({
                        label: entry,
                        slug: null,
                        count: 1
                    });
                }
            }
        }
    }
    if(others != null){
        options.push(others);
    }
    return options;
};

const getCategoryTree = async (partner_name) => {
    const tree = [];
    const subCategories = await getSubCategories(partner_name);
    const allCategories = await getAllCategoryTree();

    for(const cat of allCategories){
        const category = {
            label: cat.label,
            slug: cat.slug,
            count: 0,
            child: []
        };
        for(const subcat of cat.child){
            let ex_subcat = subCategories.find(o => o.label === subcat.label);
            if(ex_subcat){
                ex_subcat.slug = subcat.slug;
                category.child.push(ex_subcat);
                category.count++;
            }
        }
        if(category.child.length > 0){
            tree.push(category);
        }
    }    
    return tree;
};





module.exports = class partnerService {

    async getPartnerList(req, callback){
        const query = { 
            "bool": {
                //"should": [],
                "must": [],
                "filter": []
            }
        };

        let queryPayload = {};
        let paginationQuery = await getPaginationQuery(req.query);
        queryPayload.from = paginationQuery.from;
        queryPayload.size = paginationQuery.size;

        if(!req.query['sort']){
            req.query['sort'] = "name:asc";
        }

        if(req.query['sort']){
            let sort = req.query['sort'];
            let splitSort = sort.split(":");
            if(keywordFields.includes(splitSort[0])){
                sort = `${splitSort[0]}.keyword:${splitSort[1]}`;
            }
            queryPayload.sort = [sort];
        }
        
        let queryString = null;
        if(req.query['q']){
            query.bool.must.push( 
                {
                    match: {
                        "name": decodeURIComponent(req.query['q'])
                    }
                }
            );            
        }
        

        const result = await elasticService.search('partner', query, queryPayload, queryString);
        if(result.total && result.total.value > 0){

            const list = await this.generateListViewData(result.hits);

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
        }else{
            callback(null, {success: true, message: 'No records found!', data: {list: [], pagination: {}, filters: []}});
        }        
    }

    async getPartner(req, callback){
        try {   
       
            const slug = req.params.slug;
            const query = { "bool": {
                "must": [
                {term: { "slug.keyword": slug }}
                ]
            }};
            
            const result = await elasticService.search('partner', query);
            //console.log("result <> ", result);
            if(result.hits && result.hits.length > 0){
                const data = await this.generateSingleViewData(result.hits[0]._source, false, req.query.currency);
                callback(null, {success: true, message: 'Fetched successfully!', data: data});
            }else{
                /***
                 * We are checking slug and checking(from the strapi backend APIs) if not there in the replacement.
                 */
                let response = await fetch(`${apiBackendUrl}/url-redirections?old_url_eq=${slug}`);
                if (response.ok) {
                    let urls = await response.json();
                    if(urls.length > 0){  
                        let slug = urls[0].new_url
                        return callback({success: false,slug:slug, message: 'Redirect!'}, null);
                    }else{
                        return callback({success: false, message: 'Not found!'}, null);
                    }
                }
                callback({success: false, message: 'Not found!'}, null);
            }  
        } catch (error) {
                console.log("partner erorr!!!!!!!!!!!!!!", error)
                callback({success: false, message: 'Not found!'}, null);
        }      
    }


    async generateListViewData(rows){
        let datas = [];
        for(let row of rows){
            const data = await this.generateSingleViewData(row._source, true);
            datas.push(data);
        }
        return datas;
    }



    async generateSingleViewData(result, isList = false, currency=process.env.DEFAULT_CURRENCY){       


       

        let articles = {
            list: [],
            total: 0
        };
 
        if(!isList){
            
            articles = await this.getPartnerArticles(result.id);
                        
        }
        
        let data = {
            name: result.name,
            slug: result.slug,            
            id: `PTNR_${result.id}`,
            short_description: result.short_description || null,
            introduction: (!isList) ? result.introduction : null,
            usp: (!isList) ? result.usp : null,
            offerings: (!isList) ? result.offerings : null,
            cover_video: (result.cover_video) ? getMediaurl(result.cover_video) : null,
            cover_image: (result.cover_image)? formatImageResponse(result.cover_image):null,
            embedded_video_url: (result.embedded_video_url) ? result.embedded_video_url : null,           
            establishment_year: result.establishment_year,
            corporate_partners: [],
            education_partners: [],
            awards: [],            
            contact_details: {
                address_line1: result.address_line1,
                address_line2: result.address_line2,
                city: result.city,
                state: result.state,
                pincode: result.pincode,
                country: result.country,
                phone: result.phone,
                email: result.email,
                website_link: result.website_link
            },
            linkedin_url: result.linkedin_url,
            facebook_url: result.facebook_url,
            twitter_url: result.twitter_url,
            articles:articles,
            user_first_name: result.user_first_name,
            user_last_name: result.user_last_name,
            user_email: result.user_email,
            user_id: result.user_id,
            category_tree: await getCategoryTree(result.name),
            gallery: (result.gallery)? (result.gallery).map(image =>formatImageResponse(image) ) : null,
            vision: (result.vision)? result.vision : null,
            mission: (result.mission)? result.mission : null,
            partner_universities: [],
            accreditations: [],
            report: (result.report)? result.report : null,
            highlights: (result.highlights)? result.highlights : null,
            facts: (result.facts)? result.facts : null
        };
        if(!isList){
            // get course count 

            let esQuery = {
                "bool": {
                    "filter": [
                        { "term": { "status.keyword": "published" } },
                        {"term": { "partner_name.keyword": result.name }}
                    ]
                }
            }
        
            // Get total count of course
            let course_count = await elasticService.count("learn-content", {"query": esQuery});
            if(course_count)
            {
                data.course_count = course_count.count
                if(data.highlights)
                {
                    data.highlights.course_count = course_count.count
                }
            }
            
            let meta_information = await generateMetaInfo  ('partner', result);
            if(meta_information)
            {
                data.meta_information  = meta_information;
            }
        }
         
        if (result.accreditations && result.accreditations.length > 0) {
            for (let accreditations of result.accreditations) {
                if (!isList) {
                    if (accreditations.logo) {
                        accreditations.logo = formatImageResponse(accreditations.logo);
                    }
                    data.accreditations.push(accreditations);
                }
            }
        }
        if (result.partner_universities && result.partner_universities.length > 0) {
            for (let partner_universities of result.partner_universities) {
                if (!isList) {
                    if (partner_universities.logo) {
                        partner_universities.logo = formatImageResponse(partner_universities.logo);
                    }
                    data.partner_universities.push(partner_universities);
                }
            }
        }

        if (result.awards && result.awards.length > 0) {
            for (let award of result.awards) {
                if (!isList) {
                    if (award.image) {
                        award.image = formatImageResponse(award.image);
                    }
                    data.awards.push(award);
                }
            }
        }

        if(result.education_partners && result.education_partners.length > 0){
            for(let epartner of result.education_partners){                
                if(!isList){
                    if(epartner.logo){
                        epartner.logo = formatImageResponse( epartner.logo);                 
                    }
                    data.education_partners.push(epartner);
                }
            }
        } 
        
        if(result.corporate_partners && result.corporate_partners.length > 0){
            for(let cpartner of result.corporate_partners){                
                if(!isList){
                    if(cpartner.logo){
                        cpartner.logo = formatImageResponse( cpartner.logo);  ;                    
                    }
                    data.corporate_partners.push(cpartner);
                }
            }
        }       

        return data;
    }


    async getPartnerCourses(partner_name, currency){
        let courses = {
            list: [],
            total: 0
        };
        try {
            const query = {
                "bool": {
                    "must": [
                        {term: { "status.keyword": 'published' }},
                        {term: { "partner_name.keyword": partner_name }}
                    ]
                 }
            };
    
            let queryPayload = {};
            queryPayload.from = 0;
            queryPayload.size = 4;
            queryPayload.sort = "published_date:desc";
    
            const result = await elasticService.search('learn-content', query, queryPayload);
            if(result.hits && result.hits.length > 0){
                courses.list = await LearnContentService.generateListViewData(result.hits, currency);
                courses.total = result.total.value;
            }
        } catch (error) {
            console.log("error in fetching partner courses",error)
        }
       
        return courses;        
    }

    async getPartnerArticles(partners ){
        let articles = {
            list: [],
            total: 0
        };
        try {
            const query = {
                "bool": {
                    "must": [
                        {term: { "status.keyword": 'published' }},
                        {term: { "partners": partners}}
                    ]
                 }
            };
    
            let queryPayload = {};
            // queryPayload.from = 0;
            // queryPayload.size = 4;
            queryPayload.sort = "published_date:desc";
            const result = await elasticService.search('article', query, queryPayload);
            if(result.hits && result.hits.length > 0){
                articles.list = await ArticleService.generateListViewData(result.hits);
                articles.total = result.total.value;
            }
        } catch (error) {
            console.log("error in fetching partner articles",error)
        }
       
        return articles;        
    }
    


}