const elasticService = require("./elasticService");
const learnContentService = require("./learnContentService");
const fetch = require("node-fetch");
let LearnContentService = new learnContentService();

const apiBackendUrl = process.env.API_BACKEND_URL;
const rangeFilterTypes = ['RangeSlider','RangeOptions'];
const MAX_RESULT = 10000;
const keywordFields = ['title'];

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


module.exports = class providerService {

    async getProviderList(req, callback){
        const query = { 
            "bool": {
                //"should": [],
                "must": [
                    {term: { "status.keyword": 'approved' }}                
                ],
                "filter": []
            }
        };

        let queryPayload = {};
        let paginationQuery = await getPaginationQuery(req.query);
        queryPayload.from = paginationQuery.from;
        queryPayload.size = paginationQuery.size;
        console.log("paginationQuery <> ", paginationQuery);

        if(!req.query['sort']){
            req.query['sort'] = "created_at:desc";
        }

        if(req.query['sort']){
            console.log("Sort requested <> ", req.query['sort']);
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
                        "title": decodeURIComponent(req.query['q'])
                    }
                }
            );            
        }
        console.log("Final Query <> ", JSON.stringify(query));

        const result = await elasticService.search('provider', query, queryPayload, queryString);
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

    async getProvider(slug, callback){
        const query = { "bool": {
            "must": [
              {term: { "slug.keyword": slug }},
              {term: { "status.keyword": 'approved' }}
            ]
        }};
        const result = await elasticService.search('provider', query);
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
            courses = await this.getProviderCourses(result.name);
        }

        let data = {
            title: result.name,
            slug: result.slug,
            id: `PVDR_${result.id}`,
            cover_video: (result.cover_video) ? getMediaurl(result.cover_video) : null,
            cover_image: (result.cover_image) ? getMediaurl(result.cover_image[coverImageSize]) : null,
            embedded_video_url: (result.embedded_video_url) ? result.embedded_video_url : null,
            overview: result.overview,
            programs: (result.programs) ? result.programs : [],
            institute_types: (result.institute_types) ? result.institute_types : [],
            currency: result.currency,
            facilities: result.facilities,
            gender_accepted: result.gender_accepted,
            establishment_year: result.establishment_year,
            study_modes: (result.study_modes) ? result.study_modes : [],
            program_types: (result.program_types) ? result.program_types : [],

            
            reviews: [],
            ratings: {
                total_review_count: result.reviews ? result.reviews.length : 0,
                average_rating: 0,
                average_rating_actual: 0,
                rating_distribution: []
            },
            accreditations: [],
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
            courses: courses
        };

        if(!isList){
            data.meta_information = {
                student_educational_background_diversity: result.student_educational_background_diversity,
                student_nationality_diversity: result.student_nationality_diversity,
                student_gender_diversity: result.student_gender_diversity,
                student_avg_experience_diversity: result.student_avg_experience_diversity,
                highest_package_offered: result.highest_package_offered,
                median_package_offered: result.median_package_offered
            }
        }

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

        if(result.accreditations && result.accreditations.length > 0){
            for(let accr of result.accreditations){                
                if(!isList){
                    if(accr.logo){
                        accr.logo = getMediaurl(accr.logo.thumbnail);                    
                    }
                    data.accreditations.push(accr);
                }
            }
        }
        
        if(result.reviews && result.reviews.length > 0){
            let totalRating = 0;
            let ratings = {};
            for(let review of result.reviews){
                totalRating += review.rating;
                
                if(!isList){
                    if(review.photo){
                        review.photo = getMediaurl(review.photo.thumbnail);                    
                    }
                    data.reviews.push(review);
                }

                if(ratings[review.rating]){
                    ratings[review.rating] += 1; 
                }else{
                    ratings[review.rating] = 1; 
                }
            }

            const average_rating = totalRating/result.reviews.length;            
            data.ratings.average_rating = round(average_rating, 0.5);
            data.ratings.average_rating_actual = average_rating.toFixed(1);            
            let rating_distribution = [];           

            //add missing ratings
            for(let i=0; i<5; i++){
                if(!ratings[i+1]){
                    ratings[i+1] = 0;
                }                
            }
            Object.keys(ratings)
            .sort()
            .forEach(function(v, i) {
                rating_distribution.push({
                    rating: v,
                    percent: Math.round((ratings[v] * 100) / result.reviews.length)
                });
            });
            data.ratings.rating_distribution = rating_distribution.reverse();
        } 

        return data;
    }


    async getProviderCourses(provider_name){
        let courses = {
            list: [],
            total: 0
        };
        const query = {
            "bool": {
                "must": [
                    {term: { "status.keyword": 'published' }},
                    {term: { "provider_name.keyword": provider_name }}
                ]
             }
        };

        let queryPayload = {};
        queryPayload.from = 0;
        queryPayload.size = 3;
        queryPayload.sort = "published_date:desc";

        const result = await elasticService.search('learn-content', query, queryPayload);
        if(result.hits && result.hits.length > 0){
            courses.list = await LearnContentService.generateListViewData(result.hits);
            courses.total = result.total.value;
        }else{
            callback({status: 'failed', message: 'Not found!'}, null);
        }
        return courses;        
    }
    


}