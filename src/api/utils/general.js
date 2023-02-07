const fetch = require("node-fetch");
const _ = require('underscore');
const elasticService = require("../services/elasticService");
const apiBackendUrl = process.env.API_BACKEND_URL;
const pluralize = require('pluralize')
const { Engine } = require('json-rules-engine')
const metaInfo = require('../utils/metaInfo')
const axios = require("axios");

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

const isDateInRange = (lowDate, highDate) => {
    const l = new Date(lowDate), h = new Date(highDate), d = new Date()
    
    if(l <= d && d <= h)
        return true
    
    return false
}
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
    
    // replacing basePriceRound with default_price

        if (entity_type == 'Learn_Content' || entity_type == 'Learn_Path') {
            for (const filter of json) {
                if (filter.elastic_attribute_name == "basePriceRound") {
                    filter.elastic_attribute_name = "default_price";
                    filter.entity_attribute_path = "default_price";
                }
            }
        }
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
            filter_postion: 'vertical',   
            is_collapsed: false,
            filter_type: 'Checkboxes',
            order: 2,
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
                disabled: false,
                image: rank.image ? formatImageResponse (rank.image): null,
                logo: rank.logo ? formatImageResponse (rank.logo) :null
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
    if(options.length)
        options = _.sortBy( options, 'count' ).reverse();

    return options;
};


// generic getAllfilters from specified index
const getAllFilters = async (index, query, queryPayload, filterConfigs) => {

    if(queryPayload.from !== null && queryPayload.size !== null)
    {
        delete queryPayload['from'];
        delete queryPayload['size'];
    }


    let fields = filterConfigs.map((filter)=> filter.elastic_attribute_name);

    const result = await elasticService.search(index, query, {from: 0, size: MAX_RESULT},fields);
    if(result.total && result.total.value > 0)
    {
        return {
            filters: await formatFilters(result.hits, filterConfigs),
            total: result.total.value };
    }
    return { filters: [] , total: 0 };
};


const formatFilters = async (data, filterData) => {

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

        if(filter.filter_type !== 'RangeSlider')
        {
            if(formatedFilters.options.length <= 0)
                emptyOptions.push(filter.label);

        }

        filters.push(formatedFilters);
    }

    if(emptyOptions.length > 0)
    {
        filters = filters.filter(function( obj ) {
            return !emptyOptions.includes(obj.label);
          });
    }
    return filters;
};


const getFilterOption = (data, filter) =>
{
    let options = [];
    for(const esData of data){
        const entity = esData._source;
        let entityData = entity[filter.elastic_attribute_name];
        if(entityData)
        {
            if(Array.isArray(entityData))
            {
                for(const entry of entityData)
                {
                    let existing = options.find(o => o.label === entry);
                    if(existing)
                        existing.count++;
                    else
                    {
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
                if(existing)
                    existing.count++;
                else
                {
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

const countCheck = (format) => {
    let counter = 0;
    for(let i = 0;i < format.length;i++){
        if(format[i] != ' '){
            counter++;
        }
    }
    return counter;
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

   if(!imageObject)
        return null;
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
   else if(imageObject.url) image = imageObject.url;
   return image
}
const formatCount = (count) => {
if(count > 1000){
    count = Math.floor(count/1000)+'k';
  }else if(count > 100){
    count = Math.floor(count/100)*100;
  }else if(count > 10){
    count = Math.floor(count/10)*10;
  }else if(count > 5){
    count = Math.floor(count/5)*5;
  }
  return count
}

const getlistPriceFromEcom = async (list, type, countryCode) => {
    if(typeof countryCode == "undefined")
    {
        return list
    }

    //remove this code after testing
    // let testIds,count
    // switch (type) {
    //     case "learn_content":
    //         testIds =  [3,501]
    //         count = 0
    //         list.map(item=> {
               
    //             let id = (item._source)? item._source.id: item.id
    //             let is_subscription = (count < 4)? false: true
    //             if (typeof id === 'string' && id.includes("LRN_CNT_PUB_")) {
    //                 if(item._source)
    //                 {
    //                     item._source.id = "LRN_CNT_PUB_"+testIds[count]
    //                     item._source.subscription_price = is_subscription
    //                 }else
    //                 {
    //                     item.id = "LRN_CNT_PUB_"+testIds[count]
    //                     item.is_subscription = is_subscription
    
    //                 }
    //             }else{
    //                 if(item._source)
    //                 {
    //                     item._source.id = testIds[count]
    //                     item._source.subscription_price = is_subscription

    //                 }else
    //                 {
    //                     item.id = testIds[count]
    //                     item.is_subscription = is_subscription
    
    //                 }
    //             }
    //             count ++
    //             if(count > 1){
    //                 count = 0
    //             }


    //             return item
    //         })
    //         break;
    //     case "learn_path":
    //          testIds =  [11,7]
    //         count = 0
    //         list.map(item=> {
               
    //             let id = (item._source)? item._source.id: item.id
    //             let is_subscription = (count < 4)? false: true
    //             if (typeof id === 'string' && id.includes("LRN_PTH_")) {
    //                 if(item._source)
    //                 {
    //                     item._source.id = "LRN_PTH_"+testIds[count]
    //                     item._source.subscription_price = is_subscription
    //                 }else
    //                 {
    //                     item.id = "LRN_PTH_"+testIds[count]
    //                     item.is_subscription = is_subscription
    
    //                 }
    //             }else{
    //                 if(item._source)
    //                 {
    //                     item._source.id = testIds[count]
    //                     item._source.subscription_price = is_subscription

    //                 }else
    //                 {
    //                     item.id = testIds[count]
    //                     item.is_subscription = is_subscription
    
    //                 }
    //             }
    //             count ++
    //             if(count > 1){
    //                 count = 0
    //             }


    //             return item
    //         })
    //         break;
    //     default:
    //         break;
    // }  


    try {
        
        let buyNow = {}
        buyNow.courseIds = []
        buyNow.learnPathIds = []

        let subscription = {}
        subscription.courseIds = []
        subscription.learnPathIds = []
        switch (type) {
            case "learn_content":
                for (let item of list) {
                    let id = (item._source)? item._source.id: item.id
                    let is_subscription = (item._source)? item._source.subscription_price: item.is_subscription
                    if (typeof id === 'string' && id.includes("LRN_CNT_PUB_")) {
                        id = parseInt(id.replace("LRN_CNT_PUB_", ""))
                    }
                    if (is_subscription) {
                        subscription.courseIds.push(id)
                    }
                    else {
                        buyNow.courseIds.push(id)
                    }
                }
                break;
            case "learn_path":
                for (let item of list) {
                    let id = (item._source)? item._source.id: item.id
                    let is_subscription = (item._source)? item._source.subscription_price: item.is_subscription
                    if (typeof id === 'string' && id.includes("LRN_PTH_")) {
                        id = parseInt(id.replace("LRN_PTH_", ""))
                    }
                    if (is_subscription) {
                        subscription.learnPathIds.push(id)
                    }
                    else {
                        buyNow.learnPathIds.push(id)
                    }
                }
                break;
            default:
                break;
        }

        let payload = 
        {          
            "country": countryCode
        }

        if(buyNow.courseIds.length > 0)
        {
            if(!payload.buyNow) payload.buyNow = {}
            payload.buyNow.courseIds = buyNow.courseIds
        }
        if(buyNow.learnPathIds.length > 0)
        {
            if(!payload.buyNow) payload.buyNow = {}
            payload.buyNow.learnPathIds = buyNow.learnPathIds
        }
        if(subscription.courseIds.length > 0)
        {
            if(!payload.subscription) payload.subscription = {}
            payload.subscription.courseIds = subscription.courseIds
        }
        if(subscription.learnPathIds.length > 0)
        {
            if(!payload.subscription) payload.subscription = {}
            payload.subscription.learnPathIds = subscription.learnPathIds
        }
        
        const url = `${process.env.ECOM_API_URL}/listing_api/ids`;
        let response = await axios.post(url, payload);

        if (response && response.data && response.data.status == "OK") {
            switch (type) {
                case "learn_content":
                    list.map(item=> {
                        let id = (item._source)? item._source.id: item.id
                        let is_subscription = (item._source)? item._source.subscription_price: item.is_subscription
                        if (typeof id === 'string' && id.includes("LRN_CNT_PUB_")) {
                            id = parseInt(id.replace("LRN_CNT_PUB_", ""))
                        }
                        if (is_subscription) {
                            if(item._source)
                            {
                                item._source.pricing_details = response.data.data.subscriptionCourseTypeCourse[id] || null
                            }else{
                                item.pricing_details = response.data.data.subscriptionCourseTypeCourse[id] || null
                            }
                        }
                        else {
                            if(item._source)
                            {
                                item._source.pricing_details = response.data.data.buyNowCourseTypeCourse[id] || null
                            }else{
                                item.pricing_details = response.data.data.buyNowCourseTypeCourse[id] || null
                            }
                        }

                        return item
                    })
                    break;
                case "learn_path":
                    list.map(item=> {
                        let id = (item._source)? item._source.id: item.id
                        let is_subscription = (item._source)? item._source.subscription_price: item.is_subscription
                        if (typeof id === 'string' && id.includes("LRN_PTH_")) {
                            id = parseInt(id.replace("LRN_PTH_", ""))
                        }
                        if (is_subscription) {
                            if(item._source)
                            {
                                item._source.pricing_details = response.data.data.subscriptionCourseTypeLearnPath[id] || null
                            }else{
                                item.pricing_details = response.data.data.subscriptionCourseTypeLearnPath[id] || null
                            }
                        }
                        else {
                            if(item._source)
                            {
                                item._source.pricing_details = response.data.data.buyNowCourseTypeLearnPath[id] || null
                            }else{
                                item.pricing_details = response.data.data.buyNowCourseTypeLearnPath[id] || null
                            }
                        }
                    })
                    break;
                default:
                    break;
            }           


        }

        return list;
    } catch (error) {
        console.log("error fetching price from Ecom", error)
        return list;
    }

}


  module.exports = {
    getAllFilters,
    isDateInRange,
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
    compareRule,
    paginate,
    formatResponseField,
    formatImageResponse,
    formatCount,
    getlistPriceFromEcom
}



