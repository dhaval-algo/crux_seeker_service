const elasticService = require("./elasticService");
const reviewService = require("./reviewService");
const partnerService = require("./partnerService");
let PartnerService = new partnerService();
const ReviewService = new reviewService();
const fetch = require("node-fetch");
const pluralize = require('pluralize')
const { getCurrencies, getCurrencyAmount, isDateInRange,formatCount } = require('../utils/general');
const { generateMetaInfo } = require('../utils/metaInfo');
const models = require("../../../models");
const { 
    getFilterConfigs, 
    parseQueryFilters,
    getPaginationQuery,
    getPaginationDefaultSize,
    getMediaurl,
    getFilterAttributeName,
    updateSelectedFilters,
    paginate,
    formatImageResponse,
    getlistPriceFromEcom
} = require('../utils/general');

const redisConnection = require('../../services/v1/redis');

const RedisConnection = new redisConnection();

const recommendationService = require("./recommendationService");
let RecommendationService = new recommendationService();

const apiBackendUrl = process.env.API_BACKEND_URL;

const mLService = require("./mLService");


let slugMapping = [];
let currencies = [];
const rangeFilterTypes = ['RangeSlider','RangeOptions'];
const filterFields = ['topics','categories','sub_categories','title','level','learn_type','languages','medium','instruction_type','pricing_type','provider_name','skills', 'partner_name','region'];
const allowZeroCountFields = ['level','categories','sub_categories'];

const helperService = require("../../utils/helper");
const categoryService = require("./categoryService");
const CategoryService = new categoryService();
const {saveSessionKPIs} = require("../../utils/sessionActivity");
const {getSearchTemplate,getUserKpis} = require("../../utils/searchTemplates");
const { list } = require("../controllers/listUsersController");

const sortOptions = {
    'Popular' : ["activity_count.all_time.popularity_score:desc","ratings:desc"],
    'Trending' : ["activity_count.last_x_days.trending_score:desc","ratings:desc"],
    'Highest Rated': ["ratings:desc"],
    'Newest' :["published_date:desc"],
    'Price Low To High': ["default_price:asc"],
    'Price High To Low': ["default_price:desc"],
    'Most Relevant' : []
}

const getBaseCurrency = (result) => {
    return result.learn_content_pricing_currency? result.learn_content_pricing_currency.iso_code:null;
};

const getEntityLabelBySlugFromCache= async (entity, slug, skipCache=false) =>
{
    let cacheName = `enity_slug_${entity}`;
    let entities = {}
    let useCache = false 
    if(skipCache !=true) {       
        let cacheData = await RedisConnection.getValuesSync(cacheName);
        if(cacheData.noCacheData != true) {
            entities =  cacheData   
            useCache = true				 
        }
    }          
    if(useCache !=true)
    {
        let response = await fetch(`${apiBackendUrl}/${entity}?_limit=-1`);
        if (response.ok) {
            let json = await response.json();
            if(json){
                for(let entity of json)
                {                    
                    if( entity.slug){                       
                    //pick only image urls , instead of sending whole large logo object
                    let logos = {}
                       if(entity.logo){
                           if(entity.logo.formats){

                                Object.keys(entity.logo.formats).forEach((size, index) => {
                                    logos[size] = entity.logo.formats[size].url
                                })
                           }
                           else
                                logos['thumbnail'] = entity.logo.url     
                       }
                        entities[entity.slug] = {
                            "logo" : (entity.logo) ? logos : null,
                            "faq" : (entity.faq) ? entity.faq : null,
                            "default_display_label"  :(entity.default_display_label)?entity.default_display_label :null,
                            "description"  :(entity.description)?entity.description :null,
                            "meta_information":(entity.meta_information)?entity.meta_information :null
                        }
                    }                    
                }
                RedisConnection.set(cacheName, entities);
            }
        }
        
       // RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_ENTITY_SLUG); 
    }
    if(skipCache !=true) {
        return entities[slug]
    }else{
        return entities
    }
}

const getEntityLabelBySlug = async (entity, slug) => {

    let response = await getEntityLabelBySlugFromCache(entity, slug)
    if(response)
    {
        return response;
    }
    else
    {
        let response = await fetch(`${apiBackendUrl}/${entity}?slug_eq=${slug}`);

        if (response.ok) {
        let json = await response.json();
        
        if(json && json.length){
            let cacheName = `enity_slug_${entity}`;
            let cacheData = await RedisConnection.getValuesSync(cacheName);
            if(cacheData.noCacheData != true) {
                //pick only image urls , instead of sending whole large logo object
                let logos = {}
                if(json[0].logo){
                    if(json[0].logo.formats){

                         Object.keys(json[0].logo.formats).forEach((size, index) => {
                             logos[size] = json[0].logo.formats[size].url
                         })
                    }
                    else
                         logos['thumbnail'] = json[0].logo.url     
                }
                cacheData[slug] = {
                "logo" : (json[0].logo) ? json[0].logo : null,
                "faq" : (json[0].faq) ? json[0].faq : null,
                "default_display_label"  :(json[0].default_display_label)?json[0].default_display_label :null,
                "description"  :(json[0].description)?json[0].description :null,                
                "meta_information":(json[0].meta_information)?json[0].meta_information :null
                }
                RedisConnection.set(cacheName, cacheData);
               // RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_ENTITY_SLUG);
            }
            return cacheData[slug] ;
        }else{
            return null;
        }    
        } else {
            return null;
        }
    }
   
};

const round = (value, step) => {
    step || (step = 1.0);
    var inv = 1.0 / step;
    return Math.round(value * inv) / inv;
};

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

const getSlugMapping = (req) => {
    slugMapping = [];
    if(req.query['pageType'] !== null){
        if(req.query['pageType'] == "category"){
            slugMapping = [{elastic_key: "categories" , entity_key: "categories", pageType:"category" }, {elastic_key: "sub_categories" , entity_key: "sub-categories",pageType:"sub_category" }];
        }
        if(req.query['pageType'] == "topic"){
            slugMapping = [{elastic_key: "topics" , entity_key: "topics", pageType:"topic"}];
        }            
    }
    return slugMapping;
};

const saveLearnContentListSessionKPIs = (req, page_details) => {
    if (((req.user && req.user.userId) || req.segmentId) && page_details && page_details.pageType && page_details.label) {
        let kpiKey = null;
        const userId = (req.user && req.user.userId) ?req.user.userId : req.segmentId;
        switch (page_details.pageType) {

            case "category": kpiKey = "categories"; break;
            case "sub_category": kpiKey = "sub_categories"; break;
            case "topic": kpiKey = "topics"; break;

        }

        if (kpiKey) {

            saveSessionKPIs(userId, { [kpiKey]: [page_details.label] },'click');
        }

    }
}

module.exports = class learnContentService {

    async getLearnContentList(req, callback, skipCache){
 
        try{
        let searchTemplate = null;
        let defaultSize = await getPaginationDefaultSize();
        let defaultSort =  'Most Relevant' ;
        let useCache = false;
        let cacheName = "";
        const userId = (req.user && req.user.userId) ? req.user.userId : req.segmentId;
        if(!userId &&
            req.query['courseIds'] == undefined
            && req.query['f'] == undefined
            && req.query['parsedFilters'] == undefined
            && (req.query['q'] == undefined || req.query['q'] == '')
            && req.query['rf'] == undefined
            && ((req.query['pageType'] == undefined || req.query['pageType'] == "search" || req.query['pageType'] == "category" || req.query['pageType'] == "topic") && (req.query['page'] == "1" || req.query['page'] == undefined))
            && (
                req.query['size'] == undefined
                || req.query['size'] == defaultSize
            )
            && (
                req.query['sort'] == undefined
                || req.query['sort'] == defaultSort
            )
        ) {
            useCache = true;
            let apiCurrency = process.env.DEFAULT_CURRENCY;
            if(req.query['currency'] != undefined){
                apiCurrency = req.query['currency'];
            }
           
            if((req.query['pageType'] == "category" || req.query['pageType'] == "topic") && req.query['slug'] != undefined && (req.query['q'] == undefined || req.query['q'] == "")) {
                cacheName = "listing-"+req.query['pageType']+"-"+req.query['slug'].replace(/,/g, '_')
            } else if((req.query['pageType'] == undefined || req.query['pageType'] == "search") && (req.query['q'] == undefined || req.query['q'] == '')) {
                cacheName = "listing-search_";                
            }
            if(req.query['hardFilter'])
            {
                cacheName += `_${req.query['hardFilter']}`;
            }

            cacheName += `_${defaultSort}`;

            if(skipCache != true) {
                let cacheData = await RedisConnection.getValuesSync(cacheName);
                if(cacheData.noCacheData != true) {
                    saveLearnContentListSessionKPIs(req , cacheData.page_details);
                    if(cacheData.list)
                    {
                        cacheData.list = await getlistPriceFromEcom(cacheData.list,"learn_content",req.query['country'])
                    }
                    return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
                }
            }
        }

        let esFilters = {};


        currencies = await getCurrencies();
        var slugMapping = getSlugMapping(req);


        const filterConfigs = await getFilterConfigs('Learn_Content');

            if (req.query['q']) {

                searchTemplate = await getSearchTemplate('learn-content',decodeURIComponent(req.query['q']).replace("+","//+").trim(),userId);
                esFilters['q'] = searchTemplate.function_score.query.bool.must[0];
                
            } else {
                const functions = [];

                searchTemplate = {
                    function_score: {
                        score_mode: "multiply",
                        boost_mode: "multiply",
                        query: {
                            bool: {
                                must: [
                                    { term: { "status.keyword": 'published' } }
                                ],
                            }
                        }
                    }
                }

                if (req.query.sort && req.query.sort == 'Most Relevant') {

                    functions.push({
                        field_value_factor: {
                            field: "activity_count.all_time.course_views",
                            modifier: "log2p",
                            missing: 8
                        }
                    });
                }

                functions.push(...await getUserKpis('learn-content', userId));

                if (functions.length) {
                    searchTemplate.function_score.functions = functions
                }
            }
        let queryPayload = {};
        let paginationQuery = await getPaginationQuery(req.query);
        queryPayload.from = paginationQuery.from;
        queryPayload.size = paginationQuery.size;

        if(!req.query['sort']){
            req.query['sort'] = defaultSort;
        }

        if(req.query['sort']){
            queryPayload.sort = []
            const keywordFields = ['title'];
            let sort = sortOptions[req.query['sort']];
                if(sort && sort.length > 0){
                for(let field of sort){
                
                    let splitSort = field.split(":");
                    if(keywordFields.includes(splitSort[0])){
                        field = `${splitSort[0]}.keyword:${splitSort[1]}`;
                    }
                queryPayload.sort.push(field)
                }
            }
        }
        
        if(req.query['courseIds']){
            let courseIds = req.query['courseIds'].split(",");
            courseIds = courseIds.map(id => {
                    
                if(!id.includes("LRN_CNT_PUB_"))
                {
                    id = 'LRN_CNT_PUB_'+id
                }

                return id
            })
            let filter_object = {
                "terms": {
                  "_id": courseIds 
                }
            }

            searchTemplate.function_score.query.bool.must.push(filter_object)
            esFilters['courseIds'] = filter_object;
        }

        let slugs = [];
        let query_slug;
        if(req.query['slug']){
            slugs = req.query['slug'].split(",");
            
            for(let i=0; i<slugs.length; i++){
                query_slug = slugs[i].replace("&", "%26");
                var slug_data = await getEntityLabelBySlug(slugMapping[i].entity_key, query_slug);
                if(!slug_data){
                    let redirectUrl = await helperService.getRedirectUrl(req);
                    if (redirectUrl) {
                        return callback(null, { success: false, redirectUrl: redirectUrl, message: 'Redirect' });
                    }
                    return callback(null, { success: false, message: 'Not found!' });
                }
                var slugLabel = slug_data.default_display_label;
                var slug_pageType = slugMapping[i].pageType;
                var slug_description = slug_data.description;
                var slug_meta_information = slug_data.meta_information;
                var slug_logo = slug_data.logo;
                var slug_faq = slug_data.faq;
                if(!slugLabel){
                    slugLabel = slugs[i];                
                }


                let filter_object =  {
                    "terms": {[`${slugMapping[i].elastic_key}.keyword`]: [slugLabel]}
                }

                searchTemplate.function_score.query.bool.must.push(filter_object);

                esFilters['slugged'] = filter_object;

            }           
        }

        let parsedFilters = [];
        let parsedRangeFilters = [];       
        let filters = [];
        let hardparsedFilters = []
        if(req.query['hardFilter'])
        {
            req.query['f'] = (req.query['f'])? `${req.query['f']}::${req.query['hardFilter']}`: req.query['hardFilter']
            hardparsedFilters = parseQueryFilters(req.query['hardFilter']);
        }        


        if(req.query['f'] || req.query['parsedFilters']){
            if(req.query['f'])
            {
                parsedFilters = parseQueryFilters(req.query['f']);
            }
            if(req.query['parsedFilters']){
            if(parsedFilters.length > 0)
            {
                parsedFilters =  parsedFilters.concat(req.query['parsedFilters'])
            }
            else{
                parsedFilters =  req.query['parsedFilters']
            }
            }           
           
            for(const filter of parsedFilters){      
                let elasticAttribute = filterConfigs.find(o => o.label === filter.key);
                if(elasticAttribute){
                    const attribute_name  = getFilterAttributeName(elasticAttribute.elastic_attribute_name, filterFields);
                    let filter_object = {}
                            //case for boolean attribute;
                    if(elasticAttribute.elastic_data_type == 'boolean'){
                        if(elasticAttribute.elastic_attribute_name == 'job_assistance'){
                            let job_asis = filter.value[0]

                            job_asis.toLowerCase() == 'yes' ? job_asis = true : job_asis = false;
                            filter_object = {"term": {[attribute_name]: job_asis}};
                        }
                        else if(elasticAttribute.elastic_attribute_name == 'coupon_offers')
                        {
                            let offer = filter.value[0]
            
                            offer.toLowerCase() == 'yes' ? offer = true : offer = false;
                            filter_object = {"term": {[attribute_name]: offer}};
                        }
                        else
                            filter_object = {"term": {[attribute_name]: filter.value[0]}};
                    }
                    else 
                        filter_object = {"terms": {[attribute_name]: filter.value}};

                    searchTemplate.function_score.query.bool.must.push(filter_object);
                    esFilters[elasticAttribute.elastic_attribute_name] = filter_object;
                }
            }            
        }

        


        if(req.query['rf']){
            parsedRangeFilters = parseQueryRangeFilters(req.query['rf']);
            for(const filter of parsedRangeFilters){
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

                    let filter_object = {
                        "range": {
                            [attribute_name]: rangeQuery
                         }
                    };

                    searchTemplate.function_score.query.bool.must.push(filter_object);
                    esFilters[elasticAttribute.elastic_attribute_name] = filter_object;                 
                }
            }
        }


        //Aggreation query build 

        let published_filter = { term: { "status.keyword": "published"  }};

        let aggs = {
            course_filters: {
                global: {},
                aggs: {

                }
            }
        }

       
        const topHitsSize = 200;
        const  rating_keys = [4.5,4.0,3.5,3.0].map(value=> ({ key: `${value} and Above`, from: value*100 }));
        const duration_keys = [
            { key: 'Less Than 2 Hours', to: 2 },
            { key: 'Less Than a Week', to: 56 },
            { key: '1 - 4 Weeks', from: 56, to: 225 },
            { key: '1 - 3 Months', from: 225, to: 673 },
            { key: '3+ Months', from: 673 },
        ]

        for(let filter of filterConfigs) {
            

            let exemted_filters = esFilters;

            if(esFilters.hasOwnProperty(filter.elastic_attribute_name)){
                let {[filter.elastic_attribute_name]: ignored_filter, ...all_filters } = esFilters 
                exemted_filters = all_filters;
            }

            exemted_filters = Object.keys(exemted_filters).map(key=>exemted_filters[key]);          

            exemted_filters.push(published_filter);

            let aggs_object = {
                filter: { bool: { filter: exemted_filters } },
                aggs: {}
            }

            switch(filter.filter_type){
                case "Checkboxes":
                    if(filter.elastic_data_type == 'boolean')
                        aggs_object.aggs['filtered'] = { terms: { field: filter.elastic_attribute_name }}
                    else
                        aggs_object.aggs['filtered'] = { terms: { field: `${filter.elastic_attribute_name}.keyword`, size: topHitsSize } }
                    break;
                case "RangeOptions":
                    aggs_object.aggs['filtered'] = {
                        range: {
                            field: filter.elastic_attribute_name,
                            ranges: filter.elastic_attribute_name == "ratings" ? rating_keys : duration_keys
                        }
                    }
                    break;
                case "RangeSlider":
                    aggs_object.aggs['min'] = { min: {field: filter.elastic_attribute_name}}
                    aggs_object.aggs['max'] = { max: {field: filter.elastic_attribute_name}} 
                    break;
            }
            aggs.course_filters.aggs[filter.elastic_attribute_name] = aggs_object;
        }
            //This is for trending list
            if (req.query['parsedFilters']) {
                aggs.trending_list_synopsys_topics =
                {
                    terms: { field: 'topics.keyword' }
                }
                aggs.trending_list_synopsys_partner =
                {
                    terms: { field: 'partner_name.keyword' }
                }
                aggs.trending_list_synopsys_instruction_type =
                {
                    terms: { field: 'instruction_type.keyword' }
                }
                aggs.trending_list_synopsys_capstone_project =
                {
                    terms: { field: 'capstone_project' }
                }
                aggs.trending_list_synopsys_virtual_labs =
                {
                    terms: { field: 'virtual_labs' }
                }
                aggs.trending_list_synopsys_case_based_learning =
                {
                    terms: { field: 'case_based_learning' }
                }
                aggs.trending_list_synopsys_price_type =
                {
                    terms: { field: 'pricing_type.keyword' }
                },

                    aggs.trending_list_synopsys_duration =
                    {
                        range: {
                            field: "total_duration_in_hrs",
                            ranges: [
                                { to: 56 },
                                { from: 255 }
                            ]
                        }
                    },
                    aggs.trending_list_synopsys_price_range =
                    {
                        range: {
                            field: "basePriceRound",
                            ranges: [
                                { to: 13 },
                                { from: 13, to: 130 },
                                { from: 130 }
                            ]
                        }
                    }

            }

        queryPayload.aggs = aggs;
      
        // --Aggreation query build
     
        
        let result = await elasticService.searchWithAggregate('learn-content', searchTemplate?searchTemplate:query, queryPayload);
        /**
         * Aggregation object from elastic search
         */
        let aggs_result = result.aggregations;

        /**
         * Hits Array from elastic search
         */
        result = result.hits;

            for (let filter of filterConfigs) {



                if(filter.elastic_attribute_name =="learn_type")
                { 
                    var learn_types_images = await this.getLearnTypeImages();        
                          
                }


                let facet = aggs_result.course_filters[filter.elastic_attribute_name];

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
                };

                if(filter.filter_type == "RangeSlider"){

                    if(filter.elastic_attribute_name === "default_price"){
                        facet.min.value = facet.min.value > 0 ? getCurrencyAmount(facet.min.value, currencies,'USD',req.query['currency']): facet.min.value;
                        facet.max.value = facet.max.value > 0 ? getCurrencyAmount(facet.max.value, currencies, 'USD',req.query['currency']): facet.max.value;
                    }

                    formatedFilters.min = facet.min.value;
                    formatedFilters.max = facet.max.value;
                    formatedFilters.minValue = facet.min.value;
                    formatedFilters.maxValue = facet.max.value;
                } else {
                    formatedFilters.options = facet.filtered.buckets.map(item => {
                        let option = {
                        label: item.key,
                        count: item.doc_count,
                        selected: false, //Todo need to updated selected here.
                        disabled: item.doc_count <= 0,
                        }

                        if(filter.filter_type == "RangeOptions") {
                            option.start = item.from ? filter.elastic_attribute_name == "ratings" ? item.from /100 : item.from : "MIN"
                            option.end = item.to ? item.to : "MAX"
                        }

                
                        if(filter.elastic_attribute_name == "learn_type")
                        {   option.image  = learn_types_images[item.key] }

                        if(filter.elastic_attribute_name == "job_assistance")
                            item.key == 1 ? option.label = "Yes" : option.label = "No"
                        if(filter.elastic_attribute_name == "coupon_offers")
                            item.key == 1 ? option.label = "Yes" : option.label = "No"

                        return option;
                    });
                    if(filter.elastic_attribute_name == "ratings") formatedFilters.options.reverse();
                }

                filters.push(formatedFilters);
 
            }



                    /*Ordering as per category tree*/
        let formatCategory = true;
        // if(parsedFilters)
        // {
        //     for (let parsedFilter of parsedFilters)
        //     {
        //         if (parsedFilter.key =="Category")
        //         {
        //             formatCategory = false;
        //         }
        //     }
        // }





            //update selected flags
            if (parsedFilters.length > 0 || parsedRangeFilters.length > 0) {
                filters = await updateSelectedFilters(filters, parsedFilters, parsedRangeFilters);
            }


            if(formatCategory)
            {
               let category_tree = await CategoryService.getTreeV2(false) || [];
               let categoryFiletrOption =[];
               let categorykey = 0;
                if(category_tree && category_tree.length)
                {
                    for(let category of category_tree )
                    {
                        let i= 0;
                        for(let filter of filters)
                        {
                            if(filter.field =="categories")
                            {
                                for(let option of filter.options)
                                {
                                    if(category.label == option.label)
                                    {
                                        categoryFiletrOption.push(option);
                                    }
                                }
                                categorykey = i;
                                
                            }
                            i++;
                        }
                    }
                }
                if(filters[categorykey]) {
                    filters[categorykey].options = categoryFiletrOption;
                }
    
            }

            let pagination = {
                page: paginationQuery.page,
                count: result.hits.length,
                perPage: paginationQuery.size,
                totalCount: result.total.value,
                total: result.total.value
              }

              let list = [];
            if (result.total && result.total.value > 0) {
                result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                list = await this.generateListViewData(result.hits, req.query['currency'], useCache);
            }

            //Remove filters if requested by slug
            for (let i = 0; i < slugs.length; i++) {
                const config = filterConfigs.find(o => o.elastic_attribute_name === slugMapping[i].elastic_key);
                if (config) {
                    filters = filters.filter(o => o.label !== config.label);
                }
            }


            //remove filter if pagetype is partner or institute
            if(req.query['hardFilter'])
            {
                if(hardparsedFilters && hardparsedFilters.length > 0)
                {
                    for (let hardfilter of hardparsedFilters)
                    {
                        filters = filters.filter(o => o.label !== hardfilter.key);
                    }
                }
            }
            

            let data = {
                list: list,
                filters: filters,
                pagination: pagination,
                sort: req.query['sort'],
                sortOptions: Object.keys(sortOptions)
            };

            
            data.page_details = {
                pageType: slug_pageType || "default",
                slug: req.query['slug'] || null,
                label: slugLabel || null,
                description: slug_description || null,
                logo : (slug_logo && slug_logo.url)? (slug_logo.url) :((slug_logo)? formatImageResponse(slug_logo) : null),
                course_count: result.total.value
            }
            data.faq = slug_faq
            if (slug_pageType == "category" || slug_pageType == "sub_category" || slug_pageType == "topic") {
                try {
                    if(slug_pageType == "category" && slugLabel){
                        this.addPopularEntities(slug_pageType, slugLabel)
                    }else if(slug_pageType == "topic" && slugLabel){
                        this.addPopularEntities(slug_pageType, slugLabel)
                    }                    
                } catch (error) {
                    console.log("Error in addPopularEntities", error)
                }
                data.meta_information = slug_meta_information;
               
            }
            //This is for trending list
            if(req.query['parsedFilters'])
            {
                data.trending_list_synopsys_aggregation = {
                    topics : aggs_result.trending_list_synopsys_topics,
                    instruction_type : aggs_result.trending_list_synopsys_instruction_type,
                    capstone_project : aggs_result.trending_list_synopsys_capstone_project,
                    virtual_labs : aggs_result.trending_list_synopsys_virtual_labs,
                    case_based_learning: aggs_result.trending_list_synopsys_case_based_learning,
                    partner: aggs_result.trending_list_synopsys_partner,
                    duration: aggs_result.trending_list_synopsys_duration,
                    price_type:aggs_result.trending_list_synopsys_price_type,
                    price_range:aggs_result.trending_list_synopsys_price_range,
                }
            }
            

            //TODO dont send data if filters are applied.
            
            // if (slug_pageType == "category" || slug_pageType == "sub_category" || slug_pageType == "topic") {
            //     data.get_started = {}
            //     let param = {
            //         params: { type: "Populer" },
            //         query: { [slug_pageType]: slugLabel, page: 1, limit: 6, currency: req.query['currency'] }
            //     }
            //     data.get_started.popular = await this.getPopularCourses(param, (err, data) => { }, true)
            //     param.params.type = "Trending"
            //     data.get_started.trending = await this.getPopularCourses(param, (err, data) => { }, true)
            //     param.params.type = "Free"
            //     data.get_started.free = await this.getPopularCourses(param, (err, data) => { }, true)
            // }

            let meta_information = await generateMetaInfo('LEARN_CONTENT_LIST', data);
            
            if (meta_information) {
                data.meta_information = meta_information;
            }

            
            callback(null, { success: true, message: 'Fetched successfully!', data: data });
            saveLearnContentListSessionKPIs(req , data.page_details);

            if (useCache) {
                list.forEach((course) => {
                    let courseSlugs = {
                        course_slug: course.slug,
                        categories: course.categories_list.map(cat => cat.slug),
                        sub_categories: course.sub_categories_list.map(subcat => subcat.slug),
                        topics: course.topics_list.map(topc => topc.slug)
                    }
                    RedisConnection.set("listing-course-" + course.slug, courseSlugs);
                    RedisConnection.expire("listing-course-" + course.slug, process.env.CACHE_EXPIRE_LISTING_COURSE || 60 * 60 * 24);
                });
                RedisConnection.set(cacheName, data);
                RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_LISTING_COURSE || 60 * 60 * 24 );
            }

      
    }catch(e){
        console.log(e)
        callback(null, {success: false, message: 'Failed to fetch!', data: {list: [], pagination: {total: 0}, filters: []}});

    }

    
    }

    async getLearnContent(req, callback, skipCache){
        const slug = req.params.slug;
        let courseId = null
        let cacheName = `single-course-${slug}_${req.query.currency}`
        let useCache = false
        if(skipCache !=true) {
            let cacheData = await RedisConnection.getValuesSync(cacheName);
            courseId = cacheData.id
            if(cacheData.noCacheData != true) {

                callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
                useCache = true
                if ((req.user && req.user.userId) || req.segmentId) {
                    const userId = (req.user && req.user.userId) ? req.user.userId : req.segmentId;
                    saveSessionKPIs(userId, { courses: [cacheData] },'click');
                }
            }            
        }
              
        if(useCache !=true)
        {
            const course = await this.fetchCourseBySlug(slug);
            if(course){
                let data = await this.generateSingleViewData(course, false, req.query.currency);
                /**
                 * Log skills entity
                 */
                if(course.skills.length > 0){
                    for(let name of course.skills){
                        this.addPopularEntities("skill", name)
                    }
                }
                courseId = data.id

                // if enquiry is 'On', then check course end date,
                if(data.enquiry){
                    const today = new Date()
                    data.enquiry = false
                    let { course_details :{course_end_date}, additional_batches } = data

                    // if batch (any) end date is not passed then keep enquiry 'On'
                    if( additional_batches.length > 0){
                        for(let batch of additional_batches){

                            if(today < new Date(batch.enrollment_end_date)){
                                data.enquiry = true;
                                break;
                            }
                        }
                    }
                    // if course end date is not passed then keep enquiry 'On'
                    if(course_end_date != null && data.enquiry != true){
                        if( today < new Date(course_end_date) )
                            data.enquiry = true;
                    }


                }

                this.getReviews({params:{courseId: data.id}, query: {}}, (err,review_data)=>{
                    if(review_data && review_data.data) data.reviews_extended = review_data.data;
                    callback(null, {success: true, message: 'Fetched successfully!', data: data});
                    RedisConnection.set(cacheName, data); 
                    RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_SINGLE_COURSE);                   
                })

                if ((req.user && req.user.userId) || req.segmentId) {
                    const userId = (req.user && req.user.userId) ? req.user.userId : req.segmentId;
                    saveSessionKPIs(userId, { courses: [data] },'click');
                }
                
            }else{
                let redirectUrl = await helperService.getRedirectUrl(req);
                if (redirectUrl) {
                    return callback(null, { success: false, redirectUrl: redirectUrl, message: 'Redirect' });
                }
                return callback(null, { success: false, message: 'Not found!' });                
            } 
        }
        req.body = {courseId: courseId}
        this.addActivity(req, (err, data) => {})
    }

    async getReviews(req, callback) {

        try {
            let reviews = await ReviewService.getReviews("learn-content", req.params.courseId, req);
            callback(null, { status: "success", message: "all good", data: reviews });
        } catch (e) {
            callback({ status: "failed", message: e.message }, null);
        }

    }

    async getRelatedCourses(req, callback) {
        try {
            const  courseId =  req.query.courseId.toString();
            const {currency,page=1,limit=6} = req.query;
            const offset = (page-1) * limit;

            //fields to fetch 
            let fields = [
                "sub_categories",
                "skills",
                "topics",
                'title', 'id', 'status', 'regular_price'
            ];

            //priority 1 category list
            let priorityList1 = ['sub_categores.keyword', 'skills.keyword', 'topics.keyword'];
            let priorityList2 = ['regular_price', 'partner_id', 'provider_slug.keyword', 'level.keyword', 'learn_type.keyword', 'instruction_type.keyword', 'medium.keyword', 'internship', 'job_assistance'];

            const relationData = {
                index: "learn-content",
                id: courseId
            }

            let esQuery = {
                "bool": {
                    "filter": [
                        { "term": { "status.keyword": "published" } }
                    ],
                    must_not: {
                        term: {
                            "_id": courseId
                        }
                    }
                }
            }

            function buildQueryTerms(key, i) {
                let termQuery = { "terms": {} };
                termQuery.terms[key] = { ...relationData, "path": key };
                termQuery.terms.boost = 5 - (i * 0.1);
                return termQuery;
            }

            esQuery.bool.should = [{
                bool: {
                    boost: 1000,
                    should: priorityList1.map(buildQueryTerms)
                }
            }];

            esQuery.bool.should.push({
                bool: {
                    boost: 10,
                    should: priorityList2.map(buildQueryTerms)
                }
            })

            let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit });
            
            let courses = [];
            if (result && result.hits.length > 0) {
                for (let hit of result.hits) {
                    let course = await this.generateSingleViewData(hit._source, false, currency);
                    const {ads_keywords,subtitle,prerequisites,target_students,content,...optimisedCourse} = course;
                    courses.push(optimisedCourse);
                }
            }
           
            const mlCourses = await this.getSimilarCoursesML(courseId,currency,page,limit);
            let show = null;
            if (mLService.whetherShowMLCourses("get-similar-courses") && mlCourses && mlCourses.length) {
                show = 'ml';
            }
            else {
                show = 'logic';
            }
            const response = { success: true, message: "list fetched successfully", data:{list:courses,mlList:mlCourses,show:show} };
            callback(null, response);
        } catch (error) {
            console.log("Error while processing data for related courses", error);
            callback(error, null);
        }
    }

    async getPopularCourses(req, callback, returnData) {
        let { subType, priceType="Paid" } = req.query; // Populer, Trending,Free
        let { category, sub_category, topic, currency=process.env.DEFAULT_CURRENCY, page = 1, limit =20} = req.query;       
        
        const offset= (page -1) * limit
        
        let courses = [];
        try {
            let cacheKey = `popular-courses-${subType}-${category || ''}-${sub_category || ''}-${topic || ''}-${priceType || ''}-${currency}-${page}-${limit}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            if(cachedData.noCacheData != true) {
                courses = cachedData;
            } else {
            
            let esQuery = {
                "bool": {
                    "filter": [
                        { "term": { "status.keyword": "published" } }
                    ]
                }
            }
            if(category){
                esQuery.bool.filter.push(
                    {"term": {
                            "categories.keyword": decodeURIComponent(category)
                        }
                    }
                );
            }
            if(sub_category){
                esQuery.bool.filter.push(
                    {"term": {
                            "sub_categories.keyword":  decodeURIComponent(sub_category)
                        }
                    }
                );
            }
            if(topic){
                esQuery.bool.filter.push(
                    {"term": {
                            "topics.keyword":  decodeURIComponent(topic)
                        }
                    }
                );
            } 
            
            if(priceType && priceType =="Free"){
                esQuery.bool.filter.push(
                    { "term": { "pricing_type.keyword": "Free" } }
                );
                
            }
            if(priceType && priceType =="Paid"){
                esQuery.bool.filter.push(
                    { "term": { "pricing_type.keyword": "Paid" } }
                );
                
            }
            let sort = null
            switch (subType) {                
                case "Trending":
                    sort = [{ "activity_count.last_x_days.trending_score" : "desc" },{ "ratings" : "desc" }]
                    break; 
                default:
                    sort = [{ "activity_count.all_time.popularity_score" : "desc" },{ "ratings" : "desc" }]
                    break;
            }
            
            let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject:sort});
                
            if(result.hits){
                for(const hit of result.hits){
                    var data = await this.generateSingleViewData(hit._source,true,currency)
                    courses.push(data);
                }
                RedisConnection.set(cacheKey, courses,process.env.CACHE_EXPIRE_POPULAR_CARDS || 60 * 15);
            }
        }
            let response = { success: true, message: "list fetched successfully", data:{ list: courses,mlList:[],show:"logic" } };
            if(returnData)
            {
                return courses;
            }
            else
            {
                callback(null, response);
            }
            
        } catch (error) {
            console.log("Error while processing data for popular courses", error);
            callback(error, null);
        }
    }

    

    async fetchCourseBySlug(slug) {
        const query = { "bool": {
            "must": [
              {term: { "slug.keyword": slug }},
              {terms: { "status.keyword": ['published','unpublished' ]}}
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
        let category_tree = [];
        let response = await fetch(`${apiBackendUrl}/category-tree`);
        if (response.ok) {
            let json = await response.json();
            if(json && json.final_tree){
                category_tree = json.final_tree;
            }
        }
        if(category_tree && category_tree.length > 0 )
        {
            for (let category of category_tree)
            {
                if(category.count > 0){
                    categories.push({"label": category.label, "value": category.label});
                }    
            }
        }
        callback(null, {success: true, message: 'Fetched successfully!', data: categories});
    }



    async getCourseByIds(req, callback, isList = false){
        try {
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
                ids = ids.map(id => {
                    
                    if(!id.includes("LRN_CNT_PUB_"))
                    {
                        id = 'LRN_CNT_PUB_'+id
                    }

                    return id
                })
                const queryBody =  {
                    "ids": {
                        "values": ids
                    }
                };
                let queryPayload = {size : 1000}
                let result = await elasticService.search('learn-content', queryBody, queryPayload);
                if(result.hits){
                    if(result.hits && result.hits.length > 0){
                        if(!req.query.skipPrice)
                        {
                            result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                        }
                        for(const hit of result.hits){
                            const course = await this.generateSingleViewData(hit._source, isList, req.query.currency);
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
                callback(null, {success: true, message: 'Fetched successfully!', data: courseOrdered});
            }else{
                return courseOrdered;
            }
        } catch (error) {
            callback(null, {success: false, message: 'Failed to Fetch', data: null});
            console.log("course by id error=>",error)
        }
        
        
    }

    async getCourseOptionByCategories(req, callback){
        let courses = [];
        let categories = [];
        if(req.query['categories']){
            categories = req.query['categories'].split(",");
        }

        if(categories.length > 0){
            const query = {
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
            };
            let payload  ={size:1000}
            const result = await elasticService.search('learn-content', query, payload);
            if(result){
                if(result.hits && result.hits.length > 0){                  
                    courses = result.hits.map(function(obj) {
                        return {"label": obj['_source']['title'], "value": `LRN_CNT_PUB_${obj['_source']['id']}`};
                      });
                }
            }
        }
        callback(null, {success: true, message: 'Fetched successfully!', data: courses});
    }


    async generateSingleViewData(result, isList = false, currency=process.env.DEFAULT_CURRENCY, isCaching = false){
        
        if(currencies.length == 0){
            currencies = await getCurrencies();
        }
        const baseCurrency = getBaseCurrency(result);  
        let effort = null;
        if(result.recommended_effort_per_week){
            let efforUnit = (result.recommended_effort_per_week > 1) ? 'hours per week' : 'hour per week';
            effort = `${result.recommended_effort_per_week} ${efforUnit}`
        }      

        for(let i=0; i<result.reviews.length; i++){
            if(result.reviews[i]['reviewer_name'] == 'Other'){
                result.reviews.splice(i, 1);
            }
        }       
       
        //temp patch for old object format; scatter attributes 
        if(result.providers_list == undefined){
            let provider = {name: result.provider_name, slug: result.provider_slug,
                        currency: result.provider_currency, url:result.provider_course_url}
            result.providers_list = [provider]
        }
        const partnerCourseImage = await RedisConnection.getValuesSync("partner-course-image-"+result.partner_slug);
        let desktop_course_image = null , mobile_course_image = null, partner_logo = null;
        if(partnerCourseImage.noCacheData != true)
        {
            desktop_course_image = partnerCourseImage.desktop_course_image;
            mobile_course_image = partnerCourseImage.mobile_course_image;
            partner_logo = partnerCourseImage.logo;
        }
        else
        {
            const query = {
                bool: {
                    "must": [{ "exists": {"field": "desktop_course_image"} },{term: { "slug.keyword": result.partner_slug }}]
                }
            };
            
            const imageResult = await elasticService.search('partner', query, {size:2000}, ["mobile_course_image", "desktop_course_image", "logo"]);

            if(imageResult.hits && imageResult.hits.length > 0){                
                desktop_course_image = (imageResult.hits[0]._source.desktop_course_image)? imageResult.hits[0]._source.desktop_course_image : desktop_course_image ;
                mobile_course_image = (imageResult.hits[0]._source.mobile_course_image) ? imageResult.hits[0]._source.mobile_course_image : mobile_course_image;
                partner_logo = (imageResult.hits[0]._source.logo)? formatImageResponse(imageResult.hits[0]._source.logo): partner_logo; 
            }
        }

        let data = {
            title: result.title,
            status:result.status,
            slug: result.slug,
            id: `LRN_CNT_PUB_${result.id}`,
            numeric_id:result.id,
            subtitle: result.subtitle,
            providers: result.providers_list,
            provider_course_url: result.provider_course_url,
            original_course_url: result.original_course_url,
            partner: {
                id: result.parpartner_id,
                name: result.partner_name,
                slug: result.partner_slug,
                partner_url: result.partner_url
            },
            instructors: [],
            cover_video: (result.video) ? getMediaurl(result.video) : null,
            cover_image: partner_logo ? partner_logo : ((result.images)? formatImageResponse(result.images) :null),
            sidebar_listing_image: mobile_course_image ? mobile_course_image : ((result.listing_image)? formatImageResponse(result.listing_image) : ((result.images)? formatImageResponse(result.images) : null)),            
            card_image:desktop_course_image ? desktop_course_image : ((result.card_image)? formatImageResponse(result.card_image) : ((result.images)? formatImageResponse(result.images) : null)),
            card_image_mobile:mobile_course_image ? mobile_course_image : ((result.card_image_mobile)? formatImageResponse(result.card_image_mobile) : ((result.images)? formatImageResponse(result.images) : null)),
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
                language: ( result.languages) ? result.languages.join(", "): null,
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
                    
                    display_price: true,
                    pricing_type: result.pricing_type                  
                },
                course_start_date: result.course_start_date || null,
                course_end_date: result.course_end_date || null,
                course_enrollment_start_date: result.course_enrollment_start_date || null,
                course_enrollment_end_date: result.course_enrollment_end_date || null,
                course_batch: {
                    start_time: result.course_batch_start_time || null,
                    end_time: result.course_batch_end_time || null,
                    type: result.course_batch_type || null,
                    size: result.course_batch_size || null,
                    time_zone: result.course_batch_time_zone || null,
                    time_zone_name: result.course_batch_time_zone_name || null
                }
            },
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
            ads_keywords:result.ads_keywords,
            isCvTake:(result.cv_take && result.cv_take.display_cv_take)? true: false,
            is_subscription: (result.subscription_price)? result.subscription_price : false,
            show_enquiry: (result.enquiry)? result.enquiry : false,
            pricing_details: (result.pricing_details)? result.pricing_details : null,
            course_access_link: result.course_access_link
        };
        
        data.buy_on_careervira = false
        //get buy_on_careervira from partner
        let partnerData = await PartnerService.getPartner({params : {slug:result.partner_slug},query:{currency:currency}})
        if(partnerData && partnerData.buy_on_careervira)
        {
            data.buy_on_careervira =true
        }
        if(partnerData && partnerData.logo)
        {
            data.partner.logo =partnerData.logo
            data.partner.name_image =partnerData.name_image
        }  
        if(!isList)  data.pricing_details = {}    
        if(data.pricing_details)
        {
            data.pricing_details.pricing_type =  result.pricing_type
            data.pricing_details.display_price =  true     
        }

        
        //SET popular and trending keys
        const COURSE_POPULARITY_SCORE_THRESHOLD = await RedisConnection.getValuesSync("COURSE_POPULARITY_SCORE_THRESHOLD");

        data.isPopular = false
        if ( (COURSE_POPULARITY_SCORE_THRESHOLD >= 0) && result.activity_count && (result.activity_count.all_time.popularity_score > parseInt(COURSE_POPULARITY_SCORE_THRESHOLD))) {
            data.isPopular = true
        }

        const COURSE_TRENDING_SCORE_THRESHOLD = await RedisConnection.getValuesSync("COURSE_TRENDING_SCORE_THRESHOLD");

        data.isTrending = false
        if ( (COURSE_TRENDING_SCORE_THRESHOLD >= 0) && result.activity_count && (result.activity_count.last_x_days.trending_score > parseInt(COURSE_TRENDING_SCORE_THRESHOLD))) {
            data.isTrending = true
        }
       

        let coupons = [];
        let offerRange = {low:100, high:0}
        if(result.pricing_type == "Paid")
        {
            if(result.coupons && result.coupons.length > 0){
                let price;
                data.course_details.pricing.sale_price ? price = data.course_details.pricing.sale_price : price = data.course_details.pricing.regular_price

                for(let coupon of result.coupons)
                {
                    if(coupon.validity_start_date == null )
                        coupon.validity_start_date == new Date();
                    if(coupon.validity_end_date == null || isDateInRange(coupon.validity_start_date,  coupon.validity_end_date))
                    {
                        if(coupon.discount){
                            const discount = getCurrencyAmount(coupon.discount.value, currencies, coupon.discount.currency.iso_code, currency)
                            const percent = Math.ceil((100 * discount)/price)
                            if(percent < offerRange.low)
                                offerRange.low = percent
                            if(percent > offerRange.high)
                                offerRange.high = percent
                            coupon.youSave = coupon.discount.value + " "+ coupon.discount.currency.iso_code

                        }
                        else{
                            coupon.youSave = coupon.discount_percent + " %"
                            if(coupon.discount_percent < offerRange.low)
                                offerRange.low = coupon.discount_percent
                            if(coupon.discount_percent > offerRange.high)
                                offerRange.high = coupon.discount_percent
                        }
                        
                        coupons.push(coupon)
                    }
                }

            }
        }
        //coupon data 
        data.how_to_use =  coupons.length > 0 ? result.how_to_use: null
        data.coupons = coupons
        data.offerRange = coupons.length > 0 ? offerRange: null


        if(!isList){
            data.meta_description  = result.meta_description;
            data.meta_keywords  = result.meta_keywords;
            let meta_information = await generateMetaInfo  ('LEARN_CONTENT', data);
            if(meta_information)
            {
                data.meta_information  = meta_information;
                delete(data.meta_description)
                delete(data.meta_keywords)
                data.meta_information.add_type= result.add_type,
                data.meta_information.import_source= result.import_source,
                data.meta_information.external_source_id= result.external_source_id,
                data.meta_information.application_seat_ratio= result.application_seat_ratio,
                data.meta_information.bounce_rate= result.bounce_rate,
                data.meta_information.completion_ratio= result.completion_ratio,
                data.meta_information.enrollment_ratio= result.enrollment_ratio,
                data.meta_information.faculty_student_ratio= result.faculty_student_ratio,
                data.meta_information.gender_diversity= result.gender_diversity,
                data.meta_information.student_stream_diversity= result.student_stream_diversity,
                data.meta_information.student_nationality_diversity= result.student_nationality_diversity,
                data.meta_information.average_salary_hike= result.average_salary_hike,
                data.meta_information.instructor_citations= result.instructor_citations
            }            
        }
        else{
            data.meta_information = result.meta_information
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

            if(result.syllabus)
            {
                data.syllabus = {
                    name:result.syllabus.name,
                    url:result.syllabus.url
                }
            }            

            if(result.faq){
                data.faq = result.faq
            }
            if(result.content_module){
                data.content_module = result.content_module
            }
                       
            if(result.additional_batches)
            {
                data.additional_batches = []
                for (let batch of result.additional_batches)
                {
                    /*Show batch only if end date is not passed*/
                    let showBatch = true
                    if(batch.batch_end_date && (new Date(`${batch.batch_end_date} 23:59:59`) < new Date())){
                        showBatch = false
                    }
                    if(showBatch)
                    {
                        let additional_batch = {}
                        additional_batch.id = batch.id
                        additional_batch.batch = batch.batch
                        additional_batch.batch_size = batch.batch_size
                        additional_batch.batch_start_date = (batch.batch_start_date) ? new Date(batch.batch_start_date) : null
                        additional_batch.batch_end_date =(batch.batch_end_date)? new Date(batch.batch_end_date) :null
                        additional_batch.batch_enrollment_start_date = (batch.batch_enrollment_start_dat)? new Date(batch.batch_enrollment_start_date) :null
                        additional_batch.batch_enrollment_end_date = (batch.batch_enrollment_end_date)? new Date(batch.batch_enrollment_end_date) : null
                        additional_batch.total_duration = batch.total_duration
                        additional_batch.total_duration_unit = batch.total_duration_unit
                        additional_batch.batch_type = (batch.batch_type)? batch.batch_type.value : null                   
                        additional_batch.batch_timings = {
                            'time_zone_offset':(batch.batch_time_zone)? batch.batch_time_zone.time_zone_offset:null,
                            'time_zone_name':(batch.batch_time_zone)? batch.batch_time_zone.time_zone_name: null,
                            'start_time':(batch.batch_start_time)? batch.batch_start_time: null,
                            'end_time':(batch.batch_end_time)?batch.batch_end_time:null,
                        }                    
                        if(data.course_details.pricing.display_price){
                            additional_batch.pricing_type = batch.pricing_type
                            additional_batch.regular_price = (batch.regular_price)? getCurrencyAmount(batch.regular_price, currencies, baseCurrency, currency):null
                            additional_batch.sale_price = (batch.sale_price)?getCurrencyAmount(batch.sale_price, currencies, baseCurrency, currency):null
                            additional_batch.offer_percent = (batch.sale_price) ? (Math.round(((batch.regular_price-batch.sale_price) * 100) / batch.regular_price)) : null

                        }
                        data.additional_batches.push(additional_batch);
                    }
                }
            }

            if(result.cv_take && result.cv_take.display_cv_take)
            {
                data.cv_take = result.cv_take
            }
        }

        
        if(result.reviews && result.reviews.length > 0){
            let totalRating = 0;
            let ratings = {};
            for(let review of result.reviews){
                totalRating += review.rating;
                
                // if(!isList){
                //     if(review.photo){
                //         review.photo = getMediaurl(review.photo.thumbnail);                    
                //     }
                //     data.reviews.push(review);
                // }

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


        if(result.custom_ads_keywords) {
            data.ads_keywords +=`,${result.custom_ads_keywords}` 
        }
        if(result.enquiry)
            data.enquiry = result.enquiry
        if(!data.buy_on_careervira && data.pricing_details)
        {
            data.pricing_details.couponCount = coupons.length
        }
        let listData = {
            title: data.title,
            slug: data.slug,
            id: data.id,
            numeric_id:data.numeric_id,
            providers: data.providers,
            partner: data.partner,
            cover_image: desktop_course_image ? desktop_course_image: data.cover_image,
            sidebar_listing_image: data.sidebar_listing_image,            
            card_image:data.card_image,
            card_image_mobile:data.card_image_mobile,
            currency: data.currency,
            course_details: data.course_details,
            ratings: data.ratings,
            categories_list: data.categories_list,
            sub_categories_list : data.sub_categories_list,
            topics_list : data.topics_list,
            isTrending:data.isTrending,
            isPopular:data.isPopular,
            isCvTake:data.isCvTake,
            couponCount: coupons.length,
            is_subscription: data.is_subscription,
            show_enquiry: data.enquiry,
            pricing_details:data.pricing_details,
            buy_on_careervira:data.buy_on_careervira,
            course_access_link: data.course_access_link,
        }

        return isList ? listData : data;
    }



    async generateListViewData(rows, currency, isCaching = false){
        if(currencies.length == 0){
            currencies = await getCurrencies();
        }
        let datas = [];
        for(let row of rows){
            const data = await this.generateSingleViewData(row._source, true, currency, isCaching);
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

    async addPopularEntities(type, resource){
        try {
            if(type == "topic"){
                await helperService.logPopularEntities("topics", resource);
            }else if(type == "category"){
                await helperService.logPopularEntities("categories", resource);
            }
            else if(type == "skill"){
                await helperService.logPopularEntities("skills", resource);
            }
        } catch (error) {
            console.log("Course activity error",  error)
        }
         
     }

    async addActivity(req, callback){
       try {
           
            const {user} = req;
            const {courseId} = req.body	
            const activity_log =  await helperService.logActvity("COURSE_VIEW",(user)? user.userId : null, courseId);
            callback(null, {success: true, message: 'Added successfully!', data: null});
       } catch (error) {
           console.log("Course activity error",  error)
            callback(null, {success: false, message: 'Failed to Add', data: null});
       }
        
    }

    async invalidateEntityLabelCache(entity) 
    {
        getEntityLabelBySlugFromCache(entity, null, true)
    }

    async getLearnTypeImages(skipCache = false) 
    {
        let learn_types_images = {}
        let cacheName = `learn_type_images`
        let useCache = false
        if(skipCache !=true) {    
            let cacheData = await RedisConnection.getValuesSync(cacheName);
            if(cacheData.noCacheData != true) {
                learn_types_images =  cacheData   
                useCache = true				 
            }
        }
              
        if(useCache !=true)
        {
            let response = await fetch(`${apiBackendUrl}/learn-types`);
            if (response.ok) {
                let json = await response.json();
                if(json){
                    for(let learn_type of json)
                    {
                        
                        if( learn_type.image &&  learn_type.image.formats){
                            learn_types_images[learn_type.default_display_label] = formatImageResponse({
                            "small"  :(learn_type.image.formats.small)?learn_type.image.formats.small.url :null,
                            "medium"  :(learn_type.image.formats.medium)?learn_type.image.formats.medium.url :null,
                            "thumbnail"  :(learn_type.image.formats.thumbnail)?learn_type.image.formats.thumbnail.url :null,
                            "large"  :(learn_type.image.formats.large)?learn_type.image.formats.large.url :null
                            })
                        }                    
                    }
                    RedisConnection.set(cacheName, learn_types_images);
                }
            }           
            
           // RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_LEARN_TYPE_IMAGE);             
        } 

        return learn_types_images
    }

    async getSimilarCoursesML(courseId, currency = process.env.DEFAULT_CURRENCY, page=1,limit=6) {

        const { result, courseIdSimilarityMap } = await mLService.getSimilarCoursesDataML(courseId);
        let courses = [];
        const offset = (page-1) * limit;
        if (result && result.length) {
            for (const courseElasticData of result.slice(offset,offset+limit)) {
                const courseData = await this.generateSingleViewData(courseElasticData._source, false, currency);
                const { accreditations, ads_keywords, subtitle, prerequisites, target_students, content, meta_information, ...optimisedCourse } = courseData;
                optimisedCourse.similarity = courseIdSimilarityMap[optimisedCourse.id];
                courses.push(optimisedCourse);
            }
        }
        return courses;

    }
    async getTopCategories(req, callback) {
        try {

            const cacheName = "top-categories";
            const cacheData = await RedisConnection.getValuesSync(cacheName);
            if (!cacheData.noCacheData) {
                return callback(null, cacheData);
            }

            const query = {
                bool: {
                    "must": [
                        {
                            "ids": {
                                "values": [
                                    "HOME_2"
                                ]
                            }
                        }
                    ]
                }
            };
            const result = await elasticService.search('home-page', query, { _source: "category_recommendations" });
            let categoryRecommendations = [];
            
            if (result && result.hits && result.hits.length) {
                categoryRecommendations = result.hits[0]["_source"]["category_recommendations"];
                
            }

            const response = { "success": true, message: "list fetched successfully", data: { list: categoryRecommendations } };

            if(categoryRecommendations.length){

                RedisConnection.set(cacheName, response);
                RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_TOP_CATEGORIES || 86400);
            }

            

            callback(null, response);

        }
        catch (error) {
            console.log("Error occured while fetching top categories : ", error)
            callback(null, { "success": false, message: "failed to fetch", data: { list: [] } });

        }
    }


    async exploreCoursesFromTopCatgeories(req, callback) {

        try {
            req.query.subType = "Popular"
            const data = await this.getPopularCourses(req, null, true);
            callback(null, { "success": true ,message: "list fetched successfully", data: { list: data,mlList:[],show:"logic" } });

        } catch (error) {
            console.log("Error occured while fetching top courses : ",error)
            callback(null, { "success": false ,message: "failed to fetch", data: { list: [] } });
        }
    }


    async getTopPicksForYou(req, callback) {

        try {
            const userId = req.user.userId;
            const { currency = process.env.DEFAULT_CURRENCY, page = 1, limit = 6 } = req.query;

            let skills = null;
            const topSkills = await models.user_meta.findOne({ attributes: ['value'], where: { userId: userId, metaType: 'primary', key: 'primarySkills' } });

            if (topSkills && topSkills.value && topSkills.value != "{}") {
                skills = JSON.parse(topSkills.value);
            }
            else {
                const additionalSkills = await models.user_meta.findOne({ where: { userId: userId, metaType: 'primary', key: 'skills' } })
                if (additionalSkills && additionalSkills.value && additionalSkills.value != "{}") skills = JSON.parse(additionalSkills.value);
            }

            let workExp = null;
            const workExperience = await models.user_meta.findOne({ attributes: ['value'], where: { userId: userId, metaType: 'primary', key: 'workExp' } });

            let skillsKeywords = [];
            let workExpKeywords = [];

            if (skills) {
                for (const key in skills) {
                    skillsKeywords.push(key);
                    skillsKeywords.push(...skills[key]);
                }
            }

            if (workExperience && workExperience.value && workExperience.value != "[]") {
                workExp = JSON.parse(workExperience.value);
                workExp.forEach((workExp) => {
                    if (workExp.jobTitle) {
                        workExpKeywords.push(workExp.jobTitle.label);
                    }

                    if (workExp.industry) {
                        workExpKeywords.push(workExp.industry.label);
                    }
                });
            }

            let limitForSkills = 0;
            let limitForWorkExp = 0;

            if (skills && workExp) {
                limitForSkills = Math.floor(limit / 2);
                limitForWorkExp = limit - limitForSkills;
            }
            else if (skills) {
                limitForSkills = limit;
            }
            else if (workExp) {
                limitForWorkExp = limit;
            }

            const esQuery = {
                bool: {
                    must: [
                        {
                            term: {
                                "status.keyword": "published"
                            }
                        }
                    ],
                    should: [
                        {
                            query_string: {
                                default_field: "title"
                            }
                        }
                    ]
                }
            }

            let courses = [];
            if (skills) {
                const offset = (page - 1) * limitForSkills;
                esQuery.bool.should[0].query_string.query = skillsKeywords.join(" OR ");
                const result = await elasticService.search("learn-content", esQuery, { from: offset, size: limitForSkills });
                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        const data = await this.generateSingleViewData(hit._source, true, currency)
                        courses.push(data);
                    }
                }
            }

            if (workExp) {
                const offset = (page - 1) * limitForWorkExp;
                esQuery.bool.should[0].query_string.query = workExpKeywords.join(" OR ");
                const result = await elasticService.search("learn-content", esQuery, { from: offset, size: limitForWorkExp });
                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        const data = await this.generateSingleViewData(hit._source, true, currency)
                        courses.push(data);
                    }
                }
            }

            if (!skills && !workExp) {
                req.query.subType = "Popular"
                if (!req.query.page) req.query.page = 1;
                if (!req.query.limit) req.query.limit = 6;
                courses = await this.getPopularCourses(req, null, true);
            }

            callback(null, { "success": true, message: "list fetched successfully", data: { list: courses, mlList: [], show: "logic" } });
        } catch (error) {
            console.log("Error occured while fetching top picks for you : ", error);
            callback(null, { "success": false, message: "failed to fetch", data: { list: [] } });

        }
    }

    
    async getLearnContentLearntypes(req) {
        let {page =1, limit= 5, category, sub_category, topic} = req.query
        let cacheName = 'learn-content-learn-types'
        let data = {};
        try {

            let query = {
             "match_all": {}
            };

            if(category)
            {
                query = {
                    "term": {
                        "categories.keyword": {
                            "value": decodeURIComponent(category)
                        }
                    }
                };

                cacheName = cacheName + category
            }

            if(sub_category)
            {
                query = {
                    "term": {
                        "sub_categories.keyword": {
                            "value": decodeURIComponent(sub_category)
                        }
                    }
                };
                cacheName = cacheName + sub_category
            }

            if(topic)
            {
                query = {
                    "term": {
                        "topics.keyword": {
                            "value": decodeURIComponent(topic)
                        }
                    }
                };
                cacheName = cacheName + topic
            }
            

            const aggs = {
                "learn_type_count": {
                    "terms": {
                    "field": "learn_type.keyword"
                    }
                }
            }

            const payload = {
                "size":0,
                aggs
            };
                
            let cacheData = await RedisConnection.getValuesSync(cacheName); 
            let  result = cacheData;             

            if(cacheData.noCacheData) 
            {
                result = await elasticService.searchWithAggregate('learn-content', query, payload);
                await RedisConnection.set(cacheName, result);
                RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_LISTING_COURSE || 60 * 60 * 24);
            }

            let learn_types = []
            let learn_types_images = await this.getLearnTypeImages();
           
            if (result.aggregations && result.aggregations.learn_type_count.buckets.length >0) {
                result.aggregations.learn_type_count.buckets.map(item => learn_types.push({label: item.key, count: formatCount(item.doc_count),images: learn_types_images[item.key]}))
                
                data = {
                    total: learn_types.length,
                    page,
                    limit,
                    learn_types: await paginate(learn_types, page, limit)
                }
                return { success: true, data }
            }
            return { success: false, data:null }

        } catch (error) {
            console.log("Error fetching top categories in home page", error);
            return { success: false, data:null }
        }
    }

    async getLearnContentTopics(req) {
        let {page =1, limit= 5, category, sub_category} = req.query
        let cacheName = 'learn-content-topics'
        let data = {};
        try {

            let query = {
             "match_all": {}
            };

            if(category)
            {
                query = {
                    "term": {
                        "categories.keyword": {
                            "value": decodeURIComponent(category)
                        }
                    }
                };

                cacheName = cacheName + category
            }

            if(sub_category)
            {
                query = {
                    "term": {
                        "sub_categories.keyword": {
                            "value": decodeURIComponent(sub_category)
                        }
                    }
                };
                cacheName = cacheName + sub_category
            }

            const aggs = {
                "topics_count": {
                    "terms": {
                    "field": "topics.keyword"
                    }
                }
            }

            const payload = {
                "size":0,
                aggs
            };
                
            let cacheData = await RedisConnection.getValuesSync(cacheName); 
            let  result = cacheData;             

            if(cacheData.noCacheData) 
            {
                result = await elasticService.searchWithAggregate('learn-content', query, payload);
                await RedisConnection.set(cacheName, result);
                RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_LISTING_COURSE || 60 * 60 * 24);
            }

            let topics = []
           
            if (result.aggregations && result.aggregations.topics_count.buckets.length >0) {
                await Promise.all(result.aggregations.topics_count.buckets.map(async item => {
                    let slug = await helperService.getTreeUrl('topic', item.key, true)                    
                    topics.push( {
                                label:item.key,
                                slug : slug
                            })
                }))
                        
                data = {
                    total: topics.length,
                    page,
                    limit,
                    topics: await paginate(topics, page, limit)
                }
                return { success: true, data }
            }
            return { success: false, data:null }

        } catch (error) {
            console.log("Error fetching top categories in home page", error);
            return { success: false, data:null }
        }
    }

    
  async getCourseLandingPage(req) {
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

      let cacheData = await RedisConnection.getValuesSync('course-home-page');
      let result = cacheData;

      if (cacheData.noCacheData) {
        result = await elasticService.search('course-home-page', query, payload, ["top_categories", "course_recommendation_categories", "trending_skillls","free_trending_skills","meta_description", "meta_keywords"]);
        await RedisConnection.set('course-home-page', result);
        RedisConnection.expire('course-home-page', process.env.CACHE_EXPIRE_HOME_PAGE);
      }
        if (result.hits && result.hits.length) {
            data = result.hits[0]._source
            // check if course recomndation categories have minimum 4 courses 
            if (data.course_recommendation_categories && data.course_recommendation_categories) {
                data.course_recommendation_categories = await Promise.all(
                    data.course_recommendation_categories.map(async (category) => {
                        let reqObj = {
                            query: {
                                category: category.name
                            }
                        }
                        let recommendation = await RecommendationService.getPopularCourses(reqObj)
                        if (recommendation.success && recommendation.data && recommendation.data.list && recommendation.data.list.length > 3) {
                            return category
                        } else {
                            return null
                        }

                    })

                )
                data.course_recommendation_categories = data.course_recommendation_categories.filter(category => category != null)
            }

            // check if Trending skill have minimum 6 courses 
            if (data.trending_skillls && data.trending_skillls) {
                data.trending_skillls = await Promise.all(
                    data.trending_skillls.map(async (skill) => {
                        let reqObj = {
                            query: {
                                skill: skill.name,
                                subType : 'Trending'
                            }
                        }
                        let recommendation = await RecommendationService.getPopularCourses(reqObj)
                        if (recommendation.success && recommendation.data && recommendation.data.list && recommendation.data.list.length > 6) {
                            return skill
                        } else {
                            return null
                        }

                    })

                )
                data.trending_skillls = data.trending_skillls.filter(skill => skill != null)
            }

            // check if (Free) Trending skill have minimum 6 courses 
            if (data.free_trending_skills && data.free_trending_skills) {
                data.free_trending_skills = await Promise.all(
                    data.free_trending_skills.map(async (skill) => {
                        let reqObj = {
                            query: {
                                skill: skill.name,
                                subType : 'Trending',
                                priceType: 'Free'
                            }
                        }
                        let recommendation = await RecommendationService.getPopularCourses(reqObj);
                        if (recommendation.success && recommendation.data && recommendation.data.list && recommendation.data.list.length > 6)
                            return skill;
                        else
                            return null
                    })

                )
                data.free_trending_skills = data.free_trending_skills.filter(skill => skill);
            }
        return { success: true, data }
      }
      return { success: false, data: null }

    } catch (error) {
      console.log("Error fetching top categories in course-home-page", error);
      return { success: false, data: null }
    }
  }

  async geCourseLandingPageTopCategories(req) {
    let { page = 1, limit = 5 } = req.query

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

      let cacheData = await RedisConnection.getValuesSync('course-home-page-top-categories');
      let result = cacheData;

      if (cacheData.noCacheData) {
        result = await elasticService.search('course-home-page', query, payload, ["top_categories"]);
        await RedisConnection.set('course-home-page-top-categories', result);
        RedisConnection.expire('course-home-page-top-categories', process.env.CACHE_EXPIRE_HOME_PAGE);
      }

      if (result.hits && result.hits.length) {
        data = {
          total: result.hits[0]._source.top_categories.length,
          page,
          limit,
          categories: await paginate(result.hits[0]._source.top_categories, page, limit)
        }
        return { success: true, data }
      }
      return { success: false, data: null }

    } catch (error) {
      console.log("Error fetching top categories in course-home-page", error);
      return { success: false, data: null }
    }
  }

  async getPopularCategories(req, skipCache=false) {
    let { page = 1, limit = 5 } = req.query

    let data = {};
    let result = null
    let cacheData = null
    let categories = []
    try {

      if(skipCache !=true) {
        cacheData = await RedisConnection.getValuesSync('course-home-page-popular-categories');
        categories = cacheData;
      }

      if ((cacheData && cacheData.noCacheData) || skipCache) {
        result = await models.popular_categories.findAll({          
           
            attributes: ['name'],
            order: [
                ['count', 'DESC']
            ]
        })
         // check if course recomndation categories have minimum 4 courses 
         
         if (result && result.length > 0) {
            categories =  result.map(category => {return  {name:category.name}})
            categories = await Promise.all(                
                categories.map(async (category) => {
                    let reqObj = {
                        query: {
                            category: category.name
                        }
                    }                   
                    let recommendation = await RecommendationService.getPopularCourses(reqObj)
                   
                    if (recommendation.success && recommendation.data && recommendation.data.list && recommendation.data.list.length > 3) {
                        return category
                    } else {
                        return null
                    }

                })
            )
           
            categories = categories.filter(category => category != null)
        }

        await RedisConnection.set('course-home-page-popular-categories', categories);
      }

      if (categories && categories.length) {
        data = {
          total: categories.length,
          page,
          limit,
          categories: await paginate(categories, page, limit)
        }
        return { success: true, data }
      }
      return { success: false, data: null }

    } catch (error) {
      console.log("Error fetching top categories in course-home-page", error);
      return { success: false, data: null }
    }
  }

}