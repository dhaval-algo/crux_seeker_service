const fetch = require("node-fetch");
const _ = require('underscore');
const elasticService = require("../services/elasticService");
const apiBackendUrl = process.env.API_BACKEND_URL;
const pluralize = require('pluralize')
const { Engine } = require('json-rules-engine')
const metaInfo = require('../utils/metaInfo')

const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();
const MAX_RESULT = 10000;
const ENTRY_PER_PAGE = 25;
const FILTER_VALUES_SEPERATOR = "<>";

const entity_filter_mapping = {
    'learn-content': 'Learn_Content',
    'provider': 'Provider',
    'article': 'Article'
};

const getUserCurrency = async(request) => {
    let currency = request.query.currency;
    if(!currency){
        currency = process.env.DEFAULT_CURRENCY;
    }
    return currency;
  }

  const getCurrencies = async (useCache = true) => {

    let cacheKey = "get-currencies-backend";
    if(useCache){
        let cachedData = await RedisConnection.getValuesSync(cacheKey);
        if(cachedData.noCacheData != true) {
           return cachedData;
        }
    }

    let response = await fetch(`${process.env.API_BACKEND_URL}/currencies`);
    if (response.ok) {
        let json = await response.json();
        if(json && json.length){
            RedisConnection.set(cacheKey, json);
            return json;
        }else{
            return [];
        }    
    } else {
        return [];
    }
};

const getCurrencyAmount = (amount, currencies, baseCurrency, userCurrency) => {
    if(amount == 0){
        return 0;
    }
    if(!amount){
        return null;
    }
    if(!userCurrency){
        userCurrency = process.env.DEFAULT_CURRENCY;
    }
    if(baseCurrency == userCurrency){
        return Math.round(amount);
    }
    let currency_b = currencies.find(o => o.iso_code === baseCurrency);
    if(!currency_b){
        currency_b = currencies.find(o => o.iso_code === process.env.DEFAULT_CURRENCY);
    }
    let currency_u = currencies.find(o => o.iso_code === userCurrency);
    if(baseCurrency == 'USD'){
        amount = currency_u.conversion_rate*amount;
    }else if(userCurrency == 'USD'){
        amount = amount/currency_b.conversion_rate;
    }else {
        const baseAmount = currency_u.conversion_rate*amount;
        amount = baseAmount/currency_b.conversion_rate;
    }
    return Math.round(amount);
};


const FILTER_CONFIG_CACHE_KEY = "get-filter-confings-backend";
const getFilterConfigs = async (entity_type) => {
    let cachedData = await RedisConnection.getValuesSync(`${FILTER_CONFIG_CACHE_KEY}-${entity_type}`);
    if(cachedData.noCacheData != true) {
       return cachedData;
    }

    return await module.exports.getFilterConfigsUncached(entity_type);
};

const getFilterConfigsUncached = async (entity_type) => {
    
    let response = await fetch(`${apiBackendUrl}/entity-facet-configs?entity_type=${entity_type}&filterable_eq=true&_sort=order:ASC`);
    if (response.ok) {
    let json = await response.json();
    RedisConnection.set(`${FILTER_CONFIG_CACHE_KEY}-${entity_type}`, json);
    return json;
    } else {
        return [];
    }
}

const getRankingBySlug = async (slug) => {
    let response = await fetch(`${apiBackendUrl}/rankings?slug_eq=${slug}`);
    if (response.ok) {
    let rankings = await response.json();
    if(rankings.length > 0){
        return rankings[0];
    }else{
        return null;
    }
    } else {
        return null;
    }
};

const getRankingFilter = async (useCache = true) => {

    let cacheKey = "ranking-filter";
    if(useCache){
        let cachedData = await RedisConnection.getValuesSync(cacheKey);
        if(cachedData.noCacheData != true) {
           return cachedData;
        }
    }
    
    let response = await fetch(`${apiBackendUrl}/rankings?visible_eq=true&custom_eq=false&_sort=name:ASC`);
        if (response.ok) {
        let rankings = await response.json();
        let rankingFilter = {
            label: 'Ranking',
            filterable: true,
            is_collapsed: true,
            filter_type: 'Checkboxes',
            options: []
        };
    
        rankings = rankings.sort(function(a,b) {
            let ac = a.name.toLowerCase();
            let bc = b.name.toLowerCase();
            if (ac == bc) return 0;
            if (ac > bc) return 1;
            return -1;
        });
    
    
        for(const rank of rankings){
            rankingFilter.options.push({
                label: rank.name,
                slug: rank.slug,
                count: 0,
                selected: false,
                disabled: false
            });
        }
        RedisConnection.set(cacheKey, rankingFilter);
        return rankingFilter;
        } else {
            return [];
        }

};

const parseQueryFilters = (filter) => {
    const parsedFilterString = decodeURIComponent(filter);
    let query_filters = [];
    const filterArray = parsedFilterString.split("::");
    for(const qf of filterArray){
        const qfilters = qf.split(":");
        query_filters.push({
            key: qfilters[0],
            value: qfilters[1].split(FILTER_VALUES_SEPERATOR)
        });
    }
    return query_filters;
};


const round = (value, step) => {
    step || (step = 1.0);
    var inv = 1.0 / step;
    return Math.round(value * inv) / inv;
};

const getPaginationQuery = (query) => {
    let page = 1;
    let size = ENTRY_PER_PAGE;
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

const getPaginationDefaultSize = () => {
    return ENTRY_PER_PAGE;
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

const getAllResult = async(entity, query, fields = null) => {
    const result = await elasticService.search(entity, query, {from: 0, size: MAX_RESULT},fields);
        if(result.total && result.total.value > 0){
            return result.hits;
        }else{
            return [];
        }
};

const calculateFilterCount = async(filters, parsedFilters, filterConfigs, entity, result, totalCount, query, allowZeroCountFields = [], parsedRangeFilters = []) => {
    if(parsedFilters.length <= 0 && parsedRangeFilters.length <= 0){
        return filters;
    }

    let fields = filterConfigs.map((filter)=> filter.elastic_attribute_name);

    let data = [];
    if(totalCount > ENTRY_PER_PAGE){
        data = await getAllResult(entity, query, fields); //elastic
    }else{
        data = result;
    }

    for(let filter of filters){
        if(filter.filter_type !== 'Checkboxes'){
            continue;
        }

        //if(!parsedFilter){
            for(let option of filter.options){
                option.count = 0;
                let elasticAttribute = filterConfigs.find(o => o.label === filter.label);
                    if(!elasticAttribute){
                        continue;
                    }
                    if(data && data.length > 0){
                        //console.log("Data found...", data);
                        for(const esData of data){
                    
                            const entity = esData._source; 
                            let entityData = entity[elasticAttribute.elastic_attribute_name];
                            if(entityData){
                                let checkField = option.label;
                                if(elasticAttribute.elastic_attribute_name == 'author_slug')
                                {
                                    checkField = option.author_slug;
                                }
                                if(Array.isArray(entityData)){
                                    if(entityData.includes(checkField)){
                                        option.count++;
                                    }
                                }else{
                                    if(entityData == checkField){
                                        option.count++;
                                    }
                                }
                            }
                        }
                    }else{
                        //console.log("Setting count to 0000");
                        option.count = 0;
                    }                
                if(option.count == 0 && !(allowZeroCountFields.includes(filter.field))){
                    option.disabled = false; //true
                }
            }
        //}

        filter.options = filter.options.filter(function( obj ) {
            return !obj.disabled;
          });
    }
    return filters;
};

const updateFilterCount = (filters, parsedFilters, filterConfigs, data, allowZeroCountFields = []) => {
    if(parsedFilters.length <= 0){
        return filters;
    }
    for(let filter of filters){
        if(filter.filter_type !== 'Checkboxes'){
            continue;
        }
        let parsedFilter = parsedFilters.find(o => o.key === filter.label);
        //if(!parsedFilter){
            for(let option of filter.options){
                option.count = 0;
                let elasticAttribute = filterConfigs.find(o => o.label === filter.label);
                    if(!elasticAttribute){
                        continue;
                    }
                    if(data && data.length > 0){
                        //console.log("Data found...", data);
                        for(const esData of data){
                    
                            const entity = esData._source; 
                            if(entity[elasticAttribute]){
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
                        }
                    }else{
                        //console.log("Setting count to 0000");
                        option.count = 0;
                    }                
                if(option.count == 0 && !(allowZeroCountFields.includes(filter.field))){
                    option.disabled = false;
                }
            }
        //}

        filter.options = filter.options.filter(function( obj ) {
            return !obj.disabled;
          });
    }
    return filters;
};


const getFilterAttributeName = (attribute_name, filterFields) => {
    if(filterFields.includes(attribute_name)){
        return `${attribute_name}.keyword`;
    }else{
        return attribute_name;
    }
};

const updateSelectedFilters = (filters, parsedFilters, parsedRangeFilters) => {
    for(let filter of filters){
        if(filter.filter_type == "Checkboxes"){
            let seleteddFilter = parsedFilters.find(o => o.key === filter.label);
            if(seleteddFilter && filter.options){
                for(let option of filter.options){
                    let checkField = option.label;
                    if(filter.field == 'author_slug')
                    {
                        checkField = option.author_slug;
                    }
                    if(seleteddFilter.value.includes(checkField)){
                        option.selected = true;
                    }
                }
            }
            //Sorting options
            filter.options = sortFilterOptions(filter.options);
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
};



const sortFilterOptions = (options) => {
    if(options.length){
        options = _.sortBy( options, 'count' ).reverse();
    }
    return options;
};


const getUserFromHeaders = async(headers) => {
    let user = null;
    const authHeader = headers.authorization;
    const audience = headers.origin;
    let options = {
        issuer: process.env.HOST,
        audience: audience,
        algorithm:  ["RS256"],
    }
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        const verifiedToken = await require("../../services/auth/auth").verifyToken(token, options);
        if(verifiedToken) {
            user = verifiedToken.user
        }
    }
    return user;
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

const generateMetaInfo = async (page, result, list) => {
    let meta_information = null;
    let meta_keywords = null;
    let meta_title = null;
    let meta_description = null;
    
    switch (page) {
        case 'learn-content':
            meta_title = `${result.title} | ${result.partner_name}`;
            
            meta_information = {
                meta_title: meta_title,
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
            break;
        case 'learn-content-list':
            meta_information = metaInfo.getLearnContentListMetaInfo(result);
            break;
        case 'provider':
            meta_information = metaInfo.getProviderMetaInfo(result);
            break;
        case 'provider-list':
            meta_information = metaInfo.getProviderListMetaInfo(list);
            break;

        case 'partner' :
            meta_information = metaInfo.getPartnerMetaInfo(result);
            break;

        case 'trending-now' :
            
            meta_information = await metaInfo.getTrendingNowMetaInfo(result);
            break;
        case 'article':
            meta_title = `${result.title} | ${process.env.SITE_URL_FOR_META_DATA}`;
            if(result.short_description)
            {
                meta_description = result.short_description;
                let position = meta_description.indexOf(".")
                if(position >0 )  
                {
                    meta_description =  meta_description.substring(0, position);
                }
            }
            
            keywords =[result.title]
            if(result.categories){
                keywords = [...keywords, ...result.categories];
            }
            keywords.push(`${result.author_first_name} ${result.author_last_name}`);
            keywords = [...keywords, ...result.tags];
            
            extra_keyword = [ "careervira advice", "online marketplace", "learn content", "courses near me", "courses near me", "careervira articles", "english courses", "free articles", "learning advice", "institute advice", "ranking articles", "ranking advice", "career advice", "career path", "top courses", "experts", "top professionals", "industry experts", "careervira content", "institutes", "degrees", "certifications", "courses"];
            keywords = [...keywords, ...extra_keyword];
            
            if(keywords.length > 0){
                keywords = [...new Set(keywords)];
                 meta_keywords = keywords.join(", ");
            }
            meta_information = {
                meta_title: meta_title,
                meta_description: meta_description,
                meta_keywords: meta_keywords
            }
            break;
        case 'article-list':
            meta_information = metaInfo.getArticleListMetaInfo(result);
            break;
        default:
            break;
    }
    
    return meta_information;
}

const compareRule = async (rule,engineEvent,facts) =>{

    return new Promise(async (resolve, reject) => {
        try{
            let engine = new Engine()

            engine.addRule({
              conditions: rule,
              event: engineEvent
            })
            // Run the engine to evaluate
            engine.run(facts).then(results => {
                if(results.events.length > 0){                        

                    results.events.map(event => {
                        if(event.type == "success")
                            return resolve(true)
                        else
                            return resolve(false)    
                    })
                }
                else{
                    return resolve(false)
                }
            })
        }
        catch(err){
            console.log("err",err)
            return reject(err)
        }
    })
}

const paginate = async (array, page_number, page_size) => {
    return array.slice((page_number - 1) * page_size, page_number * page_size);
  }

const formatResponseField = (requestedfields, data) => {
    let finalData = {}
    fields = requestedfields.split(",");
    if(fields.includes("list"))
    {
        fields = [...fields, 'filters', 'pagination', 'sort'];

    }
    for (let field of fields)
    {
        if(field.includes("::"))
        {
            let subFields = field.split("::");
            let subFieldKey = subFields[0];
            let subFieldArr = subFields[1].split(":");
           if(Array.isArray(data[subFieldKey])){
                let i=0
                for(let arrayData of data[subFieldKey])
                {
                    for(let subField of subFieldArr)
                    {
                        if(!finalData[subFieldKey])  finalData[subFieldKey] = []
                        if(!finalData[subFieldKey][i])  finalData[subFieldKey][i] = {}
                        finalData[subFieldKey][i][subField] =  data[subFieldKey][i][subField] 
                    }

                    i++
                }
                
            }
            else{
                for(let subField of subFieldArr)
                {
                    if(!finalData[subFieldKey])  finalData[subFieldKey] = {}
                    finalData[subFieldKey][subField] =  data[subFieldKey][subField] 
                }
            }
            
        }
        else
        {
            if(Array.isArray(data))
            {
                let i=0
                finalData = []
                for(let arrayData of data)
                {
                    if(!finalData[i]) finalData[i] ={}
                    finalData[i][field] =  arrayData[field] 
                    
                    i++
                }
            }
            else {
                finalData[field] =  data[field]
            }
            
        }
    }
    return finalData
}

const formatImageResponse = (imageObject) => {
    let image = null
   if(imageObject.large) image = imageObject.large
   else if (imageObject.medium) image = imageObject.medium
   else if (imageObject.small) image = imageObject.small
   else if (imageObject.thumbnail) image = imageObject.thumbnail
   else if(imageObject.formats)
   {
        if(imageObject.formats.large && imageObject.formats.large.url) image = imageObject.formats.large.url
        else if (imageObject.formats.medium && imageObject.formats.medium.url) image = imageObject.formats.medium.url
        else if (imageObject.formats.small && imageObject.formats.small.url) image = imageObject.formats.small.url
        else if (imageObject.formats.thumbnail && imageObject.formats.thumbnail.url) image = imageObject.formats.thumbnail.url
   }
   return image
}


  module.exports = {
    getUserCurrency,
    getCurrencies,
    getCurrencyAmount,
    getFilterConfigs,
    getFilterConfigsUncached,
    parseQueryFilters,
    round,
    getPaginationQuery,
    getPaginationDefaultSize,
    getMediaurl,
    updateFilterCount,
    getFilterAttributeName,
    updateSelectedFilters,
    getRankingFilter,
    getRankingBySlug,
    sortFilterOptions,
    getUserFromHeaders,
    calculateFilterCount,
    generateMetaInfo,
    compareRule,
    paginate,
    formatResponseField,
    formatImageResponse
}



