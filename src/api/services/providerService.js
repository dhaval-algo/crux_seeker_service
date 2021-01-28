const elasticService = require("./elasticService");
const learnContentService = require("./learnContentService");
const fetch = require("node-fetch");
let LearnContentService = new learnContentService();

const { 
    getFilterConfigs, 
    parseQueryFilters,
    round,
    getPaginationQuery,
    getMediaurl,
    updateFilterCount,
    getFilterAttributeName,
    updateSelectedFilters,
    getRankingFilter,
    getRankingBySlug
} = require('../utils/general');

const MAX_RESULT = 10000;
const keywordFields = ['name'];
const filterFields = ['programs','study_modes','institute_types','city','gender_accepted'];



const getAllFilters = async (query, queryPayload, filterConfigs) => {
    //let filters = JSON.parse(JSON.stringify(query.bool.filter));
    //delete query.bool.filter;
    if(queryPayload.from !== null && queryPayload.size !== null){        
        delete queryPayload['from'];
        delete queryPayload['size'];        
    }
    //query['bool']['should'] = filters;
    //query['bool']['minimum_should_match'] = 1;
    const result = await elasticService.search('provider', query, {from: 0, size: MAX_RESULT});
    if(result.total && result.total.value > 0){
        //return formatFilters(result.hits, filterConfigs, query);
        return {
            filters: await formatFilters(result.hits, filterConfigs, query),
            total: result.total.value
        };
    }else{
        //return [];
        let ranking_rilter = await getRankingFilter();
        return {
            filters: [ranking_rilter],
            total: result.total.value
        };
    }
};


const formatFilters = async (data, filterData, query) => {
    let filters = [];
    let emptyOptions = [];
    for(const filter of filterData){

        let formatedFilters = {
            label: filter.label,
            filterable: filter.filterable,
            sortable: filter.sortable,
            order: filter.order,
            is_singleton: filter.is_singleton,
            is_collapsed: filter.is_collapsed,
            display_count: filter.display_count,
            disable_at_zero_count: filter.disable_at_zero_count,
            is_attribute_param: filter.is_attribute_param,
            filter_type: filter.filter_type,
            is_essential: filter.is_essential,
            sort_on: filter.sort_on,
            sort_order: filter.sort_order,
            false_facet_value: filter.false_facet_value,
            implicit_filter_skip: filter.implicit_filter_skip,
            implicit_filter_default_value: filter.implicit_filter_default_value,
            options: (filter.filter_type == "Checkboxes") ? getFilterOption(data, filter)  : [],
        };
        
        if(filter.filter_type !== 'RangeSlider'){
            if(formatedFilters.options.length <= 0){
                emptyOptions.push(filter.label);
            }
        }

        filters.push(formatedFilters);
    }

    if(emptyOptions.length > 0){
        filters = filters.filter(function( obj ) {
            return !emptyOptions.includes(obj.label);
          });
    }

    let ranking_rilter = await getRankingFilter();
    filters.push(ranking_rilter);

    return filters;    
};


const getFilterOption = (data, filter) => {
    let options = [];
    for(const esData of data){
        const entity = esData._source;
        let entityData = entity[filter.elastic_attribute_name];
        if(entityData){
            if(Array.isArray(entityData)){
                for(const entry of entityData){
                    let existing = options.find(o => o.label === entry);
                    if(existing){
                        existing.count++;
                    }else{
                        options.push({
                            label: entry,
                            count: 1,
                            selected: false,
                            disabled: false
                        });
                    }
                }
            }else{
                let existing = options.find(o => o.label === entityData);
                if(existing){
                    existing.count++;
                }else{
                    options.push({
                        label: entityData,
                        count: 1,
                        selected: false,
                        disabled: false
                    });
                }
            }
        }
    }
    return options;
};




module.exports = class providerService {

    async getProviderList(req, callback){
        const filterConfigs = await getFilterConfigs();
        //console.log("filterConfigs <> ", filterConfigs);
        const query = { 
            "bool": {
                "must": [
                    {term: { "status.keyword": 'approved' }}                
                ],
                "filter": []
            }
        };

        if(req.query['rank']){
            query.bool.filter.push({
                "exists" : { "field" : `ranking_${req.query['rank']}` }
            });
        }

        let queryPayload = {};
        let paginationQuery = await getPaginationQuery(req.query);
        queryPayload.from = paginationQuery.from;
        queryPayload.size = paginationQuery.size;

        if(!req.query['sort']){
            if(req.query['rank']){
                req.query['sort'] = "rank:asc";
            }else{
                req.query['sort'] = "name:asc";
            }            
        }

        if(req.query['sort']){
            let sort = req.query['sort'];
            let splitSort = sort.split(":");
            let sortField = splitSort[0];
            
            if((sortField == 'rank') && (req.query['rank'])){
                sort = `ranking_${req.query['rank']}:${splitSort[1]}`;
            }

            if(keywordFields.includes(sortField)){
                sort = `${sortField}.keyword:${splitSort[1]}`;
            }
            queryPayload.sort = [sort];
        }

        let parsedFilters = [];
        let parsedRangeFilters = [];
        let ranking = null;
        let filterQuery = JSON.parse(JSON.stringify(query));
        let filterQueryPayload = JSON.parse(JSON.stringify(queryPayload));
        //let filters = await getAllFilters(filterQuery, filterQueryPayload, filterConfigs);
        let filterResponse = await getAllFilters(filterQuery, filterQueryPayload, filterConfigs); 
        let filters = filterResponse.filters;      
        
        if(req.query['f']){
            parsedFilters = parseQueryFilters(req.query['f']);
            for(const filter of parsedFilters){  
                let elasticAttribute = filterConfigs.find(o => o.label === filter.key);
                if(elasticAttribute){
                    const attribute_name  = getFilterAttributeName(elasticAttribute.elastic_attribute_name, filterFields);
                    query.bool.filter.push({
                        "terms": {[attribute_name]: filter.value}
                    });
                }
            }
        }

        if(req.query['rank']){
            ranking = await getRankingBySlug(req.query['rank']);
            if(ranking){
                parsedFilters.push({
                    key: 'Ranking',
                    value: [ranking.name]
                });
                /* query.bool.filter.push({
                    "exists" : { "field" : `ranking_${req.query['rank']}` }
                }); */
            }            
        }
        
        
        let queryString = null;
        if(req.query['q']){
            query.bool.must.push( 
                {
                    "query_string" : {
                        "query" : `*${decodeURIComponent(req.query['q'])}*`,
                        "fields" : ['name','program_types'],
                        "analyze_wildcard" : true,
                        "allow_leading_wildcard": true
                    }
                }
            );         
        }
        console.log("Final Query <> ", JSON.stringify(query));

        let result = {};

        try{
            result = await elasticService.search('provider', query, queryPayload, queryString);
        }catch(e){
            console.log("Error fetching elastic data <> ", e);
        }

        if(result.total && result.total.value > 0){

            const list = await this.generateListViewData(result.hits, req.query['rank']);

            let pagination = {
                page: paginationQuery.page,
                count: list.length,
                perPage: paginationQuery.size,
                totalCount: result.total.value,
                total: filterResponse.total
            }

            //let filters = await getAllFilters(query, queryPayload, filterConfigs);
            //filters = updateFilterCount(filters, parsedFilters, filterConfigs, result.hits);

            //update selected flags
            if(parsedFilters.length > 0){
                filters = updateFilterCount(filters, parsedFilters, filterConfigs, result.hits);
                filters = updateSelectedFilters(filters, parsedFilters, parsedRangeFilters);
            }

              let data = {
                list: list,
                ranking: ranking,
                filters: filters,
                pagination: pagination,
                sort: req.query['sort']
              };

            
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data});
        }else{
            if(parsedFilters.length > 0){
                filters = updateSelectedFilters(filters, parsedFilters, parsedRangeFilters);
            }
            callback(null, {status: 'success', message: 'No records found!', data: {list: [], ranking: ranking, pagination: {total: filterResponse.total}, filters: filters}});
        }        
    }

    async getProvider(req, callback){
        const slug = req.params.slug;
        const query = { "bool": {
            "must": [
              {term: { "slug.keyword": slug }},
              {term: { "status.keyword": 'approved' }}
            ]
        }};
        const result = await elasticService.search('provider', query);
        if(result.hits && result.hits.length > 0){
            const data = await this.generateSingleViewData(result.hits[0]._source, false, req.query.currency);
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data});
        }else{
            callback({status: 'failed', message: 'Not found!'}, null);
        }        
    }


    async generateListViewData(rows, rank){
        let datas = [];
        for(let row of rows){
            const data = await this.generateSingleViewData(row._source, true, null, rank);
            datas.push(data);
        }
        return datas;
    }



    async generateSingleViewData(result, isList = false, currency=process.env.DEFAULT_CURRENCY, rank = null){
        let coverImageSize = 'small';
        if(isList){
            coverImageSize = 'thumbnail';
        }
        let cover_image = null;
        if(result.cover_image){
            cover_image = getMediaurl(result.cover_image[coverImageSize]);
            if(!cover_image){
                cover_image = getMediaurl(result.cover_image['thumbnail']);
            }
        }

        let courses = {
            list: [],
            total: 0
        };
        if(!isList){
            courses = await this.getProviderCourses(result.name, currency);
        }

        let data = {
            title: result.name,
            slug: result.slug,
            id: `PVDR_${result.id}`,
            cover_video: (result.cover_video) ? getMediaurl(result.cover_video) : null,
            cover_image: cover_image,
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
            alumni: [],
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
            courses: courses,
            course_count: (result.course_count) ? result.course_count : 0
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

        if(result.alumni && result.alumni.length > 0){
            for(let alum of result.alumni){                
                if(!isList){
                    if(alum.photo){
                        alum.photo = getMediaurl(alum.photo.thumbnail);                    
                    }
                    data.alumni.push(alum);
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

        if(rank !== null && result.ranks){
            data.rank = result[`ranking_${rank}`];
            data.rank_details = result.ranks.find(o => o.slug === rank);
        }

        return data;
    }


    async getProviderCourses(provider_name, currency){
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
        queryPayload.size = 4;
        queryPayload.sort = "published_date:desc";

        const result = await elasticService.search('learn-content', query, queryPayload);
        if(result.hits && result.hits.length > 0){
            courses.list = await LearnContentService.generateListViewData(result.hits, currency);
            courses.total = result.total.value;
        }
        return courses;        
    }
    


}