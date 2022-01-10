const elasticService = require("./elasticService");
const reviewService = require("./reviewService");
const ReviewService = new reviewService();
const fetch = require("node-fetch");
const pluralize = require('pluralize')
const { getCurrencies, getCurrencyAmount, generateMetaInfo } = require('../utils/general');

const { 
    getFilterConfigs, 
    parseQueryFilters,
    getPaginationQuery,
    getPaginationDefaultSize,
    getMediaurl,
    getFilterAttributeName,
    updateSelectedFilters,
} = require('../utils/general');

const redisConnection = require('../../services/v1/redis');

const RedisConnection = new redisConnection();

const apiBackendUrl = process.env.API_BACKEND_URL;

const articleService = require("./articleService");
let ArticleService = new articleService();

let slugMapping = [];
let currencies = [];
const rangeFilterTypes = ['RangeSlider','RangeOptions'];
const filterFields = ['topics','categories','sub_categories','title','level','learn_type','languages','medium','instruction_type','pricing_type','provider_name','skills', 'partner_name'];
const allowZeroCountFields = ['level','categories','sub_categories'];

const helperService = require("../../utils/helper");

const getBaseCurrency = (result) => {
    return result.learn_content_pricing_currency? result.learn_content_pricing_currency.iso_code:null;
};

const getEntityLabelBySlugFromCache= async (entity, slug) =>
{
    let cacheName = `enity_slug_${entity}`;
    let entities = {}
    let useCache = false        
    let cacheData = await RedisConnection.getValuesSync(cacheName);
    if(cacheData.noCacheData != true) {
        entities =  cacheData   
        useCache = true				 
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
                       let article_advice = [];
                       let featured_articles = [];
                       if(entity.article_advice && entity.article_advice.length > 0)
                       {
                           article_advice = entity.article_advice.map((article)=> article.id);
                       }
                       if(entity.featured_articles && entity.featured_articles.length > 0)
                       {
                           featured_articles = entity.featured_articles.map((article)=> article.id);
                       }
                        entities[entity.slug] = {
                            "default_display_label"  :(entity.default_display_label)?entity.default_display_label :null,
                            "description"  :(entity.description)?entity.description :null,
                            "article_advice":article_advice,
                            "featured_articles": featured_articles
                        }
                    }                    
                }
            }
        }
        RedisConnection.set(cacheName, entities);
        RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_ENTITY_SLUG); 
    }

    return entities[slug]
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

                cacheData[slug] = {
                "default_display_label"  :(json[0].default_display_label)?json[0].default_display_label :null,
                "description"  :(json[0].description)?json[0].description :null,
                }
                RedisConnection.set(cacheName, cacheData);
                RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_ENTITY_SLUG);
            }

            return json[0];
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

module.exports = class learnContentService {

    async getLearnContentList(req, callback, skipCache){

        try{

        let defaultSize = await getPaginationDefaultSize();
        let defaultSort = "ratings:desc";
        let useCache = false;
        let cacheName = "";
        if(
            req.query['courseIds'] == undefined
            && req.query['f'] == undefined
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
                cacheName = "listing-"+req.query['pageType']+"-"+req.query['slug'].replace(/,/g, '_')+"_"+apiCurrency;
            } else if((req.query['pageType'] == undefined || req.query['pageType'] == "search") && (req.query['q'] == undefined || req.query['q'] == '')) {
                cacheName = "listing-search_"+apiCurrency;                
            }

            cacheName += `_${defaultSort}`;

            if(skipCache != true) {
                let cacheData = await RedisConnection.getValuesSync(cacheName);
                if(cacheData.noCacheData != true) {
                    return callback(null, {status: 'success', message: 'Fetched successfully!', data: cacheData});
                }
            }
        }

        let esFilters = {};


        currencies = await getCurrencies();
        slugMapping = getSlugMapping(req);


        const filterConfigs = await getFilterConfigs('Learn_Content');
        
        const query = { 
            "bool": {
                "must": [
                    {term: { "status.keyword": 'published' }}                
                ],
            }
        };

        let queryPayload = {};
        let paginationQuery = await getPaginationQuery(req.query);
        queryPayload.from = paginationQuery.from;
        queryPayload.size = paginationQuery.size;

        if(!req.query['sort'] && !req.query['q']){
            req.query['sort'] = defaultSort;
        }

        if(req.query['sort']){
            
            const keywordFields = ['title'];
            let sort = req.query['sort'];
            let splitSort = sort.split(":");
            if(keywordFields.includes(splitSort[0])){
                sort = `${splitSort[0]}.keyword:${splitSort[1]}`;
            }
            queryPayload.sort = [sort];
            
        }

        if(req.query['courseIds']){
            let courseIds = req.query['courseIds'].split(",");
            
            let filter_object = {
                "terms": {
                  "id": courseIds 
                }
            }

            query.bool.must.push(filter_object)
            esFilters['courseIds'] = filter_object;
        }

        let slugs = [];
        let query_slug;
        if(req.query['slug']){
            slugs = req.query['slug'].split(",");
            
            for(let i=0; i<slugs.length; i++){
                query_slug = slugs[i].replace("&", "%26");
                var slug_data = await getEntityLabelBySlug(slugMapping[i].entity_key, query_slug);
                var slugLabel = slug_data.default_display_label;
                var slug_pageType = slugMapping[i].pageType;
                var slug_description = slug_data.description;
                var slug_article_advice = slug_data.article_advice;
                var slug_featured_articles = slug_data.featured_articles;
                if(!slugLabel){
                    slugLabel = slugs[i];                
                }


                let filter_object =  {
                    "terms": {[`${slugMapping[i].elastic_key}.keyword`]: [slugLabel]}
                }

                query.bool.must.push(filter_object);

                esFilters['slugged'] = filter_object;

            }           
        }

        if(req.query['q']){

            let filter_object = {                    
                "bool": {
                    "should": [
                      {
                        "query_string" : {
                            "query" : `*${decodeURIComponent(req.query['q']).replace("+","//+").trim()}*`,
                            "fields" : ['title^7','categories^6','sub_categories^5','provider_name^4','level^3','medium^2','partner_name'],
                            "analyze_wildcard" : true,
                            "allow_leading_wildcard": true
                        }
                      },
                      {
                          "multi_match": {
                                  "fields": ['title^7','categories^6','sub_categories^5','provider_name^4','level^3','medium^2','partner_name'],
                                  "query": decodeURIComponent(req.query['q']).trim(),
                                  "fuzziness": "AUTO",
                                  "prefix_length": 0                              
                          }
                      }           
                    ]
                  }                    
                }


            query.bool.must.push(filter_object);
            esFilters['q'] = filter_object;
            
        }
        let parsedFilters = [];
        let parsedRangeFilters = [];       
        let filters = [];
        
        if(req.query['f']){
            parsedFilters = parseQueryFilters(req.query['f']);
            for(const filter of parsedFilters){                
                let elasticAttribute = filterConfigs.find(o => o.label === filter.key);
                if(elasticAttribute){
                    const attribute_name  = getFilterAttributeName(elasticAttribute.elastic_attribute_name, filterFields);

                    let filter_object = {
                        "terms": {[attribute_name]: filter.value}
                    };

                    query.bool.must.push(filter_object);
                    esFilters[elasticAttribute.elastic_attribute_name] = filter_object;
                }
            }
            if(req.query['f'].includes("Price Type:"))
            {
                query.bool.must.push(  {          
                    "bool": {
                      "must_not": [
                        {"term": {
                          "display_price": {
                            "value": "false"
                          }
                        }}
                      ]
                    }
                 });
                esFilters["display_price"] =  {          
                    "bool": {
                      "must_not": [
                        {"term": {
                          "display_price": {
                            "value": "false"
                          }
                        }}
                      ]
                    }
                 };
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

                    query.bool.must.push(filter_object);
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
            { key: 'Less Than a Week', to: 168 },
            { key: '1 - 4 Weeks', from: 168, to: 672 },
            { key: '1 - 3 Months', from: 672, to: 2016 },
            { key: '3+ Months', from: 2016 },
        ]

        for(let filter of filterConfigs) {
            

            let exemted_filters = esFilters;

            if(esFilters.hasOwnProperty(filter.elastic_attribute_name)){
                let {[filter.elastic_attribute_name]: ignored_filter, ...all_filters } = esFilters 
                exemted_filters = all_filters;
            }

            exemted_filters = Object.keys(exemted_filters).map(key=>exemted_filters[key]);

            if(filter.elastic_attribute_name == "pricing_type")
            {
                exemted_filters.push(  {          
                    "bool": {
                      "must_not": [
                        {"term": {
                          "display_price": {
                            "value": "false"
                          }
                        }}
                      ]
                    }
                 });
            }

            exemted_filters.push(published_filter);

            let aggs_object = {
                filter: { bool: { filter: exemted_filters } },
                aggs: {}
            }

            switch(filter.filter_type){
                case "Checkboxes":
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

        queryPayload.aggs = aggs;

        // --Aggreation query build

        let result = await elasticService.searchWithAggregate('learn-content', query, queryPayload);

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
                    var learn_types_images = {};
                    let cacheName = `learn_type_images`
                    let useCache = false        
                    let cacheData = await RedisConnection.getValuesSync(cacheName);
                    if(cacheData.noCacheData != true) {
                        learn_types_images =  cacheData   
                        useCache = true				 
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
                                        learn_types_images[learn_type.default_display_label] = {
                                        "small"  :(learn_type.image.formats.small)?learn_type.image.formats.small.url :null,
                                        "medium"  :(learn_type.image.formats.medium)?learn_type.image.formats.medium.url :null,
                                        "thumbnail"  :(learn_type.image.formats.thumbnail)?learn_type.image.formats.thumbnail.url :null,
                                        "large"  :(learn_type.image.formats.large)?learn_type.image.formats.large.url :null
                                        }
                                    }                    
                                }
                            }
                        }           
                        RedisConnection.set(cacheName, learn_types_images);
                        RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_LEARN_TYPE_IMAGE);             
                    }       
                          
                }


                let facet = aggs_result.course_filters[filter.elastic_attribute_name];

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
                };

                if(filter.filter_type == "RangeSlider"){

                    if(filter.elastic_attribute_name === "basePriceRound"){
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
               let category_tree =[];
               let categoryFiletrOption =[];
               let categorykey = 0;
    
               let response = await fetch(`${apiBackendUrl}/category-tree`);
    
                if (response.ok) {
                   let json = await response.json();
                   if(json && json.final_tree){
                       category_tree = json.final_tree;
                    }
                }
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
                list = await this.generateListViewData(result.hits, req.query['currency'], useCache);
            }


            //Remove filters if requested by slug
            for (let i = 0; i < slugs.length; i++) {
                const config = filterConfigs.find(o => o.elastic_attribute_name === slugMapping[i].elastic_key);
                if (config) {
                    filters = filters.filter(o => o.label !== config.label);
                }
            }

            let data = {
                list: list,
                filters: filters,
                pagination: pagination,
                sort: req.query['sort'],
            };


            data.page_details = {
                pageType: slug_pageType || "default",
                slug: req.query['slug'] || null,
                label: slugLabel || null,
                description: slug_description || null,
            }
            if (slug_pageType == "category" || slug_pageType == "sub_category" || slug_pageType == "topic") {
                try {
                    data.article_advice = []
                    data.featured_articles = []
                    if(slug_article_advice && slug_article_advice.length >0 )
                    {
                        data.article_advice = await ArticleService.getArticleByIds(slug_article_advice, true, false);
                    }
                    if(slug_featured_articles && slug_featured_articles.length >0 )
                    {
                        data.featured_articles = await ArticleService.getArticleByIds(slug_featured_articles, true, false);
                    }
                } catch (error) {
                    console.log("Error in getArticleByIds", error)
                    data.article_advice = []
                    data.featured_articles = []
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

            let meta_information = await generateMetaInfo('learn-content-list', result);
            
            if (meta_information) {
                data.meta_information = meta_information;
            }


            callback(null, { status: 'success', message: 'Fetched successfully!', data: data });

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
        callback(null, {status: 'error', message: 'Failed to fetch!', data: {list: [], pagination: {total: 0}, filters: []}});

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
                callback(null, {status: 'success', message: 'Fetched successfully!', data: cacheData});
                useCache = true
            }            
        }
              
        if(useCache !=true)
        {
            const course = await this.fetchCourseBySlug(slug);
            if(course){
                const data = await this.generateSingleViewData(course, false, req.query.currency);
                courseId = data.id
                this.getReviews({params:{courseId: data.id}, query: {}}, (err,review_data)=>{
                    if(review_data && review_data.data) data.reviews_extended = review_data.data;
                    callback(null, {status: 'success', message: 'Fetched successfully!', data: data});
                    RedisConnection.set(cacheName, data); 
                    RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_SINGLE_COURSE);                   
                }) 
                
            }else{
                callback({status: 'failed', message: 'Not found!'}, null);
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
        const { courseId } = req.params;
        const { currency } = req.query;
        const MAX_RESULTS = 6;

        try {

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

            let result = await elasticService.search("learn-content", esQuery, { from: 0, size: MAX_RESULTS });
            
            let courses = [];
            if (result && result.hits.length > 0) {
                for (let hit of result.hits) {
                    let course = await this.generateSingleViewData(hit._source, false, currency);
                    const {accreditations,ads_keywords,subtitle,prerequisites,target_students,content,meta_information,...optimisedCourse} = course;
                    courses.push(optimisedCourse);
                }
            }

            let response = { success: true, message: "list fetched successfully", data:{ list: courses } };
            callback(null, response);
        } catch (error) {
            console.log("Error while processing data for related courses", error);
            callback(error, null);
        }
    }

    async getPopularCourses(req, callback, returnData) {
        let { type } = req.params; // Populer, Trending,Free
        let { category, sub_category, topic, currency, page = 1, limit =20} = req.query;       
        
        let offset= (page -1) * limit
        
        let courses = [];
        try {
            
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
            
            if(type && type =="Free"){
                esQuery.bool.filter.push(
                    { "term": { "pricing_type.keyword": "Free" } }
                );
                 esQuery.bool.filter.push(
                    { "term": { "display_price": true } }
                );
            }
            let sort = null
            switch (type) {                
                case "Trending":
                    sort = [{ "activity_count.last_x_days.course_views" : "desc" },{ "ratings" : "desc" }]
                    break; 
                default:
                    sort = [{ "activity_count.all_time.course_views" : "desc" },{ "ratings" : "desc" }]
                    break;
            }
            
            let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject:sort});
                
            if(result.hits){
                for(const hit of result.hits){
                    var data = await this.generateSingleViewData(hit._source,true,currency)
                    courses.push(data);
                }
            }
            
            let response = { success: true, message: "list fetched successfully", data:{ list: courses } };
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
        callback(null, {status: 'success', message: 'Fetched successfully!', data: categories});
    }



    async getCourseByIds(req, callback){
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
                const queryBody =  {
                    "ids": {
                        "values": ids
                    }
                };
                let queryPayload = {size : 1000}
                const result = await elasticService.search('learn-content', queryBody, queryPayload);
                if(result.hits){
                    if(result.hits && result.hits.length > 0){
                        for(const hit of result.hits){
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
        } catch (error) {
            callback(null, {status: 'error', message: 'Failed to Fetch', data: null});
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
        callback(null, {status: 'success', message: 'Fetched successfully!', data: courses});
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
        //let coverImageSize = 'large';
        //if(isList){
           // coverImageSize = 'thumbnail';
        //}

        for(let i=0; i<result.reviews.length; i++){
            if(result.reviews[i]['reviewer_name'] == 'Other'){
                result.reviews.splice(i, 1);
            }
        }

        // let cover_image = null;
        // if(result.images){
        //     if(result.images[coverImageSize]){
        //         cover_image = getMediaurl(result.images[coverImageSize]);
        //     }else{
        //         cover_image = getMediaurl(result.images['thumbnail']);
        //     }
        // }

        let partnerPrice = helperService.roundOff(result.finalPrice, 2);   //final price in ES
        let partnerPriceInUserCurrency = parseFloat(getCurrencyAmount(result.finalPrice, currencies, baseCurrency, currency));
        let conversionRate = helperService.roundOff((partnerPrice / partnerPriceInUserCurrency), 2);
        let tax = 0.0;
        let canBuy = false;
        if(result.learn_content_pricing_currency && result.learn_content_pricing_currency.iso_code === "INR" && result.pricing_type !="Free") {
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
            currency: result.learn_content_pricing_currency?result.learn_content_pricing_currency:null,            
            instructors: [],
            cover_video: (result.video) ? getMediaurl(result.video) : null,
            cover_image: (result.images)? result.images :null,
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
                    
                    display_price: ( typeof result.display_price !='undefined' && result.display_price !=null)? result.display_price :true,
                    pricing_type: result.pricing_type,
                    currency:result.learn_content_pricing_currency? result.learn_content_pricing_currency.iso_code:null,
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
                    partnerPrice: partnerPrice,
                    partnerPriceInUserCurrency: partnerPriceInUserCurrency,
                    partnerRegularPrice: helperService.roundOff(result.regular_price, 2),
                    partnerSalePrice: helperService.roundOff(result.sale_price, 2),
                    conversionRate: conversionRate,
                    tax: tax
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
           
            let meta_information = await generateMetaInfo  ('learn-content', result);
            if(meta_information)
            {
                data.meta_information  = meta_information;
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

            if(result.syllabus)
            {
                data.syllabus = {
                    name:result.syllabus.name,
                    url:result.syllabus.url
                }
            }
            
            if(data.course_details.pricing.display_price && data.course_details.pricing.course_financing_options)
            {
                data.course_details.pricing.indian_students_program_fee = result.indian_students_program_fee
                data.course_details.pricing.indian_students_payment_deadline = result.indian_students_payment_deadline
                data.course_details.pricing.indian_students_GST = result.indian_students_GST
                data.course_details.pricing.indian_student_installments = result.indian_student_installments
                data.course_details.pricing.international_students_program_fee = result.international_students_program_fee
                data.course_details.pricing.international_students_payment_deadline = result.international_students_payment_deadline
                data.course_details.pricing.international_student_installments = result.international_student_installments
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
                    let additional_batch = {}
                    additional_batch.id = batch.id
                    additional_batch.batch = batch.batch
                    additional_batch.batch_size = batch.batch_size
                    additional_batch.batch_start_date = batch.batch_start_date
                    additional_batch.batch_end_date = batch.batch_end_date
                    additional_batch.batch_enrollment_start_date = batch.batch_enrollment_start_date
                    additional_batch.batch_enrollment_end_date = batch.batch_enrollment_end_date
                    additional_batch.total_duration = batch.total_duration
                    additional_batch.total_duration_unit = batch.total_duration_unit
                    additional_batch.batch_type = (batch.batch_type)? batch.batch_type.value : "-"                    
                    additional_batch.batch_timings = {
                        'time_zone_offset':(batch.batch_time_zone)? batch.batch_time_zone.time_zone_offset: "-",
                        'time_zone_name':(batch.batch_time_zone)? batch.batch_time_zone.time_zone_name: "-",
                        'start_time':(batch.batch_start_time)? batch.batch_start_time: null,
                        'end_time':(batch.batch_end_time)?batch.batch_end_time:null,
                    }                    
                    if(data.course_details.pricing.display_price){
                        additional_batch.pricing_type = batch.pricing_type
                        additional_batch.regular_price = (batch.regular_price)? getCurrencyAmount(batch.regular_price, currencies, baseCurrency, currency):null
                        additional_batch.sale_price = (batch.sale_price)?getCurrencyAmount(batch.sale_price, currencies, baseCurrency, currency):null
                    }
                    data.additional_batches.push(additional_batch);
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

        let listData = {
            title: data.title,
            slug: data.slug,
            id: data.id,
            provider: data.provider,
            partner: data.partner,
            cover_image: data.cover_image,
            currency: data.currency,
            description: data.description,
            course_details: data.course_details,
            provider_course_url: data.provider_course_url,
            ratings: data.ratings,
            categories_list: data.categories_list,
            sub_categories_list : data.sub_categories_list,
            topics_list : data.topics_list

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

    async addActivity(req, callback){
       try {
           
            const {user} = req;
            const {courseId} = req.body	
            const activity_log =  await helperService.logActvity("COURSE_VIEW",(user)? user.userId : null, courseId);
            callback(null, {status: 'success', message: 'Added successfully!', data: null});
       } catch (error) {
           console.log("Course activity error",  error)
            callback(null, {status: 'error', message: 'Failed to Add', data: null});
       }
        
    }
}