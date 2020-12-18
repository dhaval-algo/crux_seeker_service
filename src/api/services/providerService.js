const elasticService = require("./elasticService");
const learnContentService = require("./learnContentService");
const fetch = require("node-fetch");
let LearnContentService = new learnContentService();

const apiBackendUrl = process.env.API_BACKEND_URL;
const rangeFilterTypes = ['RangeSlider','RangeOptions'];
const MAX_RESULT = 10000;
const keywordFields = ['name'];

const getFilterConfigs = async () => {
    let response = await fetch(`${apiBackendUrl}/entity-facet-configs?entity_type=Provider&filterable_eq=true&_sort=order:ASC`);
    if (response.ok) {
    let json = await response.json();
    return json;
    } else {
        return [];
    }
};

const parseQueryFilters = (filter) => {
    const parsedFilterString = decodeURIComponent(filter);
    console.log("parsedFilterString <> ", parsedFilterString);
    let query_filters = [];
    const filterArray = parsedFilterString.split("::");
    for(const qf of filterArray){
        const qfilters = qf.split(":");
        query_filters.push({
            key: qfilters[0],
            value: qfilters[1].split(",")
        });
    }
    console.log("query_filters <> ", query_filters);
    return query_filters;
};

const getFilterAttributeName = (attribute_name) => {
    const keywordFields = ['programs','study_modes','institute_types','city','gender_accepted'];
    if(keywordFields.includes(attribute_name)){
        return `${attribute_name}.keyword`;
    }else{
        return attribute_name;
    }
};

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


const getAllFilters = async (query, queryPayload, filterConfigs) => {
    //let filters = JSON.parse(JSON.stringify(query.bool.filter));
    //delete query.bool.filter;
    if(queryPayload.from !== null && queryPayload.size !== null){        
        delete queryPayload['from'];
        delete queryPayload['size'];        
    }
    //query['bool']['should'] = filters;
    //query['bool']['minimum_should_match'] = 1;
    console.log("Query payload for filters data <> ",queryPayload);
    console.log("Filter Query <> ", JSON.stringify(query));
    const result = await elasticService.search('provider', query, {from: 0, size: MAX_RESULT});
    if(result.total && result.total.value > 0){
        console.log("Main data length <> ", result.total.value);
        console.log("Result data length <> ", result.hits.length);
        return formatFilters(result.hits, filterConfigs, query);
    }else{
        return [];
    }
};


const formatFilters = async (data, filterData, query) => {
    console.log("applying filter with total data count <> ", data.length);
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
        console.log("Empty options <> ", emptyOptions);
        filters = filters.filter(function( obj ) {
            return !emptyOptions.includes(obj.label);
          });
    }

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

const updateSelectedFilters = (filters, parsedFilters, parsedRangeFilters) => {
    for(let filter of filters){
        if(filter.filter_type == "Checkboxes"){
            let seleteddFilter = parsedFilters.find(o => o.key === filter.label);
            //console.log("Selected filter for <> "+filter.label+" <> ", seleteddFilter);
            if(seleteddFilter && filter.options){
                for(let option of filter.options){
                    if(seleteddFilter.value.includes(option.label)){
                        option.selected = true;
                    }
                }
            }
        }
        if(filter.filter_type == "RangeOptions"){
            let seleteddFilter = parsedRangeFilters.find(o => o.key === filter.label);
            //console.log("Selected filter for <> "+filter.label+" <> ", seleteddFilter);
            if(seleteddFilter && filter.options){
                for(let option of filter.options){
                    if((option.start ==  seleteddFilter.start) && (option.end ==  seleteddFilter.end)){
                        option.selected = true;
                    }
                }
            }
        }
        if(filter.filter_type == "RangeSlider"){
            let seleteddFilter = parsedRangeFilters.find(o => o.key === filter.label);
            //console.log("Selected filter for <> "+filter.label+" <> ", seleteddFilter);
            if(seleteddFilter){
                filter.min = seleteddFilter.start;
                filter.max = seleteddFilter.end;
            }
        }
    }
    console.log("parsedRangedFilters <> ", parsedRangeFilters);

    return filters;
};



const updateFilterCount = (filters, parsedFilters, filterConfigs, data) => {
    if(parsedFilters.length <= 0){
        return filters;
    }
    for(let filter of filters){
        if(filter.filter_type !== 'Checkboxes'){
            continue;
        }
        let parsedFilter = parsedFilters.find(o => o.key === filter.label);
        if(!parsedFilter){
            for(let option of filter.options){
                option.count = 0;
                let elasticAttribute = filterConfigs.find(o => o.label === filter.label);
                    if(!elasticAttribute){
                        continue;
                    }
                for(const esData of data){
                    
                    const entity = esData._source; 
                    let entityData = entity[elasticAttribute.elastic_attribute_name];
                    if(entityData){
                        if(Array.isArray(entityData)){
                            if(entityData.includes(option.label)){
                                option.count++;
                            }
                        }else{
                            if(entityData == option.label){
                                option.count++;
                            }
                        }
                    }
                }
                if(option.count == 0){
                    option.disabled = true;
                }
            }
        }

        filter.options = filter.options.filter(function( obj ) {
            return !obj.disabled;
          });
    }
    return filters;
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

        let queryPayload = {};
        let paginationQuery = await getPaginationQuery(req.query);
        queryPayload.from = paginationQuery.from;
        queryPayload.size = paginationQuery.size;
        console.log("paginationQuery <> ", paginationQuery);

        if(!req.query['sort']){
            req.query['sort'] = "name:asc";
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

        let parsedFilters = [];
        let parsedRangeFilters = [];
        let filterQuery = JSON.parse(JSON.stringify(query));
        let filters = await getAllFilters(filterQuery, queryPayload, filterConfigs);        
        
        if(req.query['f']){
            parsedFilters = parseQueryFilters(req.query['f']);
            for(const filter of parsedFilters){
                let elasticAttribute = filterConfigs.find(o => o.label === filter.key);
                if(elasticAttribute){
                    const attribute_name  = getFilterAttributeName(elasticAttribute.elastic_attribute_name);
                    query.bool.filter.push({
                        "terms": {[attribute_name]: filter.value}
                    });
                }
            }
        }
        
        let queryString = null;
        if(req.query['q']){
            query.bool.must.push( 
                {
                    "query_string" : {
                        "query" : `*${decodeURIComponent(req.query['q'])}*`,
                        "fields" : ['name','slug','institute_types','programs','program_types','study_modes'],
                        "analyze_wildcard" : true,
                        "allow_leading_wildcard": true
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

            //let filters = await getAllFilters(query, queryPayload, filterConfigs);
            filters = updateFilterCount(filters, parsedFilters, filterConfigs, result.hits);

            //update selected flags
            if(parsedFilters.length > 0){
                filters = updateSelectedFilters(filters, parsedFilters, parsedRangeFilters);
            }

              let data = {
                list: list,
                filters: filters,
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