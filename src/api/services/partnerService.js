const elasticService = require("./elasticService");
const fetch = require("node-fetch");
const learnContentService = require("./learnContentService");
let LearnContentService = new learnContentService();

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
    console.log("query <> ", query);  
    const result = await elasticService.search('learn-content', query, {from: 0, size: MAX_RESULT});
    if(result.total && result.total.value > 0){
        return result.hits;
    }else{
        return [];
    }
};

const getAllCategoryTree = async () => {
    let category_tree = [];
    let response = await fetch(`${apiBackendUrl}/category-tree`);
    if (response.ok) {
        let json = await response.json();
        if(json && json.final_tree){
            category_tree = json.final_tree;
        }
    }
    return category_tree;
};

const getSubCategories = async (partner_name) => {
    let data = await getPartnerCoursesData(partner_name);
    let options = [];
    let others = null;
    for(const esData of data){
        const entity = esData._source;
        let entityData = entity['sub_categories'];
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
        console.log("Final Query <> ", JSON.stringify(query));

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

            
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data});
        }else{
            callback(null, {status: 'success', message: 'No records found!', data: {list: [], pagination: {}, filters: []}});
        }        
    }

    async getPartner(slug, callback){
        const query = { "bool": {
            "must": [
              {term: { "slug.keyword": slug }}
            ]
        }};
        console.log("Single partner query <> ", JSON.stringify(query));
        const result = await elasticService.search('partner', query);
        console.log("result <> ", result);
        if(result.hits && result.hits.length > 0){
            const data = await this.generateSingleViewData(result.hits[0]._source);
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data});
        }else{
            callback({status: 'failed', message: 'Not found!'}, null);
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



    async generateSingleViewData(result, isList = false){
        
        let coverImageSize = 'small';
        if(isList){
            coverImageSize = 'thumbnail';
        }

        let courses = {
            list: [],
            total: 0
        };
        if(!isList){
            courses = await this.getPartnerCourses(result.name);
        }

        let data = {
            name: result.name,
            slug: result.slug,            
            id: `PTNR_${result.id}`,
            introduction: (!isList) ? result.introduction : null,
            usp: (!isList) ? result.usp : null,
            offerings: (!isList) ? result.offerings : null,
            cover_video: (result.cover_video) ? getMediaurl(result.cover_video) : null,
            cover_image: (result.cover_image) ? getMediaurl(result.cover_image[coverImageSize]) : null,
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
            courses: courses,
            user_first_name: result.user_first_name,
            user_last_name: result.user_last_name,
            user_email: result.user_email,
            user_id: result.user_id,
            category_tree: await getCategoryTree(result.name)
        };

        if(result.awards && result.awards.length > 0){
            for(let award of result.awards){                
                if(!isList){
                    if(award.image){
                        award.image = getMediaurl(award.image.thumbnail);                    
                    }
                    data.awards.push(award);
                }
            }
        }

        if(result.education_partners && result.education_partners.length > 0){
            for(let epartner of result.education_partners){                
                if(!isList){
                    if(epartner.logo){
                        epartner.logo = getMediaurl(epartner.logo.thumbnail);                    
                    }
                    data.education_partners.push(epartner);
                }
            }
        } 
        
        if(result.corporate_partners && result.corporate_partners.length > 0){
            for(let cpartner of result.corporate_partners){                
                if(!isList){
                    if(cpartner.logo){
                        cpartner.logo = getMediaurl(cpartner.logo.thumbnail);                    
                    }
                    data.corporate_partners.push(cpartner);
                }
            }
        }       

        return data;
    }


    async getPartnerCourses(partner_name){
        let courses = {
            list: [],
            total: 0
        };
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
            courses.list = await LearnContentService.generateListViewData(result.hits);
            courses.total = result.total.value;
        }
        return courses;        
    }
    


}