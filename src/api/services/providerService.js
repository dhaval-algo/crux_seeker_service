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
const { rankings } = require("match-sorter");

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
    'High To Low Attr': "rank-attr:asc",
    'Low To High Attr': "rank-attr:desc",
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
           
            if(false && req.query['rank']){ // NOTE SURE WHY DELETE IT IF NOT REQURIED
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
        let latestRankYear

        if(req.query['rank'])
        {
            let cacheData = await RedisConnection.getValuesSync('provider_ranking_latest_year');
            if(cacheData.noCacheData != true) {
                latestRankYear = cacheData
            }
            let yearOptions = []
            let yearoption = parseInt(latestRankYear[req.query['rank']]);
            for(let i =0; i< 11; i++ )  
            {
               
                yearOptions.push (
                    {
                        "label": yearoption,
                        "count": 0,
                        "selected": false,
                        "disabled": false
                    }
                )
                yearoption --
            }  
            filters.push({
                label: 'Year',
                filterable: false,
                filter_postion: 'horizontal',   
                is_collapsed: true,
                filter_type: 'Checkboxes',
                options: yearOptions
            })

            useCache = true; // enable cache for ranks
        }
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

        let rankYear = null
        if(req.query['rank'] && parsedFilters && parsedFilters.length > 0)
        {
            for (let  parsedFilter of parsedFilters)
            {
                if( parsedFilter.key == 'year')
                {
                    rankYear = []
                    for(let filter of filters)
                    {
                        if(filter.label == 'Ranking')
                        {
                            for(let option of filter.options)
                            {
                                rankYear[option.slug] = parsedFilter.value[0]
                            }
                            
                        }
                    }
                    cacheName = `listing-providers_${req.query['rank']}_${rankYear[req.query['rank']]}`; // ranking + year level cache
                    
                }
            }
        }
        if(!rankYear)
            rankYear = latestRankYear;

        if(!req.query['sort'] && !req.query['q']){
            if(req.query['rank']){   
                req.query['sort'] = `rank:asc`
            }else{
                req.query['sort'] = defaultSort;
            }            
        }

        if(req.query['sort']){
            queryPayload.sort = [];
            let rank_query = req.query['rank'];
           
            if(rank_query){
                let sort = ranksortOptions[req.query['sort']] || (req.query['rank-attr'] ? 'rank-atr:asc' :'rank:asc');
                let splitSort = sort.split(":");
                let sortField = splitSort[0]; 
                if((sortField == 'rank') && rank_query){
                            //rank + sort order level cache
                    sort = `ranking_${rankYear[rank_query]}_${rank_query}:${splitSort[1]}`;
                    cacheName = `listing-providers_${rank_query}_${rankYear[rank_query]}_${splitSort[1]}`;

                }
                else if(sortField == 'rank-attr' && rank_query && req.query['rank-attr']){
                    sort = `ranking_${rankYear[rank_query]}_${rank_query}_${req.query['rank-attr']}:${splitSort[1]}`;
                            //rank + year + rank attr + sort order level cache
                    cacheName = `listing-providers_${rank_query}_${rankYear[rank_query]}_${req.query['rank-attr']}_${splitSort[1]}`;
                }
                else
                    sort = `ranking_${rank_query}_${rankYear[rank_query]}_${sortField}:${splitSort[1]}`;

                queryPayload.sort.push(sort)               
             }
             else{
                let sort = sortOptions[req.query['sort']];
                let keywordFields = ['name']
                for(let field of sort){
            
                    let splitSort = field.split(":");
                    if(keywordFields.includes(splitSort[0])){
                        field = `${splitSort[0]}.keyword:${splitSort[1]}`;
                    }
                    queryPayload.sort.push(field)
                }
            }
        }

        if(req.query['rank']){
            ranking = await getRankingBySlug(req.query['rank']);
            ranking.image = ranking.image ? formatImageResponse(ranking.image) : null;
            ranking.logo = ranking.logo ? formatImageResponse(ranking.logo) : null;
            ranking.program = ranking.program ? ranking.program.default_display_label : null;

            if(ranking){
                parsedFilters.push({
                    key: 'Ranking',
                    value: [ranking.name]
                });
                /* query.bool.filter.push({
                    "exists" : { "field" : `ranking_${req.query['rank']}` }
                }); */
            }
                    //handles both the query for rank-attr and just rank also
            query.bool.must.push({
                "exists" : { "field" : `ranking_${rankYear[req.query['rank']]}_${req.query['rank']}${ req.query['rank-attr']? `_${req.query['rank-attr']}` :'' }` }
            });
        }

        if(useCache)
        {
            let cacheData = await RedisConnection.getValuesSync(cacheName);
            if(cacheData.noCacheData != true)
                    return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
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

            const list = await this.generateListViewData(result.hits, req.query['rank'], rankYear);

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



    async generateListViewData(rows, rank, rankYear){
        let datas = [];         
        for(let row of rows){
            const data = await this.generateSingleViewData(row._source, true, null, rank, rankYear);
            datas.push(data);
        }
        return datas;
    }



    async generateSingleViewData(result, isList = false, currency=process.env.DEFAULT_CURRENCY, rank = null, rankYear = null){

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

        // ranking data for list view on institute listing 
        if(rank == null && isList && result.ranks && rankYear ){
                    
                //get image/logo from cache
            let image, logo, ranking = await RedisConnection.getValuesSync(`rankings_slug_object`);
            for (let item of result.ranks) {
                
                if ( item.year == rankYear[item.slug]) {
                    
                    if(cacheData.noCacheData != true)
                    {
                        image = ranking[item.slug].image; 
                        logo = ranking[item.slug].logo;
                    }

                    data.ranks.push({
                        name: item.name,
                        slug: item.slug,
                        rank: item.rank,
                        image,
                        logo
                    });

                }
            }
        }
          // ranking data for list view on ranking page
        if(rank != null && isList && result.ranks && rankYear ){

                //get image/logo from cache
            let image, logo, ranking = await RedisConnection.getValuesSync(`rankings_slug_object`);

            data.ranks = {}
            data.compare_ranks = {}
            for (let item of result.ranks) {

                if(ranking.noCacheData != true)
                {
                    image = ranking[item.slug].image; 
                    logo = ranking[item.slug].logo;
                }

                if (item.year == rankYear[item.slug]) {
                    data.ranks[item.slug] = 
                        {
                            name: item.name,
                            slug: item.slug,
                            rank: item.rank,
                            logo,
                            image,
                            attributes: item.attributes
                        }
                }
            }
            let compareYear = parseInt(rankYear[rank])
            for (let i=1; i < 4 ; i++)
            {
                for (let item of result.ranks) {

                    if (item.year == compareYear && item.slug == rank) {
                        data.compare_ranks[compareYear] = 
                        {
                            name: item.name,
                            slug: item.slug,
                            rank: item.rank,
                            rank_change : 0
                        }
                    }
                }
                compareYear--
            }
                //cacl rank change
            if(Object.keys(data.compare_ranks).length >= 2)
            {
                let year = parseInt(Object.keys(data.compare_ranks).sort()[0]); //get base year

                let r1 = data.compare_ranks[year].rank;
                let r2 = data.compare_ranks[year +1].rank
                data.compare_ranks[year +1].rank_change = r1 -r2;
                

                if(Object.keys(data.compare_ranks).length === 3)
                {
                    let r3 = data.compare_ranks[year +2].rank
                    data.compare_ranks[year +2].rank_change = r2 -r3;
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
          let result = cacheData;
    
          if (cacheData.noCacheData) {
            result = await elasticService.search('institute-home-page', query, payload, ["category_recommendations", "program_recommendations", "region_recommendations", "meta_description", "meta_keywords"]);
            await RedisConnection.set('institute-home-page', result);
            RedisConnection.expire('institute-home-page', process.env.CACHE_EXPIRE_HOME_PAGE);
          }
          if (result.hits && result.hits.length) {
            data = result.hits[0]._source
            return { success: true, data }
          }
          return { success: false, data: null }
    
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

    
    async getSingleProviderRanking(req, callback) {
        try {


            const slug = req.params.slug;
            let cacheName = `single-provider-ranking-${slug}`
            let useCache = false

            let cacheData = await RedisConnection.getValuesSync(cacheName);
            if (cacheData.noCacheData != true) {
                callback(null, { success: true, message: 'Fetched successfully!', data: cacheData });
            } else {
                const query = {
                    "bool": {
                        "must": [
                            { term: { "slug.keyword": slug } },
                            { term: { "status.keyword": 'approved' } }
                        ]
                    }
                };
                const result = await elasticService.search('provider', query, { _source: ['ranks'] });
                if (result.hits && result.hits.length > 0) {
                    let ranking = {}
                    let programs = [], years = [], year, program;

                    if (result.hits[0]._source.ranks && result.hits[0]._source.ranks.length > 0) {

                        let rankingFromCache = await RedisConnection.getValuesSync(`ranking-list`);
                        if(rankingFromCache.noCacheData != true)

                        for (let rank of result.hits[0]._source.ranks)
                        {
                            if(rankingFromCache.noCacheData != true)
                            {
                                for(const eachRank of rankingFromCache)
                                    if(eachRank.slug === rank.slug)
                                    {
                                            //get image/logo from cache
                                        rank.image = eachRank.image; 
                                        rank.logo = eachRank.logo;
                                    }
                                
                            }
                               
                            program = rank.program ? rank.program : "overall";
                            year = rank.year ? rank.year : new Date().getFullYear();
                            if (!ranking[year]) {
                                ranking[year] = {}
                                years.push(year);
                            }
                            if (!ranking[year][program]) {
                                ranking[year][program] = []
                                programs.push(program);
                            }
                            ranking[year][program].push(rank);
                        }
                        years = years.sort(function (a, b) { return b - a });
                        programs = programs.filter((x, i, a) => a.indexOf(x) == i);
                        console.log(rankings)
                    }

                    let finalData = {
                        years,
                        programs,
                        ranking
                    }
                    RedisConnection.set(cacheName, finalData);
                    RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_SINGLE_PROVIDER);
                    callback(null, { success: true, message: 'Fetched successfully!', data: finalData });
                } else {
                    return callback({ success: false, message: 'Not found!' }, null);
                }
            }
        } catch (error) {
            console.log("error getting ranking for single provider", error)
            return callback({ success: false, message: 'Error!' }, null);
        }
    }

   async setLatestRankingYear(){
    const query = {
        "bool": {
            "filter": [              
                { term: { "status.keyword": 'approved' } }
            ]
        }
    };
    const result = await elasticService.search('provider', query, { size:1000,_source: ['ranks'] });
   
    if (result.hits && result.hits.length > 0) 
    {
        let rank_latest_year = {}
        for(let hit of result.hits)
        {
           
            for (let rank of hit._source.ranks)
                if (rank.year)
                {
                    if(rank_latest_year[rank.slug])
                        rank_latest_year[rank.slug] = (rank.year > rank_latest_year[rank.slug])? rank.year : rank_latest_year[rank.slug];

                    else
                        rank_latest_year[rank.slug] = rank.year
            
                }

        }
        RedisConnection.set("provider_ranking_latest_year", rank_latest_year);
    }
   }

    async ranking(callback, useCache = true){
        const cacheKey = "ranking-list";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
                }
            }catch(error){
                console.warn("Redis cache failed for : "+cacheKey, error);
            }
        }

        let result = null;
        try{
            result = await fetch(`${apiBackendUrl}/rankings`);
        }catch(e){
            console.log('Error while retriving data: '+cacheKey,e);
            return callback(null, {success: false, message: 'backend server failed!', data: []});
            
        }
        if(result.ok) {
            let response = await result.json();
            let list = [], ranking = {}
            for(const rank of response){

                if(rank.key_attributes && rank.key_attributes.length)
                    rank.key_attributes = rank.key_attributes.map((attr) => {
                        return {name: attr.name, slug: attr.slug, description: attr.description}
                    })

                if(rank.program)
                    rank.program = rank.program.default_display_label;
                if(rank.image )
                    rank.image =  formatImageResponse(rank.image);
                if(rank.logo )
                    rank.logo =  formatImageResponse(rank.logo);

                let tmp = {};
                for (let key in rank) {
                    if(key != "id" && key != "created_at" && key != "created_by" && key != "updated_at" && key != "updated_by")
                        tmp[key] = rank[key];

                }
                list.push(tmp);
                ranking[rank.slug] = tmp;
            }
            RedisConnection.set(cacheKey, list);
            RedisConnection.set("rankings_slug_object",ranking); //also cache ranking as array object with key as it slug
            callback(null, {success: true, message: 'Fetched successfully!', data:list});
        } else {
            callback(null, {success: false, message: 'No data available!', data: []});
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

    async invalidateRankings()
    {
        await this.ranking((err, data) => {
            if(!data)
                console.log("ranking invalidation: ",err)
        }, false);
    }
}