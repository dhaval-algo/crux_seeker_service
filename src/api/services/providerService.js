const elasticService = require("./elasticService");
const learnContentService = require("./learnContentService");
const fetch = require("node-fetch");
const apiBackendUrl = process.env.API_BACKEND_URL;
const _ = require('underscore');
let LearnContentService = new learnContentService();
const helperService = require("../../utils/helper");
const { 
    getFilterConfigs, 
    parseQueryFilters,
    round,
    getPaginationQuery,
    getMediaurl,
    updateFilterCount,
    calculateFilterCount,
    getFilterAttributeName,
    updateSelectedFilters,
    getRankingFilter,
    getRankingBySlug,
    sortFilterOptions,    
    formatImageResponse
} = require('../utils/general');
const {generateMetaInfo} = require('../utils/metaInfo');

const redisConnection = require('../../services/v1/redis');

const RedisConnection = new redisConnection();

const MAX_RESULT = 10000;
const keywordFields = ['name'];
const filterFields = ['programs','study_modes','institute_types','city','gender_accepted', 'region', 'country', 'state'];
const allowZeroCountFields = ['programs','study_modes'];
const FEATURED_RANK_LIMIT = 2;

const sortOptions = {
    'A-Z': ["name:asc"],
    'Z-A' :["name:desc"],
    'Most Relevant' : []
}

const ranksortOptions = {
    'High To Low': "rank:asc",
    'Low To High': "rank:desc",
    'A-Z': "name:asc",
    'Z-A' :"name:desc",
}




const getAllFilters = async (query, queryPayload, filterConfigs) => {
    //let filters = JSON.parse(JSON.stringify(query.bool.filter));
    //delete query.bool.filter;
    if(queryPayload.from !== null && queryPayload.size !== null){        
        delete queryPayload['from'];
        delete queryPayload['size'];        
    }
    //query['bool']['should'] = filters;
    //query['bool']['minimum_should_match'] = 1;

    let fields = filterConfigs.map((filter)=> filter.elastic_attribute_name);

    const result = await elasticService.search('provider', query, {from: 0, size: MAX_RESULT},fields);
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
            field: filter.elastic_attribute_name,
            filterable: filter.filterable,
            sortable: filter.sortable,
            filter_postion: filter.filter_postion || 'vertical',            
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
    options = sortFilterOptions(options);
    return options;
};




module.exports = class providerService {

    async getProviderList(req, callback, skipCache){
        let useCache = false;
        let defaultSort = (req.query['q']) ? 'Most Relevant':'A-Z';
        let cacheName = "";
        if(
            req.query['instituteIds'] == undefined
            && req.query['f'] == undefined
            && (req.query['q'] == undefined || req.query['q'] == '')
            && req.query['rank'] == undefined
            && (
                req.query['size'] == undefined
                || req.query['size'] == defaultSize
            )
            && (
                req.query['sort'] == undefined
                || req.query['sort'] == defaultSort
            )
            && (
                req.query['page'] == undefined || req.query['page'] == 1 ||  req.query['page'] == ""
            )
        ) 
        {
            useCache = true;
            cacheName = `listing-providers_${defaultSort}`;
            if(skipCache != true) {
                let cacheData = await RedisConnection.getValuesSync(cacheName);
                if(cacheData.noCacheData != true) {
                    return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
                }
            }
        }
        const filterConfigs = await getFilterConfigs('Provider');
        //console.log("filterConfigs <> ", filterConfigs);
        const query = { 
            "bool": {
                "must": [
                    {term: { "status.keyword": 'approved' }}                
                ],
                //"filter": []
            }
        };

        if(req.query['rank']){
            /* query.bool.filter.push({
                "exists" : { "field" : `ranking_${req.query['rank']}` }
            }); */
            query.bool.must.push({
                "exists" : { "field" : `ranking_${req.query['rank']}` }
            });
        }

        let queryPayload = {};
        let paginationQuery = await getPaginationQuery(req.query);
        queryPayload.from = paginationQuery.from;
        queryPayload.size = paginationQuery.size;

        if(!req.query['sort']){
            if(req.query['rank']){
                req.query['sort'] = "High To Low";
            }else{
                req.query['sort'] = defaultSort;
            }            
        }

        if(req.query['sort']){
            queryPayload.sort = []
           
            if(req.query['rank']){
                let sort = ranksortOptions[req.query['sort']];
                let splitSort = sort.split(":");
                 let sortField = splitSort[0];            
                if((sortField == 'rank') && (req.query['rank'])){
                    sort = `ranking_${req.query['rank']}:${splitSort[1]}`;
                }
                if(keywordFields.includes(splitSort[0])){
                    sort = `${splitSort[0]}.keyword:${splitSort[1]}`;
                }
                queryPayload.sort.push(sort)
             }
             else{
                let sort = sortOptions[req.query['sort']];
                let keywordFields = ['name']
                if (sort && sort.length > 0) {
                    for (let field of sort) {

                        let splitSort = field.split(":");
                        if (keywordFields.includes(splitSort[0])) {
                            field = `${splitSort[0]}.keyword:${splitSort[1]}`;
                        }
                        queryPayload.sort.push(field)
                    }
                }
            }
        }

        if(req.query['instituteIds']){
            let instituteIds = req.query['instituteIds'].split(",");
            
            query.bool.must.push(
                {
                    "terms": {
                      "id": instituteIds 
                    }
                }
            )
        }

        if(req.query['q']){
            query.bool.must.push( 
                {                    
                "bool": {
                    "should": [
                        {
                            "query_string" : {
                                "query" : `*${decodeURIComponent(req.query['q']).trim()}*`,
                                "fields" : ['name^2','programs'],
                                "analyze_wildcard" : true,
                                "allow_leading_wildcard": true
                            }
                        },
                        {
                            "multi_match": {
                                "fields":  ['name^2','programs'],
                                "query": decodeURIComponent(req.query['q']).trim(),
                                "fuzziness": "AUTO",
                                "prefix_length": 0                              
                            }
                        }           
                    ]
                    }                    
                }
            );         
        }
        
        let parsedFilters = [];
        let parsedRangeFilters = [];
        let ranking = null;
        
        let filterQuery = JSON.parse(JSON.stringify(query));
        let filterQueryPayload = JSON.parse(JSON.stringify(queryPayload));
        let filterResponse = await getAllFilters(filterQuery, filterQueryPayload, filterConfigs); 
        let filters = filterResponse.filters;      
        
        if(req.query['f']){
            parsedFilters = parseQueryFilters(req.query['f']);
            for(const filter of parsedFilters){  
                let elasticAttribute = filterConfigs.find(o => o.label === filter.key);
                if(elasticAttribute){
                    const attribute_name  = getFilterAttributeName(elasticAttribute.elastic_attribute_name, filterFields);
                    /* query.bool.filter.push({
                        "terms": {[attribute_name]: filter.value}
                    }); */
                    /* query.bool.must.push({
                        "terms": {[attribute_name]: filter.value}
                    }); */
                    // for(const fieldValue of filter.value){
                    //     query.bool.must.push({
                    //         "term": {[attribute_name]: fieldValue}
                    //     });
                    // }

                    query.bool.must.push({
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

        /* let filterQuery = JSON.parse(JSON.stringify(query));
        let filterQueryPayload = JSON.parse(JSON.stringify(queryPayload));
        let filterResponse = await getAllFilters(filterQuery, filterQueryPayload, filterConfigs); 
        let filters = filterResponse.filters; */  

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
                //filters = updateFilterCount(filters, parsedFilters, filterConfigs, result.hits, allowZeroCountFields);
                filters = await calculateFilterCount(filters, parsedFilters, filterConfigs, 'provider', result.hits, filterResponse.total, query, allowZeroCountFields);
                filters = updateSelectedFilters(filters, parsedFilters, parsedRangeFilters);
            }

            let data = {
                list: list,
                ranking: ranking,
                filters: filters,
                pagination: pagination,
                sort: req.query['sort'],
                sortOptions:(req.query['rank']) ? Object.keys(ranksortOptions) :  Object.keys(sortOptions)
            };

            let meta_information = await generateMetaInfo  ('PROVIDER_LIST', result, list);
            if(meta_information)
            {
                data.meta_information  = meta_information;
            }

            if(useCache) {
               RedisConnection.set(cacheName, data);
               RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_LISTING_PROVIDER); 
            }
            callback(null, {success: true, message: 'Fetched successfully!', data: data});
        }else{
            if(parsedFilters.length > 0){
                
                //filters = updateFilterCount(filters, parsedFilters, filterConfigs, result.hits, allowZeroCountFields);
                filters = await calculateFilterCount(filters, parsedFilters, filterConfigs, 'provider', result.hits, filterResponse.total, query, allowZeroCountFields);
                filters = updateSelectedFilters(filters, parsedFilters, parsedRangeFilters);
            }
            callback(null, {success: true, message: 'No records found!', data: {list: [], ranking: ranking, pagination: {total: filterResponse.total}, filters: filters}});
        }        
    }

    async getProvider(req, callback, skipCache){
        const slug = req.params.slug;
        let providerId = null
        let cacheName = `single-provider-${slug}_${req.query.currency}`
        let useCache = false
        if(skipCache !=true) {
            let cacheData = await RedisConnection.getValuesSync(cacheName);
            if(cacheData.noCacheData != true) {
                callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
                useCache = true
                providerId = cacheData.id
            }            
        }
        if(useCache !=true)
        {
            const query = { "bool": {
                "must": [
                {term: { "slug.keyword": slug }},
                {term: { "status.keyword": 'approved' }}
                ]
            }};
            const result = await elasticService.search('provider', query);
            if(result.hits && result.hits.length > 0){
                const data = await this.generateSingleViewData(result.hits[0]._source, false, req.query.currency);
                RedisConnection.set(cacheName, data);
                RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_SINGLE_PROVIDER); 
                callback(null, {success: true, message: 'Fetched successfully!', data: data});
                providerId = data.id
            }else{
                /***
                 * We are checking slug and checking(from the strapi backend APIs) if not there in the replacement.
                 */
                let response = await fetch(`${apiBackendUrl}/url-redirections?old_url_eq=${slug}`);
                if (response.ok) {
                    let urls = await response.json();
                    if(urls.length > 0){  
                        let slug = urls[0].new_url
                        return callback({success: false,slug:slug, message: 'Redirect'}, null);
                    }else{
                        return callback({success: false, message: 'Not found!'}, null);
                    }
                }
                callback({success: false, message: 'Not found!'}, null);
            }
        }
        req.body = {providerId: providerId}
        this.addActivity(req)      
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

        let data = {
            title: result.name,
            slug: result.slug,
            id: `PVDR_${result.id}`,
            cover_video: (result.cover_video) ? getMediaurl(result.cover_video) : ((result.embedded_video_url) ? result.embedded_video_url : null),
            cover_image: (result.cover_image)? formatImageResponse(result.cover_image):null,
            card_image:(result.card_image)? formatImageResponse(result.card_image) : ((result.cover_image)? formatImageResponse(result.cover_image) : null),
            card_image_mobile:(result.card_image_mobile)? formatImageResponse(result.card_image_mobile) : ((result.cover_image)? formatImageResponse(result.cover_image) : null),
            logo:(result.logo)? formatImageResponse(result.logo):null,
            embedded_video_url: (result.embedded_video_url) ? result.embedded_video_url : null,
            overview: result.overview,
            programs: (result.programs) ? result.programs : [],
            institute_types: (result.institute_types) ? result.institute_types : [],
            currency: result.currency,
            gender_accepted: result.gender_accepted,
          //  establishment_year: result.establishment_year,
            study_modes: (result.study_modes) ? result.study_modes : [],
           // program_types: (result.program_types) ? result.program_types : [],

            
            reviews: [],
            ratings: {
                total_review_count: result.reviews ? result.reviews.length : 0,
                average_rating: 0,
                average_rating_actual: 0,
                rating_distribution: []
            },
            accreditations: [],
            awards: [],
          //  alumni: [],
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
            course_count: (result.course_count) ? result.course_count : 0,
            featured_ranks: [],
            placements: {},
            gallery: (result.gallery)? (result.gallery).map(image =>formatImageResponse(image) ) : null,
            facilities: (result.facilities) ? result.facilities : null,
            highlights: (result.highlights) ? result.highlights : null,
        };

        if(!isList){
            let meta_information = await generateMetaInfo  ('PROVIDER', result);
            if(meta_information)
            {
                data.meta_information  = meta_information;
            } 

            if(result.gender_diversity && result.gender_diversity.length > 0){
                data.placements['gender_diversity'] = result.gender_diversity;
            }
            if(result.recruiters_profile && result.recruiters_profile.length > 0){
                data.placements['recruiters_profile'] = result.recruiters_profile;
            }
            if(result.ctc && result.ctc.length > 0){
                data.placements['ctc'] = result.ctc;
            }
            if(result.highest_ctc && result.highest_ctc.length > 0){
                data.placements['highest_ctc'] = result.highest_ctc;
            }
            if(result.academic_background && result.academic_background.length > 0){
                data.placements['academic_background'] = result.academic_background;
            }
            if(result.professional_background && result.professional_background.length > 0){
                data.placements['professional_background'] = result.professional_background;
            }
            if(result.work_experience && result.work_experience.length > 0){
                data.placements['work_experience'] = result.work_experience;
            }
            
            let facilitiesData = await RedisConnection.getValuesSync('provider-facilties');
            if(facilitiesData.noCacheData != true && data.facilities && Array.isArray(data.facilities) && data.facilities.length > 0) {
                data.facilities = data.facilities.map(facility => facilitiesData[facility])
            }
            else
                data.facilities = data.facilities.map(facility => { return {label: facility, description: null, icon:null}});
            
       

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
        }

        // if(result.alumni && result.alumni.length > 0){
        //     for(let alum of result.alumni){                
        //         if(!isList){
        //             if(alum.photo){
        //                 alum.photo = getMediaurl(alum.photo.thumbnail);                    
        //             }
        //             data.alumni.push(alum);
        //         }
        //     }
        // }
        
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
            if(!isList){
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
        } 

        if(rank !== null && result.ranks){
            data.rank = result[`ranking_${rank}`];
            data.rank_details = result.ranks.find(o => o.slug === rank);
        }

        if(!isList){
            data.institute_rankings = result.ranks;
        }
        if(result.ranks){
            let sortedRanks = _.sortBy( result.ranks, 'rank' );
            let featuredCount = 0;
            for(const rank of sortedRanks){
                if(!rank.featured){
                    continue;
                }
                data.featured_ranks.push({
                    name: rank.name,
                    slug: rank.slug,
                    rank: rank.rank
                });
                featuredCount++;
                if(featuredCount == FEATURED_RANK_LIMIT && isList){
                    break;
                }
            }
        }

        return data;
    }

    async getInstituteLandingPage(req) {
        let data = {};
        try {
            const query = {
                "bool": {
                    "filter": [
                        { "term": { "id": 1 } }
                    ]
                }
            };
            const payload = {
                "size": 1
            };

            let cacheData = await RedisConnection.getValuesSync('institute-home-page');
            data = cacheData;

            if (cacheData.noCacheData) {
               let result = await elasticService.search('institute-home-page', query, payload, ["category_recommendations", "program_recommendations", "region_recommendations", "meta_description", "meta_keywords"]);

                if (result.hits && result.hits.length) {
                    data = result.hits[0]._source
                    let meta_information = await generateMetaInfo('INSTITUTE_HOME_PAGE', result);

                    if (meta_information) {
                        data.meta_information = meta_information;
                    }
                    await RedisConnection.set('institute-home-page', data);
                    RedisConnection.expire('institute-home-page', process.env.CACHE_EXPIRE_HOME_PAGE);
                    return { success: true, data }
                }
                else {
                    return { success: false, data: null }
                }
            }

            return { success: false, data: data }

        } catch (error) {
            console.log("Error fetching top categories in institute-home-page", error);
            return { success: false, data: null }
        }
    }
    
      async addActivity(req){
       try {           
            const {user} = req;
            const {providerId} = req.body	
            const activity_log =  await helperService.logActvity("INSTITUTE_VIEW",(user)? user.userId : null, providerId)           
       } catch (error) {
           console.log("provider activity error",  error)
       }        
    }

    async invalidateFacilities(callback, useCache = true){
        const cacheKey = "provider-facilties";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
                }
            }catch(error){
                console.warn("Redis cache failed for page provider-facilties: "+cacheKey,error);
            }
        }

        let result = null;
        try{
            result = await fetch(`${apiBackendUrl}/facilities`);
        }catch(e){
            console.log('Error while retriving facilities data',e);
            return callback(null, {success: false, message: 'backend server failed!', data: []});
        }
        if(result.ok) {
            let response = await result.json();
            let res = {};
            for (let key in response) {
                res[ response[key].facility] = {
                    label:  response[key].facility,
                    description:  response[key].description,
                    icon: ( response[key].icon &&  response[key].icon.url)? response[key].icon.url:null,
                }
                
            }
            RedisConnection.set(cacheKey, res);
            callback(null, {success: true, message: 'Fetched successfully!', data:res});
        } else {
            callback(null, {success: false, message: 'No data available!', data: []});
        }
    }

    async getProviderPlacements(req) {
        let id = req.params.id;
        id = id.split("PVDR_").pop()
        let data = {};
        let cacheName = `provider_placement_${id}`;
        try {
            const query = {
                "bool": {
                    "filter": [
                        { "term": { "provider_id": id } }
                    ]
                }
            };

            let cacheData = await RedisConnection.getValuesSync(cacheName);
            data = cacheData;

            if (cacheData.noCacheData) {
                let result = await elasticService.search('institute-placement', query,);

                if (result.hits && result.hits.length) {
                    let years = []
                    let programs = []
                    let placement_data = {}
                    for (const hit of result.hits) {
                        years.push(hit._source.year)
                        programs.push(hit._source.program_name)
                        if (!placement_data[hit._source.year]) placement_data[hit._source.year] = {}

                        let batch_profile = []
                        if (hit._source.gender_diversity_graph_id) {
                            batch_profile.push({
                                tab_label: 'Gender Diversity',
                                type: "GRAPH",
                                graph_id: hit._source.gender_diversity_graph_id
                            })
                        }
                        if (hit._source.sector_wise_placement_graph) {
                            batch_profile.push({
                                tab_label: 'Sector wise Placements',
                                type: "GRAPH",
                                graph_id: hit._source.sector_wise_placement_graph
                            })
                        }
                        if (hit._source.academic_background_graph_id) {
                            batch_profile.push({
                                tab_label: 'Academic Background',
                                type: "GRAPH",
                                graph_id: hit._source.academic_background_graph_id
                            })
                        }
                        if (hit._source.work_experience_graph_id) {
                            batch_profile.push({
                                tab_label: 'Work Experience',
                                type: "GRAPH",
                                graph_id: hit._source.work_experience_graph_id
                            })
                        }

                        let recruiter_profile = []
                        if (hit._source.key_insights_section) {
                            let key_insight_data = []
                            if (hit._source.key_insights_section.new_recruiters) {
                                key_insight_data.push({
                                    label: "New Recuiter",
                                    image: "https://d2lk14jtvqry1q.cloudfront.net/media/building_line_b7b3abb434.svg",
                                    stats: hit._source.key_insights_section.new_recruiters
                                })
                            }
                            if (hit._source.key_insights_section.companies_visited) {
                                key_insight_data.push({
                                    label: "Companies Visited",
                                    image: "https://d2lk14jtvqry1q.cloudfront.net/media/briefcase_4_line_9f5185d881.svg",
                                    stats: hit._source.key_insights_section.companies_visited
                                })
                            }
                            if (hit._source.key_insights_section.pre_placement_offers) {
                                key_insight_data.push({
                                    label: "Pre Placement Offers",
                                    image: "https://d2lk14jtvqry1q.cloudfront.net/media/medal_2_fill_1233a61201.svg",
                                    stats: hit._source.key_insights_section.pre_placement_offers
                                })
                            }
                            recruiter_profile.push({
                                tab_label: 'Key Insights',
                                type: "KEY_INSIGHT",
                                heading: 'Key Insights',
                                key_insight_data: key_insight_data
                            })
                        }

                        if (hit._source.profiles_offered && hit._source.profiles_offered.length > 0 ) {
                            recruiter_profile.push({
                                tab_label: 'Profiles Offered',
                                type: "BULLET_LIST",
                                heading: 'Profiles Offered',
                                bullet_list_data: hit._source.profiles_offered.map(item => item.profiles_offered)

                            })
                        }

                        if (hit._source.top_recruiter && hit._source.top_recruiter.length > 0) {
                            recruiter_profile.push({
                                tab_label: 'Top Recruiters',
                                type: "TABLE",
                                heading: 'Top Recruiters For Final Placements',
                                table_data: {
                                    head: ["Companies", "#Offers"],
                                    rows: hit._source.top_recruiter.map(item => [item.recruiter, item.number_of_offers])
                                }
                            })
                        }

                        if (hit._source.percentage_of_students_placed) {
                            recruiter_profile.push({
                                tab_label: 'Percentage Of Students Placed',
                                type: "TABLE",
                                heading: 'Percentage Of Students Placed',
                                table_data: {
                                    head: ["Perticulars", hit._source.year],
                                    rows: [
                                        [
                                            'Numbers of students registered',
                                            hit._source.percentage_of_students_placed.total_number_of_students
                                        ],
                                        [
                                            'Numbers of students placed',
                                            hit._source.percentage_of_students_placed.students_placed
                                        ],
                                        [
                                            '% of students placed',
                                            Math.round((hit._source.percentage_of_students_placed.students_placed / hit._source.percentage_of_students_placed.total_number_of_students) * 100)
                                        ]
                                    ]
                                }
                            })
                        }
                        let salary_CTC = []
                        if (hit._source.CTC_graph_id) {
                            salary_CTC.push({
                                tab_label: 'Highest CTC',
                                type: "GRAPH",
                                graph_id: hit._source.CTC_graph_id
                            })
                        }
                        if (hit._source.sector_wise_highest_CTC_graph_id) {
                            salary_CTC.push({
                                tab_label: 'CTC By skill',
                                type: "GRAPH",
                                graph_id: hit._source.sector_wise_highest_CTC_graph_id
                            })
                        }


                        placement_data[hit._source.year][hit._source.program_name] = {
                            batch_profile,
                            recruiter_profile,
                            salary_CTC
                        }
                    }

                    data.years = years.filter((x, i, a) => a.indexOf(x) == i)
                    data.programs = programs.filter((x, i, a) => a.indexOf(x) == i)
                    data.placement_data = placement_data
                    await RedisConnection.set(cacheName, data);
                    RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_SINGLE_PROVIDER);
                    return { success: true, data }
                }
                else {
                    return { success: false, data: null }
                }
            }

            return { success: false, data: data }

        } catch (error) {
            console.log("Error fetching top categories in institute-home-page", error);
            return { success: false, data: null }
        }
    }  
}