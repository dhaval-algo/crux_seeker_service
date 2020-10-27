const elasticService = require("./elasticService");
const fetch = require("node-fetch");

const apiBackendUrl = process.env.API_BACKEND_URL;
let slugMapping = [];
const rangeFilterTypes = ['RangeSlider','RangeOptions'];

const getFilterConfigs = async () => {
    let response = await fetch(`${apiBackendUrl}/entity-facet-configs?filterable_eq=true&_sort=order:ASC`);
    if (response.ok) {
    let json = await response.json();
    return json;
    } else {
        return [];
    }
};

const getEntityLabelBySlug = async (entity, slug) => {
    let response = await fetch(`${apiBackendUrl}/${entity}?slug_eq=${slug}`);
    if (response.ok) {
    let json = await response.json();
    if(json && json.length){
        return json[0].default_display_label;
    }else{
        return null;
    }    
    } else {
        return null;
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

const parseQueryRangeFilters = (filter) => {
    const parsedFilterString = decodeURIComponent(filter);
    console.log("parsedRangeFilterString <> ", parsedFilterString);
    let query_filters = [];
    const filterArray = parsedFilterString.split("::");
    for(const qf of filterArray){
        const qfilters = qf.split(":");
        const splitRange = qfilters[1].split("_");
        query_filters.push({
            key: qfilters[0],
            start: (splitRange[0] == "MIN") ? splitRange[0] : parseFloat(splitRange[0]),
            end: (splitRange[1] == "MAX") ? splitRange[1] : parseFloat(splitRange[1])
        });
    }
    console.log("query_range_filters <> ", query_filters);
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

const getAllFilters = async (query, queryPayload, filterConfigs) => {
        if(queryPayload.from !== null && queryPayload.size !== null){
            delete queryPayload['from'];
            delete queryPayload['size'];
        }
        console.log("queryPayload <> ", queryPayload);
        const result = await elasticService.search('learn-content', query, queryPayload);
        if(result.total && result.total.value > 0){
            return formatFilters(result.hits, filterConfigs);
        }else{
            return [];
        }
};

const formatFilters = async (data, filterData) => {
    let filters = [];
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
            options: (filter.filter_type == "Checkboxes") ? getFilterOption(data, filter)  : []
        };

        if(rangeFilterTypes.includes(filter.filter_type)){
            if(filter.filter_type == 'RangeSlider'){
                const maxValue = getMaxValue(data, filter.elastic_attribute_name);
                formatedFilters.min = 0;
                formatedFilters.max = maxValue;
                formatedFilters.minValue = 0;
                formatedFilters.maxValue = getMaxValue(data, filter.elastic_attribute_name);
            }

            if(filter.filter_type == 'RangeOptions'){
                if(filter.elastic_attribute_name == 'average_rating'){
                    formatedFilters.options = getRangeOptions(data, filter.elastic_attribute_name);
                }
            }
        }        
        filters.push(formatedFilters);
    }
    return filters;    
};

const getMaxValue = (data, attribute) => {
    let maxValue = 0;
    for(const esData of data){
        const entity = esData._source;
        if(entity.regular_price > maxValue){
            maxValue = entity.regular_price;
        }
    }
    return maxValue;
};


const getRangeOptions = (data, attribute) => {
    let predefinedOptions = [4.5,4.0,3.5,3.0];
    let options = [];
    for(let i=0; i<predefinedOptions.length; i++){
        count = 0;
        for(const esData of data){
            const entity = esData._source;
            if(entity[attribute] >= predefinedOptions[i]){
                count++;
            }
        }

        let option = {
            label: `${predefinedOptions[i].toString()} & up`,
            count: count,
            selected: false,
            start: predefinedOptions[i],
            end: 'MAX'
        };
        options.push(option);
    }
    return options;
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
                            selected: false
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
                        selected: false
                    });
                }
            }
        }
    }
    return options;
};

const getFilterAttributeName = (attribute_name) => {
    const keywordFields = ['topics','categories','sub_categories','title','level','learn_type','languages','medium','instruction_type'];
    if(keywordFields.includes(attribute_name)){
        return `${attribute_name}.keyword`;
    }else{
        return attribute_name;
    }
};

const updateSelectedFilters = (filters, parsedFilters) => {
    for(const filter of parsedFilters){
        if(filter.filter_type == "Checkboxes"){
            let seleteddFilter = filters.find(o => o.label === filter.key);
            if(seleteddFilter && seleteddFilter.options){
                for(let option of seleteddFilter.options){
                    if(filter.value.includes(option.label)){
                        option.selected = true;
                    }
                }
            }
        }
    }
    return filters;
};


const getSlugMapping = (req) => {
    slugMapping = [];
    if(req.query['pageType'] !== null){
        if(req.query['pageType'] == "category"){
            slugMapping = [{elastic_key: "categories" , entity_key: "categories"}, {elastic_key: "sub_categories" , entity_key: "sub-categories"}];
        }
        if(req.query['pageType'] == "topic"){
            slugMapping = [{elastic_key: "topics" , entity_key: "topics"}];
        }            
    }
    return slugMapping;
};

module.exports = class learnContentService {

    async getLearnContentList(req, callback){

        slugMapping = getSlugMapping(req);

        const filterConfigs = await getFilterConfigs();
        const query = { 
            "bool": {
                //"should": [],
                "must": [
                    {term: { "status.keyword": 'published' }}                
                ],
                "filter": []
            }
        };

        let queryPayload = {};
        let paginationQuery = await getPaginationQuery(req.query);
        queryPayload.from = paginationQuery.from;
        queryPayload.size = paginationQuery.size;
        console.log("paginationQuery <> ", paginationQuery);

        //queryPayload.sort = [{"title.keyword": 'asc'}];

        if(!req.query['sort']){
            req.query['sort'] = "published_date:desc";
        }

        if(req.query['sort']){
            console.log("Sort requested <> ", req.query['sort']);
            const keywordFields = ['title', 'average_rating_actual'];
            let sort = req.query['sort'];
            let splitSort = sort.split(":");
            if(keywordFields.includes(splitSort[0])){
                sort = `${splitSort[0]}.keyword:${splitSort[1]}`;
            }
            queryPayload.sort = [sort];
        }


       /*  queryPayload.sort = {
            "average_rating": {
                "unmapped_type": "float",
                "order": "desc"
            }
        }; */



        let slugs = [];
        if(req.query['slug']){
            slugs = req.query['slug'].split(",");
            //const slugMapping = [{elastic_key: "categories" , entity_key: "categories"}, {elastic_key: "sub_categories" , entity_key: "sub-categories"}];
            console.log("slugMapping <> ", slugMapping);
            for(let i=0; i<slugs.length; i++){
                let slugLabel = await getEntityLabelBySlug(slugMapping[i].entity_key, slugs[i]);
                if(!slugLabel){
                    slugLabel = slugs[i];                
                }
                query.bool.must.push({
                    "terms": {[`${slugMapping[i].elastic_key}.keyword`]: [slugLabel]}
                });
            }           
        }

        let parsedFilters = [];

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
        
        if(req.query['rf']){
            let parsedRangeFilters = parseQueryRangeFilters(req.query['rf']);
            for(const filter of parsedRangeFilters){
                console.log("Applying filters <> ", filter);
                let elasticAttribute = filterConfigs.find(o => o.label === filter.key);
                if(elasticAttribute){
                    const attribute_name  = getFilterAttributeName(elasticAttribute.elastic_attribute_name);

                    let rangeQuery = {};
                    if(filter.start !== "MIN"){
                        rangeQuery["gte"] = filter.start;
                    }
                    if(filter.end !== "MAX"){
                        rangeQuery["lte"] = filter.end;
                    }

                    query.bool.must.push({
                        "range": {
                            [attribute_name]: rangeQuery
                         }
                    });                 
                }
            }
        }

        
        
        let queryString = null;
        if(req.query['q']){
            /* query.match_phrase = {
                "title.keyword": {
                    query: req.query['q'],
                    operator: "and",
                    fuzziness: "auto"
              }
            } */
            /* query.bool.must.push( {match: {
                "title.keyword": {
                    "query": "python",
                    "type":  "phrase"
                }
            }}) */
            /* query.wildcard = {
                "title.keyword" : `*${req.query['q']}*`
              }; */
              //queryString = req.query['q'];

             /*  query.match = {
                "title.keyword": "Python"
            }; */

            /* query.bool.should.push({
                "match": {
                "title.keyword": {
                    "query": req.query['q'],
                    "operator": "or"
                 } 
                }
            }); */

            query.bool.filter.push({
                
                "match": {
                    "title.keyword": {
                        "query": req.query['q']
                     } 
                    }
            })
        }

        if(query.bool.must[2]){
            console.log("Elastic must range Query <> ", query.bool.must[2]);
        }
        console.log("Elastic must Query <> ", query.bool.must);

        const result = await elasticService.search('learn-content', query, queryPayload, queryString);
        if(result.total && result.total.value > 0){

            const list = await this.generateListViewData(result.hits);

            let pagination = {
                page: paginationQuery.page,
                count: list.length,
                perPage: paginationQuery.size,
                totalCount: result.total.value
              }

            //let filters = await getFilters(result.hits, filterConfigs);
            let filters = await getAllFilters(query, queryPayload, filterConfigs);            
            
            //update selected flags
            if(parsedFilters.length > 0){
                filters = updateSelectedFilters(filters, parsedFilters);
            }

            //Remove filters if requested by slug
            for(let i=0; i<slugs.length; i++){
                const config = filterConfigs.find(o => o.elastic_attribute_name === slugMapping[i].elastic_key);
                if(config){
                    filters = filters.filter(o => o.label !== config.label);
                }
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


    async getCategories(callback){
        let categories = [];

        const queryBody = {
            "query": {
              "bool": {
                "must": [
                  {
                    "term": {
                      "status.keyword": "published"
                    }
                  }
                ]
              }
            },
            "size": 0,
            "aggs": {
              "categories": {
                "terms": {
                  "field": "categories.keyword",
                  "size": 100
                }
              }
            }
          };
        const result = await elasticService.plainSearch('learn-content', queryBody);
        console.log("elastic result <> ", result);

        if(result.aggregations){
            let categoriesData = result.aggregations.categories.buckets;
            console.log("categoriesData <> ", categoriesData);
            //categories = categoriesData.map(o => {"label": o['key'], "value": o['key']} );
            categories = categoriesData.map(function(obj) {
                return {"label": obj['key'], "value": obj['key']};
              });
        }

        callback(null, {status: 'success', message: 'Fetched successfully!', data: categories});
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
            slug: result.slug,
            id: `LRN_CNT_PUB__${result.id}`,
            subtitle: result.subtitle,
            provider: {
                name: result.provider_name,
                currency: result.provider_currency
            },
            instructors: [],
            cover_video: (result.video) ? process.env.ASSET_URL+result.video : null,
            cover_image: (result.images) ? process.env.ASSET_URL+result.images[coverImageSize] : null,
            description: result.description,
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