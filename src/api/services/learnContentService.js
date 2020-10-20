const elasticService = require("./elasticService");
const fetch = require("node-fetch");

const apiBackendUrl = process.env.API_BACKEND_URL;

const getFilterConfigs = async () => {
    let response = await fetch(`${apiBackendUrl}/entity-facet-configs?filterable_eq=true&_sort=order:ASC`);
    if (response.ok) {
    let json = await response.json();
    return json;
    } else {
        return [];
    }
};

const round = (value, step) => {
    step || (step = 1.0);
    var inv = 1.0 / step;
    return Math.round(value * inv) / inv;
};

const getPaginationQuery = (query) => {
    let page = 1;
    let size = 10;
    let from = 0;
    if(query['page']){
      page = parseInt(query['page']);
    }
    if(query['size']){
      size = parseInt(query['size']);
    }      
    if(page > 1){
      from = page*size;
    }
    return {
      from,
      size,
      page
    };
};

const parseQueryFilters = (filter) => {
    let query_filters = [];
    const filterArray = filter.split("::");
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


const calculateDuration = (total_duration_in_hrs) => {
    const hourse_in_day = 8;
    const days_in_week = 5;
    let duration = null;
        if(total_duration_in_hrs){
            let totalDuration = null;
            let durationUnit = null;
            if(total_duration_in_hrs < (hourse_in_day*days_in_week)){
                totalDuration = total_duration_in_hrs;
                durationUnit = (totalDuration > 1) ? 'hours': 'hour';
                return `${totalDuration} ${durationUnit}`;
            }

            const week = Math.floor((hourse_in_day*days_in_week)/7);
            if(week < 4){
                totalDuration = week;
                durationUnit = (week > 1) ? 'weeks': 'week';
                return `${totalDuration} ${durationUnit}`;
            }

            const month = Math.floor(week/4);
            if(month < 12){
                totalDuration = month;
                durationUnit = (month > 1) ? 'months': 'month';
                return `${totalDuration} ${durationUnit}`;
            }

            const year = Math.floor(month/12);
            totalDuration = year;
            durationUnit = (year > 1) ? 'years': 'year';
            return `${totalDuration} ${durationUnit}`;
        }
        return duration;
};

const getFilters = async (data, filterConfigs) => {
    return formatFilters(data, filterConfigs);
};

const formatFilters = async (data, filterData) => {
    let filters = [];
    for(const filter of filterData){
        filters.push({
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
            options: filter.is_collapsed ? getFilterOption(data, filter)  : []
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
                            count: 1
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
                        count: 1
                    });
                }
            }
        }
    }
    return options;
};

const getFilterAttributeName = (attribute_name) => {
    const keywordFields = ['topics','categories','title','level','learn_type','languages'];
    if(keywordFields.includes(attribute_name)){
        return `${attribute_name}.keyword`;
    }else{
        return attribute_name;
    }
};

module.exports = class learnContentService {

    async getLearnContentList(req, callback){
        const filterConfigs = await getFilterConfigs();
        const query = { "bool": {
            "must": [
              {term: { "status.keyword": 'published' }}
            ],
            "filter": []
        }};

        let queryPayload = {};
        let paginationQuery = await getPaginationQuery(req.query);
        queryPayload.from = paginationQuery.from;
        queryPayload.size = paginationQuery.size;
        console.log("req.query <> ", req.query);

        //queryPayload.sort = [{"title.keyword": 'asc'}];
        if(req.query['sort']){
            const keywordFields = ['title'];
            let sort = req.query['sort'];
            let splitSort = sort.split(":");
            if(keywordFields.includes(splitSort[0])){
                sort = `${splitSort[0]}.keyword:${splitSort[1]}`;
            }
            /* Newest - The courses added recently.  Most recent date to oldest
            Highest rated - Courses with highest rating to show up first
            Price low to high
            Price high to low
            Top 20 skills
            Top 20 roles */
            //queryPayload.sort = ["title.keyword:desc"];
            queryPayload.sort = [sort];
        }else{
            queryPayload.sort = ["published_date:desc"];
        }

        if(req.query['f']){
            let parsedFilters = parseQueryFilters(req.query['f']);
            for(const filter of parsedFilters){
                let elasticAttribute = filterConfigs.find(o => o.label === filter.key);
                if(elasticAttribute){
                    const attribute_name  = getFilterAttributeName(elasticAttribute.elastic_attribute_name);
                    query.bool.filter.push({
                        "terms": {[attribute_name]: filter.value}
                    })
                }
            }
        }

        console.log("Elastic Query <> ", query.bool.filter);

        const result = await elasticService.search('learn-content', query, queryPayload);
        if(result.hits && result.hits.length > 0){

            const list = await this.generateListViewData(result.hits);

            let pagination = {
                page: paginationQuery.page,
                count: list.length,
                perPage: paginationQuery.size,
                totalCount: result.total.value
              }

            let filters = await getFilters(result.hits, filterConfigs);

              let data = {
                list: list,
                filters: filters,
                pagination: pagination
              };

            
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data});
        }else{
            callback({status: 'failed', message: 'No record found!'}, null);
        }        
    }

    async getLearnContent(slug, callback){
        const query = { "bool": {
            "must": [
              {term: { "slug.keyword": slug }},
              {term: { "status.keyword": 'published' }}
            ]
        }};
        const result = await elasticService.search('learn-content', query);
        if(result.hits && result.hits.length > 0){
            const data = await this.generateSingleViewData(result.hits[0]._source);
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data});
        }else{
            callback({status: 'failed', message: 'Not found!'}, null);
        }        
    }


    async generateSingleViewData(result, isList = false){

        let effort = null;
        if(result.recommended_effort_per_week){
            let efforUnit = (result.recommended_effort_per_week > 1) ? 'hours per week' : 'hour per week';
            effort = `${result.recommended_effort_per_week} ${efforUnit}`
        }
        let coverImageSize = 'small';
        if(isList){
            coverImageSize = 'thumbnail';
        }

        let data = {
            title: result.title,
            subtitle: result.subtitle,
            provider: {
                name: result.provider_name,
                currency: result.provider_currency
            },
            instructors: [],
            cover_video: (result.video) ? process.env.ASSET_URL+result.video : null,
            cover_image: (result.images) ? process.env.ASSET_URL+result.images[coverImageSize] : null,
            description: (!isList) ? result.description : null,
            skills: (!isList) ? result.skills_gained : null,
            what_will_learn: (!isList) ? result.what_will_learn : null,
            target_students: (!isList) ? result.target_students : null,
            prerequisites: (!isList) ? result.prerequisites  : null,
            content: (!isList) ? result.content : null,
            course_details: {
                //duration: (result.total_duration_in_hrs) ? Math.floor(result.total_duration_in_hrs/duration_divider)+" "+duration_unit : null,
                duration: calculateDuration(result.total_duration_in_hrs), 
                effort: effort,
                total_video_content: result.total_video_content_in_hrs,
                language: result.languages.join(", "),
                subtitles: (result.subtitles && result.subtitles.length > 0) ? result.subtitles.join(", ") : null,
                level: (result.level) ? result.level : null,
                medium: (result.medium) ? result.medium : null,
                instruction_type: (result.instruction_type) ? result.instruction_type : null,
                accessibilities: (result.accessibilities && result.accessibilities.length > 0) ? result.accessibilities.join(", ") : null,
                availabilities: (result.availabilities && result.availabilities.length > 0) ? result.availabilities.join(", ") : null,
                learn_type: (result.learn_type) ? result.learn_type : null,
                topics: (result.topics.length  > 0) ? result.topics.join(", ") : null,
                tags: [],
                pricing: {
                    pricing_type: result.pricing_type,
                    currency: result.pricing_currency,
                    regular_price: result.regular_price,
                    sale_price: result.sale_price,
                    offer_percent: (result.sale_price) ? (Math.round(((result.regular_price-result.sale_price) * 100) / result.regular_price)) : null,
                    schedule_of_sale_price: result.schedule_of_sale_price,
                    free_condition_description: result.free_condition_description,
                    conditional_price: result.conditional_price
                }                
            },
            provider_course_url: result.provider_course_url,
            reviews: [],
            ratings: {
                total_review_count: result.reviews ? result.reviews.length : 0,
                average_rating: 0,
                average_rating_actual: 0,
                rating_distribution: []
            }
        };

        if(!isList){
            if(result.instructors && result.instructors.length > 0){
                for(let instructor of result.instructors){
                    if(instructor.instructor_image){
                        instructor.instructor_image = process.env.ASSET_URL+instructor.instructor_image.thumbnail;                    
                    }
                    data.instructors.push(instructor);
                }
            }
            if(result.instruction_type){
                data.course_details.tags.push(result.instruction_type);
            }
            if(result.medium){
                data.course_details.tags.push(result.medium);
            }
        }

        
        if(result.reviews && result.reviews.length > 0){
            let totalRating = 0;
            let ratings = {};
            for(let review of result.reviews){
                totalRating += review.rating;
                
                if(!isList){
                    if(review.photo){
                        review.photo = process.env.ASSET_URL+review.photo.thumbnail;                    
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

        //Ignore default values in ui
        if(data.course_details.learn_type == 'Others'){
            data.course_details.learn_type = null;
        }
        if(data.course_details.topics == 'Others'){
            data.course_details.topics = null;
        }
        if(data.course_details.medium == 'Not Specified'){
            data.course_details.medium = null;
        }
        if(data.course_details.instruction_type == 'Not Specified'){
            data.course_details.instruction_type = null;
        }
        if(data.course_details.language == 'Not Specified'){
            data.course_details.language = null;
        }
        if(data.course_details.pricing.pricing_type == 'Not_Specified'){
            data.course_details.pricing.pricing_type = null;
        }        
        return data;
    }



    async generateListViewData(rows){
        let datas = [];
        for(const row of rows){
            const data = await this.generateSingleViewData(row._source, true);
            datas.push(data);
        }
        return datas;
    }


}