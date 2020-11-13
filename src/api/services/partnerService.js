const elasticService = require("./elasticService");
const fetch = require("node-fetch");

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
        const result = await elasticService.search('partner', query);
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

        let data = {
            name: result.name,
            slug: result.slug,            
            id: `PTNR_${result.id}`,
            introduction: (!isList) ? result.introduction : null,
            usp: (!isList) ? result.usp : null,
            vision: (!isList) ? result.vision : null,
            cover_video: (result.cover_video) ? getMediaurl(result.cover_video) : null,
            cover_image: (result.cover_image) ? getMediaurl(result.cover_image[coverImageSize]) : null,
            embedded_video_url: (result.embedded_video_url) ? embedded_video_url : null,           
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
            twitter_url: result.twitter_url
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
    


}