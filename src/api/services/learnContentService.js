const elasticService = require("./elasticService");
const fetch = require("node-fetch");
const pluralize = require('pluralize')
const { getCurrencies, getCurrencyAmount } = require('../utils/general');

const { 
    getFilterConfigs, 
    parseQueryFilters,
    getPaginationQuery,
    getMediaurl,
    updateFilterCount,
    calculateFilterCount,
    getFilterAttributeName,
    updateSelectedFilters,
    sortFilterOptions
} = require('../utils/general');

const apiBackendUrl = process.env.API_BACKEND_URL;

let slugMapping = [];
let currencies = [];
const rangeFilterTypes = ['RangeSlider','RangeOptions'];
const MAX_RESULT = 10000;
const filterFields = ['topics','categories','sub_categories','title','level','learn_type','languages','medium','instruction_type','pricing_type','provider_name','skills', 'partner_name'];
const allowZeroCountFields = ['level','categories','sub_categories'];

const helperService = require("../../utils/helper");

/* const getFilterConfigs = async () => {
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
}; */

const getBaseCurrency = (result) => {
    return (result.partner_currency) ? result.partner_currency.iso_code : result.provider_currency;
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

/* const getPaginationQuery = (query) => {
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
}; */

/* const parseQueryFilters = (filter) => {
    const parsedFilterString = decodeURIComponent(filter);
    let query_filters = [];
    const filterArray = parsedFilterString.split("::");
    for(const qf of filterArray){
        const qfilters = qf.split(":");
        query_filters.push({
            key: qfilters[0],
            value: qfilters[1].split(",")
        });
    }
    return query_filters;
}; */

const parseQueryRangeFilters = (filter) => {
    const parsedFilterString = decodeURIComponent(filter);
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
    return query_filters;
};

const getDurationText = (duration, duration_unit) => {
    if(!duration){
        return null;
    }
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

const getAllFilters = async (query, queryPayload, filterConfigs, userCurrency) => {
        if(queryPayload.from !== null && queryPayload.size !== null){
            delete queryPayload['from'];
            delete queryPayload['size'];
        }
        //queryPayload.from = 0;
        //queryPayload.size = count;
        //console.log("queryPayload <> ", queryPayload);        
        const result = await elasticService.search('learn-content', query, {from: 0, size: MAX_RESULT});
        if(result.total && result.total.value > 0){
            //return formatFilters(result.hits, filterConfigs, query, userCurrency);
            return {
                filters: await formatFilters(result.hits, filterConfigs, query, userCurrency),
                total: result.total.value
            };
        }else{
            //return [];
            return {
                filters: [],
                total: result.total.value
            }
        }
};

const getInitialData = async (query) => {
    delete query.bool['filter'];
    for(let i=0; i<query.bool.must.length; i++){
         if(query.bool.must[i]["range"]){
                query.bool.must.splice(i, 1);
        }
    } 
    const result = await elasticService.search('learn-content', query, {from: 0, size: MAX_RESULT});
    if(result.total && result.total.value > 0){
        return result.hits;
    }else{
        return [];
    }
};

const formatFilters = async (data, filterData, query, userCurrency) => {
    let filters = [];
    const initialData = await getInitialData(query);
    let emptyOptions = [];
    for(const filter of filterData){

        let formatedFilters = {
            label: filter.label,
            field: filter.elastic_attribute_name,
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
                const maxValue = getMaxValue(initialData, filter.elastic_attribute_name, userCurrency);
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
        filters = filters.filter(function( obj ) {
            return !emptyOptions.includes(obj.label);
          });
    }

    return filters;    
};

const getMaxValue = (data, attribute, userCurrency) => {
    let maxValue = 0;
    for(const esData of data){
        const entity = esData._source;
        /* const baseCurrency = getBaseCurrency(entity);
        const convertedAmount = getCurrencyAmount(entity[attribute], currencies, baseCurrency, userCurrency);
        if(convertedAmount > maxValue){
            maxValue = convertedAmount;
        } */
        if(entity[attribute] > maxValue){
            maxValue = entity[attribute];
        }
    }
    if(maxValue > 0){
        maxValue = getCurrencyAmount(maxValue, currencies, process.env.DEFAULT_CURRENCY, userCurrency);
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
            label: 'Less than a week',
            count: 0,
            selected: false,
            start: 'MIN',
            end: 168,
            disabled: true
        },
        {
            label: '1 - 4 weeks',
            count: 0,
            selected: false,
            start: 168,
            end: 672,
            disabled: true
        },
        {
            label: '1 - 3 months',
            count: 0,
            selected: false,
            start: 672,
            end: 2016,
            disabled: true
        },
        {
            label: '3+ months',
            count: 0,
            selected: false,
            start: 2016,
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
            //console.log("entityData <> ", entityData);
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

    options = sortFilterOptions(options);
    return options;
};


/* const getFilterAttributeName = (attribute_name) => {
    const keywordFields = ['topics','categories','sub_categories','title','level','learn_type','languages','medium','instruction_type','pricing_type','provider_name','skills', 'partner_name'];
    if(keywordFields.includes(attribute_name)){
        return `${attribute_name}.keyword`;
    }else{
        return attribute_name;
    }
}; */

/* const updateSelectedFilters = (filters, parsedFilters, parsedRangeFilters) => {
    for(let filter of filters){
        if(filter.filter_type == "Checkboxes"){
            let seleteddFilter = parsedFilters.find(o => o.key === filter.label);
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
            if(seleteddFilter){
                filter.min = seleteddFilter.start;
                filter.max = seleteddFilter.end;
            }
        }
    }

    return filters;
}; */


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

const getFiltersModified = async (result,filters) => {
    for(let i=0;i<filters.length;i++){
        let label = filters[i].field;
        for(let j=0;j<filters[i].options.length;j++){
            let value = filters[i].options[j].label;

        }
    }
    let cnt = 0;
    for(let i=0;i<result.hits.length;i++){
        if(result.hits[i]._source.level=="Advanced"){
            cnt++;
        }
    }
    return cnt;
}


/* const updateFilterCount = (filters, parsedFilters, filterConfigs, data) => {
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
}; */

module.exports = class learnContentService {

    async getLearnContentList(req, callback){
        currencies = await getCurrencies();

        slugMapping = getSlugMapping(req);

        const filterConfigs = await getFilterConfigs('Learn_Content');
        const query = { 
            "bool": {
                //"should": [],
                "must": [
                    {term: { "status.keyword": 'published' }}                
                ],
                //"filter": []
            }
        };

        let queryPayload = {};
        let paginationQuery = await getPaginationQuery(req.query);
        queryPayload.from = paginationQuery.from;
        queryPayload.size = paginationQuery.size;

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


        let slugs = [];
        if(req.query['slug']){
            slugs = req.query['slug'].split(",");
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

        let filterResponse = await getAllFilters(filterQuery, filterQueryPayload, filterConfigs, req.query['currency']);
        //let filters = await getAllFilters(filterQuery, filterQueryPayload, filterConfigs, req.query['currency']);
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
                    for(const fieldValue of filter.value){
                        query.bool.must.push({
                            "term": {[attribute_name]: fieldValue}
                        });
                    }
                }
            }
        }
        
        if(req.query['rf']){
            parsedRangeFilters = parseQueryRangeFilters(req.query['rf']);
            for(const filter of parsedRangeFilters){
                /* if(filter.key == "Ratings"){
                    if(filter.start !== "MIN"){
                        filter.start = filter.start*100;
                    }
                    if(filter.end !== "MAX"){
                        filter.end = filter.end*100;
                    }
                } */
                let elasticAttribute = filterConfigs.find(o => o.label === filter.key);
                if(elasticAttribute){
                    const attribute_name  = getFilterAttributeName(elasticAttribute.elastic_attribute_name, filterFields);

                    let rangeQuery = {};
                    if(filter.start !== "MIN"){
                        let startValue = (filter.key == "Ratings") ? (filter.start*100) : filter.start;
                        if(filter.key == 'Price'){
                            startValue = getCurrencyAmount(startValue, currencies, req.query['currency'], 'USD');                            
                        }
                        rangeQuery["gte"] = startValue;
                    }
                    if(filter.end !== "MAX"){
                        let endValue = (filter.key == "Ratings") ? (filter.end*100) : filter.end;
                        if(filter.key == 'Price'){
                            endValue = getCurrencyAmount(endValue, currencies, req.query['currency'], 'USD');
                            rangeQuery["lte"] = endValue;
                        }else{
                            rangeQuery["lt"] = endValue;
                        }
                        
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
            query.bool.must.push( 
                {
                    "query_string" : {
                        "query" : `*${decodeURIComponent(req.query['q'])}*`,
                        "fields" : ['title','categories','sub_categories','provider_name','level','learning_mediums','partner_name'],
                        "analyze_wildcard" : true,
                        "allow_leading_wildcard": true
                    }
                }
            );
            
        }

        console.log("Final Query <> ", JSON.stringify(query));
        console.log("Final Query Payload <> ", JSON.stringify(queryPayload));

        const result = await elasticService.search('learn-content', query, {from: 0, size: MAX_RESULT});
        if(result.total && result.total.value > 0){

            const list = await this.generateListViewData(result.hits, req.query['currency']);

            let pagination = {
                page: paginationQuery.page,
                count: list.length,
                perPage: paginationQuery.size,
                totalCount: result.total.value,
                total: filterResponse.total
              }

            //let filters = await getFilters(result.hits, filterConfigs);
            //let filters = await getAllFilters(query, queryPayload, filterConfigs, result.total.value); 
            //filters = updateFilterCount(filters, parsedFilters, filterConfigs, result.hits);           
            
            //update selected flags
            if(parsedFilters.length > 0 || parsedRangeFilters.length > 0){
                //filters = updateFilterCount(filters, parsedFilters, filterConfigs, result.hits, allowZeroCountFields); 
                filters = await calculateFilterCount(filters, parsedFilters, filterConfigs, 'learn-content', result.hits, filterResponse.total, query, allowZeroCountFields, parsedRangeFilters);
                filters = updateSelectedFilters(filters, parsedFilters, parsedRangeFilters);
            }

            //Remove filters if requested by slug
            for(let i=0; i<slugs.length; i++){
                const config = filterConfigs.find(o => o.elastic_attribute_name === slugMapping[i].elastic_key);
                if(config){
                    filters = filters.filter(o => o.label !== config.label);
                }
            }

            if(req.query['q'] && parsedFilters.length == 0 && parsedRangeFilters.length == 0){
                console.log('Resssssssssssssss',result.hits.length);
                const queryBody22 = {
                    "size": 100,
                    "from": 0,
                    "query": {
                      "bool": {
                        "must": [
                          {"term":{"status":"published"}},
                          {
                            "query_string": {
                              "query": "title:marketing",
                              "fields": ["title","categories","sub_categories","provider_name","level","learning_mediums","partner_name"],
                              "analyze_wildcard":true,
                              "allow_leading_wildcard":true
                            }
                          }
                        ]
                      }
                    }
                };
                const result55 = await elasticService.plainSearch('learn-content', queryBody22);
                if(result55.hits){
                    if(result55.hits.hits && result55.hits.hits.length > 0){
                      //  filters = await formatFilters(result.hits.hits, filterConfigs, queryBody22, req.query['currency'])
                      //  let ad_cnt = await getFiltersModified(result55.hits,filters);
                     //   console.log("AAAAAAAAdv_cntttttttttttttttttttttttt",ad_cnt);
                    }
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
            //update selected flags
            if(parsedFilters.length > 0 || parsedRangeFilters.length > 0){
                //filters = updateFilterCount(filters, parsedFilters, filterConfigs, result.hits, allowZeroCountFields);
                filters = await calculateFilterCount(filters, parsedFilters, filterConfigs, 'learn-content', result.hits, filterResponse.total, query, allowZeroCountFields, parsedRangeFilters);
                filters = updateSelectedFilters(filters, parsedFilters, parsedRangeFilters);
            }
            callback(null, {status: 'success', message: 'No records found!', data: {list: [], pagination: {total: filterResponse.total}, filters: filters}});
        }        
    }

    async getLearnContent(req, callback){
        const slug = req.params.slug;
        //const currency = await getUserCurrency(req);
        currencies = await getCurrencies();

        const course = await this.fetchCourseBySlug(slug);
        if(course){
            const data = await this.generateSingleViewData(course, false, req.query.currency);
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data});
        }else{
            callback({status: 'failed', message: 'Not found!'}, null);
        }        
    }

    async fetchCourseBySlug(slug) {
        const query = { "bool": {
            "must": [
              {term: { "slug.keyword": slug }},
              {term: { "status.keyword": 'published' }}
            ]
        }};
        let result = await elasticService.search('learn-content', query);
        if(result.hits && result.hits.length > 0) {
            return result.hits[0]._source;
        } else {
            return null;
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

        if(result.aggregations){
            let categoriesData = result.aggregations.categories.buckets;
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

            /* categories = categoriesData.map(function(obj) {
                return {"label": obj['key'], "value": obj['key']};
              });

              console.log("categories <> ", categories); */
        }

        callback(null, {status: 'success', message: 'Fetched successfully!', data: categories});
    }



    async getCourseByIds(req, callback){
        if(currencies.length == 0){
            currencies = await getCurrencies();
        }
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
                        const course = await this.generateSingleViewData(hit._source, false, req.query.currency);
                        courses.push(course);
                    }
                    for(const id of ids){
                        let course = courses.find(o => o.id === id);
                        courseOrdered.push(course);
                    }
                }
            }            
        }
        if(callback){
            callback(null, {status: 'success', message: 'Fetched successfully!', data: courseOrdered});
        }else{
            return courseOrdered;
        }
        
    }

    async getCourseOptionByCategories(req, callback){
        let courses = [];
        let categories = [];
        if(req.query['categories']){
            categories = req.query['categories'].split(",");
        }

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


    async generateSingleViewData(result, isList = false, currency=process.env.DEFAULT_CURRENCY){
        if(currencies.length == 0){
            currencies = await getCurrencies();
        }
        const baseCurrency = getBaseCurrency(result);        

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

        let partnerPrice = helperService.roundOff(result.finalPrice, 2);   //final price in ES
        let partnerPriceInUserCurrency = parseFloat(getCurrencyAmount(result.finalPrice, currencies, baseCurrency, currency));
        let conversionRate = helperService.roundOff((partnerPrice / partnerPriceInUserCurrency), 2);
        let tax = 0.0;
        let canBuy = false;
        if(result.partner_currency.iso_code === "INR") {
            canBuy = true;
            tax = helperService.roundOff(0.18 * partnerPrice, 2);
        }
        let data = {
            canBuy: canBuy,
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
                duration: getDurationText(result.total_duration, result.total_duration_unit),
                instructor_duration:result.avg_session_duration_with_instructor,
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
                    base_currency: baseCurrency,
                    user_currency: currency,
                    regular_price: getCurrencyAmount(result.regular_price, currencies, baseCurrency, currency),
                    sale_price: getCurrencyAmount(result.sale_price, currencies, baseCurrency, currency),
                    offer_percent: (result.sale_price) ? (Math.round(((result.regular_price-result.sale_price) * 100) / result.regular_price)) : null,
                    schedule_of_sale_price: result.schedule_of_sale_price,
                    free_condition_description: result.free_condition_description,
                    conditional_price: getCurrencyAmount(result.conditional_price, currencies, baseCurrency, currency),
                    pricing_additional_details: result.pricing_additional_details,
                    course_financing_options: result.course_financing_options,
                    finance_option: result.finance_option,
                    finance_details: result.finance_details,
                    partnerPrice: partnerPrice,
                    partnerPriceInUserCurrency: partnerPriceInUserCurrency,
                    partnerRegularPrice: helperService.roundOff(result.regular_price, 2),
                    partnerSalePrice: helperService.roundOff(result.sale_price, 2),
                    conversionRate: conversionRate,
                    tax: tax
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
            accreditations: [],
            ads_keywords:result.ads_keywords
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

        if(result.custom_ads_keywords) {
            data.ads_keywords +=`,${result.custom_ads_keywords}` 
        }

        return data;
    }



    async generateListViewData(rows, currency){
        if(currencies.length == 0){
            currencies = await getCurrencies();
        }
        let datas = [];
        for(let row of rows){
            const data = await this.generateSingleViewData(row._source, true, currency);
            datas.push(data);
        }
        return datas;
    }

    /** Creates order data with single payment mode */
    async createOrderData(userId, userMeta, address, course, orderType, coursePrice, tax, currency, paymentGateway, transactionId, timezone) {
        let orderData = {};

        let regularPrice = parseFloat(course.regular_price);
        let salePrice = course.sale_price ? parseFloat(course.sale_price) : 0.0;
        
        orderData = {
            order_id: "ODR" + helperService.generateReferenceId(),
            user_id: userId,
            order_type: orderType,
            partner: course.partner_id,
            amount: coursePrice + tax,
            status: "pending_payment",
            order_items: [
                {
                    item_id: course.id,
                    item_name: course.title,
                    item_description: course.description,
                    qty: 1,
                    item_price: helperService.roundOff(regularPrice, 2),
                    discount: helperService.roundOff(regularPrice - salePrice, 2),
                    tax: tax,
                    item_total: coursePrice + tax
                }
            ],
            order_customer: {
                first_name: (userMeta.firstName) ? userMeta.firstName : null,
                last_name: (userMeta.lastName) ? userMeta.lastName : null,
                email: (userMeta.email) ? userMeta.email : null,
                phone: (userMeta.phone) ? userMeta.phone : null,
                address: (address) ? address : null,
                timezone: (timezone) ? timezone : null
            },
            order_payment: {
                gateway: paymentGateway,
                transaction_id: transactionId,
                amount: coursePrice + tax,
                currency: currency,
                status: null,
                reject_reason: null
            }
        }

        return orderData;
    }
}