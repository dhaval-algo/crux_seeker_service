const elasticService = require("./elasticService");

const helperService = require("../../utils/helper");
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();

const {formatImageResponse} = require('../utils/general');
const {generateMetaInfo} = require('../utils/metaInfo');

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
                let redirectUrl = await helperService.getRedirectUrl(req);
                if (redirectUrl) {
                    return callback(null, { success: false, redirectUrl: redirectUrl, message: 'Redirect' });
                }
                return callback(null, { success: false, message: 'Not found!' });
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
        let data = {
            name: result.name,
            slug: result.slug,            
            id: `PTNR_${result.id}`,
            short_description: result.short_description || null,
            introduction: (!isList) ? result.introduction : null,
            usp: (!isList) ? result.usp : null,
            offerings: (!isList) ? result.offerings : null,
            cover_video: (result.cover_video) ? getMediaurl(result.cover_video) : ((result.embedded_video_url) ? result.embedded_video_url : null),
            cover_image: (result.cover_image)? formatImageResponse(result.cover_image):null,
            sidebar_listing_image: (result.listing_image)? formatImageResponse(result.listing_image) : ((result.cover_image)? formatImageResponse(result.cover_image) : null),            
            logo:(result.logo)? formatImageResponse(result.logo): null,
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
            user_first_name: result.user_first_name,
            user_last_name: result.user_last_name,
            user_email: result.user_email,
            user_id: result.user_id,
            category_tree: null,
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
            
            let meta_information = await generateMetaInfo  ('PARTNER', result);
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


    async cachePartnersCourseImages(){

        try {

            const query = {
                bool: {
                    "must": [{ "exists": {"field": "desktop_course_image"} }]
                }
            };
            
            const result = await elasticService.search('partner', query, {size:2000}, ["slug","mobile_course_image", "desktop_course_image", "logo"]);

            if(result.hits && result.hits.length > 0){
                for(let h of result.hits)
                {
                    h._source.logo = formatImageResponse(h._source.logo);
                    RedisConnection.set("partner-course-image-" + h._source.slug, h._source);

                }
            }
        } catch (error) {
                console.log("partner course image caching error", error)
        }

    }
}