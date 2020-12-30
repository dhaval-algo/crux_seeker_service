const elasticService = require("./elasticService");
const fetch = require("node-fetch");
const pluralize = require('pluralize')

const apiBackendUrl = process.env.API_BACKEND_URL;

let slugMapping = [];
const rangeFilterTypes = ['RangeSlider','RangeOptions'];
const MAX_RESULT = 10000;

const getFilterConfigs = async () => {
    let response = await fetch(`${apiBackendUrl}/entity-facet-configs?entity_type=Learn_Content&filterable_eq=true&_sort=order:ASC`);
    if (response.ok) {
    let json = await response.json();
    //console.log("Filter Configs <> ", json);
    return json;
    } else {
        return [];
    }
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

const getDurationText = (duration, duration_unit) => {
    if(duration == 0){
        return null;
    }
    let duration_text = "";
    if(duration_unit){
        duration_unit = duration_unit.toLowerCase();
        duration_text += duration;
        if(parseInt(duration) <= 1){
            duration_unit = pluralize.singular(duration_unit);
        }
        duration_text += " "+duration_unit;
    }else{
        duration_text = calculateDuration(duration); 
    }
    return duration_text;
}


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
        console.log("Query payload for filters data <> ",queryPayload);
        console.log("query for filters data <> ",query);
        //queryPayload.from = 0;
        //queryPayload.size = count;
        //console.log("queryPayload <> ", queryPayload);
        //console.log("query <> ", query);
        const result = await elasticService.search('learn-content', query, {from: 0, size: MAX_RESULT});
        if(result.total && result.total.value > 0){
            console.log("Main data length <> ", result.total.value);
            console.log("Result data length <> ", result.hits.length);
            return formatFilters(result.hits, filterConfigs, query);
        }else{
            return [];
        }
};

const getInitialData = async (query) => {
    delete query.bool['filter'];
    for(let i=0; i<query.bool.must.length; i++){
         if(query.bool.must[i]["range"]){
                query.bool.must.splice(i, 1);
        }
    } 
    console.log("query <> ", query);  
    const result = await elasticService.search('learn-content', query, {from: 0, size: MAX_RESULT});
    if(result.total && result.total.value > 0){
        console.log("Initial data total length <> ", result.total.value);
        console.log("Initial data size <> ", result.hits.length);
        return result.hits;
    }else{
        return [];
    }
};

const formatFilters = async (data, filterData, query) => {
    console.log("applying filter with total data count <> ", data.length);
    let filters = [];
    const initialData = await getInitialData(query);
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

        //Force level options to predefined order
        if(filter.elastic_attribute_name == 'level'){
            let newOptions = [];
            let orderedLabels = ['Beginner','Intermediate','Advanced'];
            for(const label of orderedLabels){
                let opt = formatedFilters.options.find(o => o.label === label);
                if(opt){
                    newOptions.push(opt);
                }
            }
            formatedFilters.options = newOptions;
        }

        if(rangeFilterTypes.includes(filter.filter_type)){
            if(filter.filter_type == 'RangeSlider'){
                const maxValue = getMaxValue(initialData, filter.elastic_attribute_name);
                if(maxValue <= 0){
                    continue;
                }
                formatedFilters.min = 0;
                formatedFilters.max = maxValue;
                formatedFilters.minValue = 0;
                formatedFilters.maxValue = maxValue;
            }

            if(filter.filter_type == 'RangeOptions'){
                if(filter.elastic_attribute_name == 'ratings'){
                    formatedFilters.options = getRangeOptions(initialData, filter.elastic_attribute_name);
                }
                if(filter.elastic_attribute_name == 'total_duration_in_hrs'){
                    formatedFilters.options = getDurationRangeOptions(initialData, filter.elastic_attribute_name);
                }
            }
        }  
        
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

const getMaxValue = (data, attribute) => {
    let maxValue = 0;
    for(const esData of data){
        const entity = esData._source;
        if(entity[attribute] > maxValue){
            maxValue = entity[attribute];
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
            if(entity[attribute] >= predefinedOptions[i]*100){                
                count++;
            }
        }

        let option = {
            label: `${predefinedOptions[i].toString()} & up`,
            count: count,
            selected: false,
            start: predefinedOptions[i],
            end: 'MAX',
            disabled: (count > 0) ? false : true
        };
        options.push(option);
    }
    options = options.filter(item => item.count > 0);
    return options;
};

const getDurationRangeOptions = (data, attribute) => {
    let options = [
        {
            label: 'Less than 2 Hours',
            count: 0,
            selected: false,
            start: 'MIN',
            end: 2,
            disabled: true
        },
        {
            label: '1 - 4 weeks',
            count: 0,
            selected: false,
            start: 40,
            end: 159,
            disabled: true
        },
        {
            label: '1 - 3 months',
            count: 0,
            selected: false,
            start: 160,
            end: 479,
            disabled: true
        },
        {
            label: '3+ months',
            count: 0,
            selected: false,
            start: 480,
            end: 'MAX',
            disabled: true
        }
    ];

    for(let poption of options){
        for(const esData of data){
            const entity = esData._source;
            if(poption.start !== 'MIN' && poption.end !== 'MAX'){
                if(entity[attribute] >= poption.start && entity[attribute] <= poption.end){
                    poption.count++;
                }
            }else{
                if(poption.start == 'MIN'){
                    if(entity[attribute] <= poption.end){
                        poption.count++;
                    }
                }
                if(poption.end == 'MAX'){
                    if(entity[attribute] >= poption.start){
                        poption.count++;
                    }
                }
            }           
        }
        if(poption.count > 0){
            poption.disabled = false;
        }
    }
    //options = options.filter(item => item.count > 0);
    return options;
};


const getFilterOption = (data, filter) => {
    let options = [];
    let others = null;
    for(const esData of data){
        const entity = esData._source;
        let entityData = entity[filter.elastic_attribute_name];

        if(filter.label == "Price Type" && entityData == 'emi'){
            console.log("entityData <> ", entityData);
            continue;
        }

        if(entityData){
            if(Array.isArray(entityData)){
                for(const entry of entityData){
                    if(entry == 'Free_With_Condition'){
                        continue;
                    }

                    if(entry == 'Others'){
                        if(others != null){
                            others.count++;
                        }else{
                            others = {
                                label: entry,
                                count: 1,
                                selected: false,
                                disabled: false
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
                            count: 1,
                            selected: false,
                            disabled: false
                        });
                    }
                }
            }else{
                if(entityData == 'Free_With_Condition'){
                    continue;
                }

                if(entityData == 'Others'){
                    if(others != null){
                        others.count++;
                    }else{
                        others = {
                            label: entityData,
                            count: 1,
                            selected: false,
                            disabled: false
                        }
                    }                        
                    continue;
                }

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

    if(others != null){
        options.push(others);
    }

    return options;
};

const getFilterAttributeName = (attribute_name) => {
    const keywordFields = ['topics','categories','sub_categories','title','level','learn_type','languages','medium','instruction_type','pricing_type','provider_name','skills', 'partner_name'];
    if(keywordFields.includes(attribute_name)){
        return `${attribute_name}.keyword`;
    }else{
        return attribute_name;
    }
};

const updateSelectedFilters = (filters, parsedFilters, parsedRangeFilters) => {
    for(let filter of filters){
        if(filter.filter_type == "Checkboxes"){
            let seleteddFilter = parsedFilters.find(o => o.key === filter.label);
            console.log("Selected filter for <> "+filter.label+" <> ", seleteddFilter);
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
            console.log("Selected filter for <> "+filter.label+" <> ", seleteddFilter);
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
            console.log("Selected filter for <> "+filter.label+" <> ", seleteddFilter);
            if(seleteddFilter){
                filter.min = seleteddFilter.start;
                filter.max = seleteddFilter.end;
            }
        }
    }
    console.log("parsedRangedFilters <> ", parsedRangeFilters);

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
            const keywordFields = ['title'];
            let sort = req.query['sort'];
            let splitSort = sort.split(":");
            if(keywordFields.includes(splitSort[0])){
                sort = `${splitSort[0]}.keyword:${splitSort[1]}`;
            }
            queryPayload.sort = [sort];
        }


        /* queryPayload.sort = {
            "average_rating": {
                "type": "float",
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
        let parsedRangeFilters = [];

        let filterQuery = JSON.parse(JSON.stringify(query));
        let filterQueryPayload = JSON.parse(JSON.stringify(queryPayload));
        let filters = await getAllFilters(filterQuery, filterQueryPayload, filterConfigs);

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
            parsedRangeFilters = parseQueryRangeFilters(req.query['rf']);
            console.log("parsedRangeFilters <> ", parsedRangeFilters);
            for(const filter of parsedRangeFilters){
                /* if(filter.key == "Ratings"){
                    if(filter.start !== "MIN"){
                        filter.start = filter.start*100;
                    }
                    if(filter.end !== "MAX"){
                        filter.end = filter.end*100;
                    }
                } */
                console.log("Applying filters <> ", filter);
                let elasticAttribute = filterConfigs.find(o => o.label === filter.key);
                if(elasticAttribute){
                    const attribute_name  = getFilterAttributeName(elasticAttribute.elastic_attribute_name);

                    let rangeQuery = {};
                    if(filter.start !== "MIN"){
                        rangeQuery["gte"] = (filter.key == "Ratings") ? (filter.start*100) : filter.start;
                    }
                    if(filter.end !== "MAX"){
                        rangeQuery["lte"] = (filter.key == "Ratings") ? (filter.end*100) : filter.end;
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

            /* query.bool.filter.push({
                
                "match": {
                    "title.keyword": {
                        "query": decodeURIComponent(req.query['q'])
                     } 
                    }
            }) */

            /* query.bool.must.push( 
                {
                    match: {
                        "title": decodeURIComponent(req.query['q'])
                    }
                }
            ); */

            query.bool.must.push( 
                {
                    /* "multi_match": {
                      "query": decodeURIComponent(req.query['q']),
                      "fields": ['title','slug','learn_type','categories','sub_categories','topics','provider_name','medium','instruction_type','level','languages','accessibilities','availabilities','pricing_type','finance_option','skills_gained','content','instructors','learnng_mediums','partner_name','skill_tags']
                    } */
                    "query_string" : {
                        "query" : `*${decodeURIComponent(req.query['q'])}*`,
                        "fields" : ['title','slug','learn_type','categories','sub_categories','topics','provider_name','medium','instruction_type','level','languages','accessibilities','availabilities','pricing_type','finance_option','skills_gained','content','instructors','learnng_mediums','partner_name','skill_tags'],
                        "analyze_wildcard" : true,
                        "allow_leading_wildcard": true
                    }
                }
            );
            
        }

        console.log("Final Query <> ", JSON.stringify(query));
        console.log("Final Query Payload <> ", JSON.stringify(queryPayload));

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
            //let filters = await getAllFilters(query, queryPayload, filterConfigs, result.total.value); 
            filters = updateFilterCount(filters, parsedFilters, filterConfigs, result.hits);           
            
            //update selected flags
            if(parsedFilters.length > 0 || parsedRangeFilters.length > 0){
                filters = updateSelectedFilters(filters, parsedFilters, parsedRangeFilters);
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

            let others = null;
            for(const category of categoriesData){
                if(category.key == 'Others'){
                    others = {"label": category['key'], "value": category['key']};
                }else{
                    categories.push({"label": category['key'], "value": category['key']});
                }
            }
            if(others){
                categories.push(others);
            }
            console.log("categories <> ", categories);

            /* categories = categoriesData.map(function(obj) {
                return {"label": obj['key'], "value": obj['key']};
              });

              console.log("categories <> ", categories); */
        }

        callback(null, {status: 'success', message: 'Fetched successfully!', data: categories});
    }



    async getCourseByIds(req, callback){
        let courses = [];
        let courseOrdered = [];
        let ids = [];
        if(req.query['ids']){
            ids = req.query['ids'].split(",");
        }
        if(ids.length > 0){
            const queryBody = {
                "query": {
                  "ids": {
                      "values": ids
                  }
                }
            };

            const result = await elasticService.plainSearch('learn-content', queryBody);
            if(result.hits){
                if(result.hits.hits && result.hits.hits.length > 0){
                    for(const hit of result.hits.hits){
                        const course = await this.generateSingleViewData(hit._source);
                        courses.push(course);
                    }
                    for(const id of ids){
                        let course = courses.find(o => o.id === id);
                        courseOrdered.push(course);
                    }
                }
            }            
        }
        callback(null, {status: 'success', message: 'Fetched successfully!', data: courseOrdered});
    }

    async getCourseOptionByCategories(req, callback){
        let courses = [];
        let categories = [];
        if(req.query['categories']){
            categories = req.query['categories'].split(",");
        }
        console.log("Categories <> ", categories);

        if(categories.length > 0){
            const queryBody = {
                "query": {
                    "bool": {
                        "must": [
                          {
                            "term": {
                              "status.keyword": "published"
                            }
                          }
                        ],
                        "filter": [
                            {                              
                              "terms": {
                                  "categories.keyword": categories
                              }
                            }
                          ]
                    }
                }
            };
            const result = await elasticService.plainSearch('learn-content', queryBody);
            if(result.hits){
                if(result.hits.hits && result.hits.hits.length > 0){
                    //console.log("result.hits.hits <> ", result.hits.hits);
                    courses = result.hits.hits.map(function(obj) {
                        return {"label": obj['_source']['title'], "value": `LRN_CNT_PUB_${obj['_source']['id']}`};
                      });
                }
            }
        }
        callback(null, {status: 'success', message: 'Fetched successfully!', data: courses});
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

        for(let i=0; i<result.reviews.length; i++){
            if(result.reviews[i]['reviewer_name'] == 'Other'){
                result.reviews.splice(i, 1);
            }
        }

        let cover_image = null;
        if(result.images){
            if(result.images[coverImageSize]){
                cover_image = getMediaurl(result.images[coverImageSize]);
            }else{
                cover_image = getMediaurl(result.images['thumbnail']);
            }
        }

        let data = {
            title: result.title,
            slug: result.slug,
            id: `LRN_CNT_PUB_${result.id}`,
            subtitle: result.subtitle,
            provider: {
                name: result.provider_name,
                currency: result.provider_currency,
                slug: result.provider_slug
            },
            partner: {
                name: result.partner_name,
                slug: result.partner_slug,
                partner_url: result.partner_url,
                currency: result.partner_currency
            },
            currency: (result.partner_currency) ? result.partner_currency : result.provider_currency,
            instructors: [],
            cover_video: (result.video) ? getMediaurl(result.video) : null,
            cover_image: cover_image,
            embedded_video_url: (result.embedded_video_url) ? result.embedded_video_url : null,
            description: result.description,
            skills: (!isList) ? result.skills_gained : null,
            skill_tags: (result.skills) ? result.skills : [],
            what_will_learn: (!isList) ? result.what_will_learn : null,
            target_students: (!isList) ? result.target_students : null,
            prerequisites: (!isList) ? result.prerequisites  : null,
            content: (!isList) ? result.content : null,
            categories: (result.categories) ? result.categories : [],
            categories_list: (result.categories_list) ? result.categories_list : [],
            sub_categories: (result.sub_categories) ? result.sub_categories : [],
            sub_categories_list: (result.sub_categories_list) ? result.sub_categories_list : [],
            topics_list: (result.topics_list) ? result.topics_list : [],
            course_details: {
                //duration: (result.total_duration_in_hrs) ? Math.floor(result.total_duration_in_hrs/duration_divider)+" "+duration_unit : null,
                duration: getDurationText(result.total_duration_in_hrs, result.total_duration_unit),
                total_duration_unit: result.total_duration_unit, 
                effort: effort,
                total_video_content: getDurationText(result.total_video_content_in_hrs, result.total_video_content_unit),
                total_video_content_unit: result.total_video_content_unit,
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
                    conditional_price: result.conditional_price,
                    pricing_additional_details: result.pricing_additional_details,
                    course_financing_options: result.course_financing_options,
                    finance_option: result.finance_option,
                    finance_details: result.finance_details
                }                
            },
            provider_course_url: result.provider_course_url,
            reviews: [],
            ratings: {
                total_review_count: result.reviews ? result.reviews.length : 0,
                average_rating: 0,
                average_rating_actual: 0,
                rating_distribution: []
            },
            live_class: result.live_class,
            human_interaction: result.human_interaction,
            personalized_teaching: result.personalized_teaching,
            post_course_interaction: result.post_course_interaction,
            international_faculty: result.international_faculty,
            batches: (result.batches) ? result.batches : [],
            enrollment_start_date: result.enrollment_start_date,
            enrollment_end_date: result.enrollment_end_date,
            hands_on_training: {
                learning_mediums: result.learning_mediums,
                virtual_labs: result.virtual_labs,
                case_based_learning: result.case_based_learning,
                assessments: result.assessments,
                capstone_project: result.capstone_project
            },
            placement: {
                internship: result.internship,
                job_assistance: result.job_assistance,
                alumni_network: result.alumni_network,
                placements: (result.placements) ? result.placements : [],
                average_salary: result.average_salary,
                highest_salary: result.highest_salary
            },
            corporate_sponsors: (result.corporate_sponsors) ? result.corporate_sponsors : [],
            accreditations: []
        };

        if(!isList){
            data.meta_information = {
                meta_title: result.meta_title,
                meta_description: result.meta_description,
                meta_keywords: result.meta_keywords,
                add_type: result.add_type,
                import_source: result.import_source,
                external_source_id: result.external_source_id,
                application_seat_ratio: result.application_seat_ratio,
                bounce_rate: result.bounce_rate,
                completion_ratio: result.completion_ratio,
                enrollment_ratio: result.enrollment_ratio,
                faculty_student_ratio: result.faculty_student_ratio,
                gender_diversity: result.gender_diversity,
                student_stream_diversity: result.student_stream_diversity,
                student_nationality_diversity: result.student_nationality_diversity,
                average_salary_hike: result.average_salary_hike,
                instructor_citations: result.instructor_citations
            }
        }

        if(!isList){
            if(result.instructors && result.instructors.length > 0){
                for(let instructor of result.instructors){
                    if(instructor.name == 'Other'){
                        continue;
                    }
                    if(instructor.instructor_image){
                        instructor.instructor_image = getMediaurl(instructor.instructor_image.thumbnail);                    
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

            if(result.accreditations && result.accreditations.length > 0){
                for(let accr of result.accreditations){
                    if(accr.name == 'Not Available'){
                        continue;
                    }                
                    if(!isList){
                        if(accr.logo){
                            accr.logo = getMediaurl(accr.logo.thumbnail);                    
                        }
                        data.accreditations.push(accr);
                    }
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

                let rating_round = Math.floor(review.rating);
                if(ratings[rating_round]){
                    ratings[rating_round] += 1; 
                }else{
                    ratings[rating_round] = 1; 
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
        if(data.course_details.medium == 'Others'){
            data.course_details.medium = null;
        }
        if(data.course_details.instruction_type == 'Others'){
            data.course_details.instruction_type = null;
        }
        if(data.course_details.language == 'Others'){
            data.course_details.language = null;
        }
        if(data.course_details.pricing.pricing_type == 'Others'){
            data.course_details.pricing.pricing_type = null;
        }
        if(data.content == "Dummy content."){
            data.content = null;
        }
        if(data.skills && data.skills.length > 0){
            for(let i=0; i<data.skills.length; i++){
                if(data.skills[i] == 'Others'){
                    data.skills.splice(i, 1);
                }
            }
        } 

        if(result.partner_currency){
            data.provider.currency = result.partner_currency.iso_code;
        }

        return data;
    }



    async generateListViewData(rows){
        let datas = [];
        for(let row of rows){
            const data = await this.generateSingleViewData(row._source, true);
            datas.push(data);
        }
        return datas;
    }


}