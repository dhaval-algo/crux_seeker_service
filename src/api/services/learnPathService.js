const elasticService = require("./elasticService");
const learnContentService = require("./learnContentService");
let LearnContentService = new learnContentService();
const fetch = require("node-fetch");

const reviewService = require("./reviewService");
const ReviewService = new reviewService();
const helperService = require("../../utils/helper");

const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();

const categoryService = require("./categoryService");
const CategoryService = new categoryService();

const apiBackendUrl = process.env.API_BACKEND_URL;

const {
    getFilterConfigs,
    parseQueryFilters,
    getPaginationQuery,
    getPaginationDefaultSize,
    getMediaurl,
    getFilterAttributeName,
    updateSelectedFilters,
    getCurrencies,
    getCurrencyAmount
} = require('../utils/general');

const round = (value, step) => {
    step || (step = 1.0);
    var inv = 1.0 / step;
    return Math.round(value * inv) / inv;
};

let currencies = [];
const ENTRY_PER_PAGE = 25;

const filterFields = ['topics', 'categories', 'sub_categories', 'title', 'levels', 'medium', 'pricing_type','life_stages'];


const parseQueryRangeFilters = (filter) => {
    const parsedFilterString = decodeURIComponent(filter);
    let query_filters = [];
    const filterArray = parsedFilterString.split("::");
    for (const qf of filterArray) {
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

module.exports = class learnPathService {
    async addPopularEntities(type, resource){
        try {
            if(type == "topic"){
                const activity_log =  await helperService.logPopularEntities("topics", resource);
            }else if(type == "category"){
                const activity_log =  await helperService.logPopularEntities("categories", resource);
            }
            else if(type == "skill"){
                const activity_log =  await helperService.logPopularEntities("skills", resource);
            }
        } catch (error) {
            console.log("Learn Path activity entity error",  error)
        }
         
    }

    async getLearnPathList(req, callback, skipCache) {

        try {
            let defaultSize = ENTRY_PER_PAGE;
            let defaultSort = "ratings:desc";
            let useCache = false;
            let cacheName = "learnpath";

            if(
                req.query['learnPathIds'] == undefined
                && req.query['f'] == undefined
                && (req.query['q'] == undefined || req.query['q'] == '')
                && req.query['rf'] == undefined
                && (req.query['page'] == "1" || req.query['page'] == undefined)
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
               
                cacheName += `_${apiCurrency}_${defaultSort}`;
    
                if(skipCache != true) {
                    let cacheData = await RedisConnection.getValuesSync(cacheName);
                    if(cacheData.noCacheData != true) {
                        return callback(null, {status: 'success', message: 'Fetched successfully!', data: cacheData});
                    }
                }
            }

            currencies = await getCurrencies();
            const filterConfigs = await getFilterConfigs('Learn_Path');

            let esFilters = {};
            const query = {
                "bool": {
                    "must": [
                        { term: { "status.keyword": 'approved' } }
                    ],
                }
            };

            let queryPayload = {};
            let paginationQuery = await getPaginationQuery(req.query);
            queryPayload.from = paginationQuery.from;
            queryPayload.size = paginationQuery.size;


            if (!req.query['sort'] && !req.query['q']) {
                req.query['sort'] = defaultSort;
            }

            if (req.query['sort']) {

                const keywordFields = ['title'];
                let sort = req.query['sort'];
                let splitSort = sort.split(":");
                if (keywordFields.includes(splitSort[0])) {
                    sort = `${splitSort[0]}.keyword:${splitSort[1]}`;
                }
                queryPayload.sort = [sort];

            }

            if (req.query['learnPathIds']) {
                let learnPathIds = req.query['learnPathIds'].split(",");

                let filter_object = {
                    "terms": {
                        "id": learnPathIds
                    }
                }

                query.bool.must.push(filter_object)
                esFilters['courseIds'] = filter_object;
            }


            let parsedFilters = [];
            let parsedRangeFilters = [];
            let filters = [];

            if(req.query['q']){

                let filter_object = {                    
                    "bool": {
                        "should": [
                          {
                            "query_string" : {
                                "query" : `*${decodeURIComponent(req.query['q']).replace("+","//+").trim()}*`,
                                "fields" : ['title^9','description^8','categories^7','sub_categories^6','topics^5','life_stages^4','levels^3','medium^2','courses.title'],
                                "analyze_wildcard" : true,
                                "allow_leading_wildcard": true
                            }
                          },
                          {
                              "multi_match": {
                                      "fields": ['title^9','description^8','categories^7','sub_categories^6','topics^5','life_stages^4','levels^3','medium^2','courses.title'],
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

            if (req.query['f']) {
                parsedFilters = parseQueryFilters(req.query['f']);
                for (const filter of parsedFilters) {
                    if(filter["key"] == "Category"){
                        for(let name of filter["value"]){
                            this.addPopularEntities("category", name)
                        }
                    }else if(filter["key"] == "Topic"){
                        for(let name of filter["value"]){
                            this.addPopularEntities("topic", name)
                        }
                    }
                    let elasticAttribute = filterConfigs.find(o => o.label === filter.key);
                    if (elasticAttribute) {
                        const attribute_name = getFilterAttributeName(elasticAttribute.elastic_attribute_name, filterFields);

                        let filter_object = {
                            "terms": { [attribute_name]: filter.value }
                        };

                        query.bool.must.push(filter_object);
                        esFilters[elasticAttribute.elastic_attribute_name] = filter_object;
                    }
                }
                if (req.query['f'].includes("Price Type:")) {
                    query.bool.must.push({
                        "bool": {
                            "must_not": [
                                {
                                    "term": {
                                        "display_price": {
                                            "value": "false"
                                        }
                                    }
                                }
                            ]
                        }
                    });
                    esFilters["display_price"] = {
                        "bool": {
                            "must_not": [
                                {
                                    "term": {
                                        "display_price": {
                                            "value": "false"
                                        }
                                    }
                                }
                            ]
                        }
                    };
                }
            }

            if (req.query['rf']) {
                parsedRangeFilters = parseQueryRangeFilters(req.query['rf']);
                for (const filter of parsedRangeFilters) {
                    let elasticAttribute = filterConfigs.find(o => o.label === filter.key);
                    if (elasticAttribute) {
                        const attribute_name = getFilterAttributeName(elasticAttribute.elastic_attribute_name, filterFields);

                        let rangeQuery = {};
                        if (filter.start !== "MIN") {
                            let startValue = (filter.key == "Ratings") ? (filter.start * 100) : filter.start;
                            if (filter.key == 'Price') {
                                startValue = getCurrencyAmount(startValue, currencies, req.query['currency'], 'USD');
                            }
                            rangeQuery["gte"] = startValue;
                        }
                        if (filter.end !== "MAX") {
                            let endValue = (filter.key == "Ratings") ? (filter.end * 100) : filter.end;
                            if (filter.key == 'Price') {
                                endValue = getCurrencyAmount(endValue, currencies, req.query['currency'], 'USD');
                                rangeQuery["lte"] = endValue;
                            } else {
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


            let published_filter = { term: { "status.keyword": "approved" } };

            let aggs = {
                course_filters: {
                    global: {},
                    aggs: {

                    }
                }
            }

            const topHitsSize = 200;
            const rating_keys = [4.5, 4.0, 3.5, 3.0].map(value => ({ key: `${value} and Above`, from: value * 100 }));
            const duration_keys = [
                { key: 'Less Than 2 Hours', to: 2 },
                { key: 'Less Than a Week', to: 168 },
                { key: '1 - 4 Weeks', from: 168, to: 672 },
                { key: '1 - 3 Months', from: 672, to: 2016 },
                { key: '3+ Months', from: 2016 },
            ]

            for (let filter of filterConfigs) {


                let exemted_filters = esFilters;

                if (esFilters.hasOwnProperty(filter.elastic_attribute_name)) {
                    let { [filter.elastic_attribute_name]: ignored_filter, ...all_filters } = esFilters
                    exemted_filters = all_filters;
                }

                exemted_filters = Object.keys(exemted_filters).map(key => exemted_filters[key]);

                if (filter.elastic_attribute_name == "pricing_type") {
                    exemted_filters.push({
                        "bool": {
                            "must_not": [
                                {
                                    "term": {
                                        "display_price": {
                                            "value": "false"
                                        }
                                    }
                                }
                            ]
                        }
                    });
                }

                exemted_filters.push(published_filter);

                let aggs_object = {
                    filter: { bool: { filter: exemted_filters } },
                    aggs: {}
                }

                switch (filter.filter_type) {
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
                        aggs_object.aggs['min'] = { min: { field: filter.elastic_attribute_name } }
                        aggs_object.aggs['max'] = { max: { field: filter.elastic_attribute_name } }
                        break;
                }
                aggs.course_filters.aggs[filter.elastic_attribute_name] = aggs_object;
            }

            queryPayload.aggs = aggs;

            // --Aggreation query build

            let result = await elasticService.searchWithAggregate('learn-path', query, queryPayload);

            /**
             * Aggregation object from elastic search
             */
            let aggs_result = result.aggregations;

            /**
             * Hits Array from elastic search
             */
            result = result.hits;

            for (let filter of filterConfigs) {

                if (filter.elastic_attribute_name == "learn_type") {
                    var learn_types_images = {};
                    let cacheName = `learn_type_images`
                    let useCache = false
                    let cacheData = await RedisConnection.getValuesSync(cacheName);
                    if (cacheData.noCacheData != true) {
                        learn_types_images = cacheData
                        useCache = true
                    }

                    if (useCache != true) {
                        let response = await fetch(`${apiBackendUrl}/learn-types`);
                        if (response.ok) {
                            let json = await response.json();
                            if (json) {
                                for (let learn_type of json) {

                                    if (learn_type.image && learn_type.image.formats) {
                                        learn_types_images[learn_type.default_display_label] = {
                                            "small": (learn_type.image.formats.small) ? learn_type.image.formats.small.url : null,
                                            "medium": (learn_type.image.formats.medium) ? learn_type.image.formats.medium.url : null,
                                            "thumbnail": (learn_type.image.formats.thumbnail) ? learn_type.image.formats.thumbnail.url : null,
                                            "large": (learn_type.image.formats.large) ? learn_type.image.formats.large.url : null
                                        }
                                    }
                                }
                            }
                        }
                        RedisConnection.set(cacheName, learn_types_images);
                       // RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_LEARN_TYPE_IMAGE);
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

                if (filter.filter_type == "RangeSlider") {

                    if (filter.elastic_attribute_name === "basePriceRound") {
                        facet.min.value = facet.min.value > 0 ? getCurrencyAmount(facet.min.value, currencies, 'USD', req.query['currency']) : facet.min.value;
                        facet.max.value = facet.max.value > 0 ? getCurrencyAmount(facet.max.value, currencies, 'USD', req.query['currency']) : facet.max.value;
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

                        if (filter.filter_type == "RangeOptions") {
                            option.start = item.from ? filter.elastic_attribute_name == "ratings" ? item.from / 100 : item.from : "MIN"
                            option.end = item.to ? item.to : "MAX"
                        }


                        if (filter.elastic_attribute_name == "learn_type") { option.image = learn_types_images[item.key] }

                        return option;
                    });
                    if (filter.elastic_attribute_name == "ratings") formatedFilters.options.reverse();
                }

                filters.push(formatedFilters);

            }

            if (parsedFilters.length > 0 || parsedRangeFilters.length > 0) {
                filters = await updateSelectedFilters(filters, parsedFilters, parsedRangeFilters);
            }


            let formatCategory = true;
            if (formatCategory) {
                let category_tree = [];
                let categoryFiletrOption = [];
                let categorykey = 0;

                category_tree = await CategoryService.getTreeV2(false) || [];

                if (category_tree && category_tree.length) {
                    for (let category of category_tree) {
                        let i = 0;
                        for (let filter of filters) {
                            if (filter.field == "categories") {
                                for (let option of filter.options) {
                                    if (category.label == option.label) {
                                        categoryFiletrOption.push(option);
                                    }
                                }
                                categorykey = i;

                            }
                            i++;
                        }
                    }
                }
                if (filters[categorykey]) {
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
                list = await this.generateListViewData(result.hits, req.query['currency']);
            }

            let data = {
                list: list,
                filters: filters,
                pagination: pagination,
                sort: req.query['sort'],
            };

            let meta_information = null; //TODO once reules are given. await generateMetaInfo('learn-path-list', result);

            if (meta_information) {
                data.meta_information = meta_information;
            }

            if (useCache == true) {
                RedisConnection.set(cacheName, data);
                RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_LISTING_LEARNPATH || 60 * 60 * 24 );
            }

            callback(null, { status: 'success', message: 'Fetched successfully!', data: data });
        } catch (e) {
            callback(null, { status: 'error', message: 'Failed to fetch!', data: { list: [], pagination: { total: 0 }, filters: [] } });
        }
    }

    async getLearnpathByIds(req, callback){
        if(currencies.length == 0){
            currencies = await getCurrencies();
        }
        let learnpaths = [];
        let learnpathOrdered = [];
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

            const result = await elasticService.plainSearch('learn-path', queryBody);
            if(result.hits){
                if(result.hits.hits && result.hits.hits.length > 0){
                    for(const hit of result.hits.hits){
                        const learnpath = await this.generateSingleViewData(hit._source, false, req.query.currency);
                        learnpaths.push(learnpath);
                    }
                    for(const id of ids){
                        let learnpath = learnpaths.find(o => o.id === id);
                        learnpathOrdered.push(learnpath);
                    }
                }
            }            
        }
        if(callback){
            callback(null, {status: 'success', message: 'Fetched successfully!', data: learnpathOrdered});
        }else{
            return learnpathOrdered;
        }
        
    }

    async getLearnPath(req, callback, skipCache) {
        try{
            let learnpathId = null
            const slug = req.params.slug;
            let cacheName = `single-learnpath-${slug}_${req.query.currency}`
            let useCache = false
            if(skipCache != true){
                let cacheData = await RedisConnection.getValuesSync(cacheName);
                learnpathId = cacheData.id
                if(cacheData.noCacheData != true) {
                    callback(null, {status: 'success', message: 'Fetched successfully!', data: cacheData});
                    useCache = true
                }
            }
            if(useCache != true){
                const learnPath = await this.fetchLearnPathBySlug(slug);
                if (learnPath) {
                    /**
                     * Log skills entity
                     */
                    if("skills" in learnPath && learnPath.skills.length > 0){
                        for(let name of learnPath.skills){
                            this.addPopularEntities("skill", name)
                        }
                    }
                    const data = await this.generateSingleViewData(learnPath, false, req.query.currency);
                    learnpathId = learnPath.id
                    callback(null, { status: 'success', message: 'Fetched successfully!', data: data });
                    RedisConnection.set(cacheName, data); 
                    RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_SINGLE_LEARNPATH  || 60 * 60 * 24);
                } else {
                    /***
                     * We are checking slug and checking(from the strapi backend APIs) if not there in the replacement.
                     */
                    let response = await fetch(`${apiBackendUrl}/url-redirections?old_url_eq=${slug}`);
                    if (response.ok) {
                        let urls = await response.json();
                        if(urls.length > 0){  
                            let slug = urls[0].new_url
                            return callback({ status: 'redirect', slug:slug, message: 'Redirect!' }, null);
                        }else{
                            return callback({ status: 'failed', message: 'Not found!' }, null);
                        }
                    }
                    callback({ status: 'failed', message: 'Not found!' }, null);
                }
            }
            req.body = {learnpathId: "LRN_PTH_"+learnpathId}
            this.addActivity(req, (err, data) => {})
        }
        catch(err){
            console.log(err)
        }
    }

    async fetchLearnPathBySlug(slug) {
        const query = {
            "bool": {
                "must": [
                    { term: { "slug.keyword": slug } },
                    { term: { "status.keyword": 'approved' } }
                ]
            }
        };

        let result = await elasticService.search('learn-path', query); 
        if (result.hits && result.hits.length > 0) {
            return result.hits[0]._source;
        } else {
            return null;
        }
    }

    async generateSingleViewData(result, isList = false, currency = process.env.DEFAULT_CURRENCY) {
        let currencies = await getCurrencies();
        let orderedLevels = ["Beginner","Intermediate","Advanced","Ultimate","All Level","Others"]; //TODO. ordering should be sorting while storing in elastic search.
        let data = {
            id: `LRN_PTH_${result.id}`,
            title: result.title,
            slug: result.slug,
            description: result.description,
            cover_images: result.images,
            levels: result.levels ? orderedLevels.filter(value=> result.levels.includes(value)) : [],
            medium: result.medium,
            reviews_extended: [],
            life_stages: result.life_stages,
            topics: result.topics,
            pricing: {
                regular_price: getCurrencyAmount(result.regular_price, currencies, result.currency, currency),
                sale_price: getCurrencyAmount(result.sale_price, currencies, result.currency, currency),
                display_price: result.display_price,
                pricing_type: result.pricing_type,
                currency: currency,
                offer_percent: (result.sale_price) ? (Math.round(((result.regular_price-result.sale_price) * 100) / result.regular_price)) : null,
            },
            ratings: {
                total_review_count: result.reviews ? result.reviews.length : 0,
                average_rating: 0,
                average_rating_actual: 0,
                rating_distribution: []
            },
            meta_information: {
                meta_keywords: result.meta_keywords,
                meta_description: result.meta_description,
                meta_title: `${result.title} | Learn Path | ${process.env.SITE_URL_FOR_META_DATA || 'Careervira.com'}`
            },
            duration: {
                total_duration: result.total_duration,
                total_duration_unit: result.total_duration_unit,
            },
            courses: result.courses
        }

        if (!isList) {
            let reviews = await this.getReviews({ params: { learnPathId: data.id }, query: {} });
            if (reviews)
                data.reviews_extended = reviews;

            if (result.courses && result.courses.length > 0) {
                let courseIds = result.courses.sort((a,b) => a.position - b.position).map(item => item.id).join();
                let courses = await LearnContentService.getCourseByIds({ query: { ids: courseIds, currency: currency } });
                if (courses) {
                    data.courses = courses;
                }
            }
        }


        //TODO this logic is copied from course service
        //but this aggreation logic should be put in elastic search add added in the reviews_extended object for both course and learn-path.
        if (result.reviews && result.reviews.length > 0) {
            let totalRating = 0;
            let ratings = {};
            for (let review of result.reviews) {
                totalRating += review.rating;
                let rating_round = Math.floor(review.rating);
                if (ratings[rating_round]) {
                    ratings[rating_round] += 1;
                } else {
                    ratings[rating_round] = 1;
                }
            }

            const average_rating = totalRating / result.reviews.length;
            data.ratings.average_rating = round(average_rating, 0.5);
            data.ratings.average_rating_actual = average_rating.toFixed(1);
            let rating_distribution = [];

            //add missing ratings
            for (let i = 0; i < 5; i++) {
                if (!ratings[i + 1]) {
                    ratings[i + 1] = 0;
                }
            }
            Object.keys(ratings)
                .sort()
                .forEach(function (v, i) {
                    rating_distribution.push({
                        rating: v,
                        percent: Math.round((ratings[v] * 100) / result.reviews.length)
                    });
                });
            data.ratings.rating_distribution = rating_distribution.reverse();
        }


        return data;
    }

    async generateListViewData(rows, currency) {
        if (currencies.length == 0) {
            currencies = await getCurrencies();
        }
        let datas = [];
        for (let row of rows) {
            const data = await this.generateSingleViewData(row._source, true, currency);
            datas.push(data);
        }
        return datas;
    }

    async getReviews(req, callback) {
        try {
            let reviews = await ReviewService.getReviews("learn-path", req.params.learnPathId, req);
            if (callback) callback(null, { status: "success", message: "all good", data: reviews }); else return reviews;
        } catch (e) {
            if (callback) callback({ status: "failed", message: e.message }, null); else return false;
        }
    }

    async exploreLearnPath(req, callback) {
        try {
            let defaultSize = ENTRY_PER_PAGE;

            // Getting all the filters from entity facet table
            let filterConfigs = await getFilterConfigs('Learn_Path');

            /*
                Filtering values only for these 4 filters
            */
            filterConfigs = filterConfigs.filter((filter) => ["categories", "topics","levels","life_stages"].includes(filter.elastic_attribute_name))
            
            let esFilters = {};
            const query = {
                "bool": {
                    "must": [
                        { term: { "status.keyword": 'approved' } }
                    ],
                }
            };

            let queryPayload = {};
            let paginationQuery = await getPaginationQuery(req.query);
            queryPayload.from = paginationQuery.from;
            queryPayload.size = paginationQuery.size;

            let parsedFilters = [];
            let parsedRangeFilters = [];
            let filters = [];


            if (req.query['f']) {
                
                /*
                    It will parse all the filters passed through f query
                */
                parsedFilters = parseQueryFilters(req.query['f']);

                for (const filter of parsedFilters) {
                    let elasticAttribute = filterConfigs.find(o => o.label === filter.key);
                    if (elasticAttribute) {
                        const attribute_name = getFilterAttributeName(elasticAttribute.elastic_attribute_name, filterFields);

                        let filter_object = {
                            "terms": { [attribute_name]: filter.value }
                        };

                        query.bool.must.push(filter_object);
                        esFilters[elasticAttribute.elastic_attribute_name] = filter_object;
                    }
                }
            }

            let published_filter = { term: { "status.keyword": "approved" } };

            let aggs = {
                course_filters: {
                    global: {},
                    aggs: {

                    }
                }
            }

            const topHitsSize = 200;
            
            for (let filter of filterConfigs) {

                let exemted_filters = esFilters;

                if (esFilters.hasOwnProperty(filter.elastic_attribute_name)) {
                    let { [filter.elastic_attribute_name]: ignored_filter, ...all_filters } = esFilters
                    exemted_filters = all_filters;
                }

                exemted_filters = Object.keys(exemted_filters).map(key => exemted_filters[key]);

                exemted_filters.push(published_filter);

                let aggs_object = {
                    filter: { bool: { filter: exemted_filters } },
                    aggs: {}
                }

                switch (filter.filter_type) {
                    case "Checkboxes":
                        aggs_object.aggs['filtered'] = { terms: { field: `${filter.elastic_attribute_name}.keyword`, size: topHitsSize } }
                        break;
                }
                aggs.course_filters.aggs[filter.elastic_attribute_name] = aggs_object;
            }

            queryPayload.aggs = aggs;

            // --Aggreation query build

            let result = await elasticService.searchWithAggregate('learn-path', query, queryPayload);

            /**
             * Aggregation object from elastic search
             */
            let aggs_result = result.aggregations;

            /**
             * Hits Array from elastic search
             */
            result = result.hits;

            for (let filter of filterConfigs) {

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

                if (filter.filter_type == "RangeSlider") {

                } else {
                    formatedFilters.options = facet.filtered.buckets.map(item => {
                        let option = {
                            label: item.key,
                            count: item.doc_count,
                            selected: false, //Todo need to updated selected here.
                            disabled: item.doc_count <= 0,
                        }
                        return option;
                    });
                }

                filters.push(formatedFilters);
            }

            if (parsedFilters.length > 0 || parsedRangeFilters.length > 0) {
                filters = await updateSelectedFilters(filters, parsedFilters, parsedRangeFilters);
            }

            let formatCategory = true;
            if (formatCategory) {
                let category_tree = [];
                let categoryFiletrOption = [];
                let categorykey = 0;

                let response = await fetch(`${apiBackendUrl}/category-tree`);

                if (response.ok) {
                    let json = await response.json();
                    if (json && json.final_tree) {
                        category_tree = json.final_tree;
                    }
                }
                if (category_tree && category_tree.length) {
                    for (let category of category_tree) {
                        let i = 0;
                        for (let filter of filters) {
                            if (filter.field == "categories") {
                                for (let option of filter.options) {
                                    if (category.label == option.label) {
                                        categoryFiletrOption.push(option);
                                    }
                                }
                                categorykey = i;

                            }
                            i++;
                        }   
                    }
                }
                if (filters[categorykey]) {
                    filters[categorykey].options = categoryFiletrOption;
                }
            }

            let data = {
                filters: filters
            };

            callback(null, { status: 'success', message: 'Fetched successfully!', data: data });
        } catch (e) {
            callback(null, { status: 'error', message: 'Failed to fetch!', data: { list: [], pagination: { total: 0 }, filters: [] } });
        }
    }

    async addActivity(req, callback){
        try {
             const {user} = req;
             const {learnpathId} = req.body	
             const activity_log =  await helperService.logActvity("LEARNPATH_VIEW",(user)? user.userId : null, learnpathId);
             callback(null, {status: 'success', message: 'Added successfully!', data: null});
        } catch (error) {
            console.log("Learn path view activity error",  error)
            callback(null, {status: 'error', message: 'Failed to Add', data: null});
        }
    }

    async getPopularLearnPaths(req, callback, returnData){
        let { type } = req.params; // Populer, Trending,Free
        let { category, sub_category, topic, currency, page = 1, limit =20} = req.query;       
        
        let offset= (page -1) * limit
        
        let learnpaths = [];
        try {
            
            let esQuery = {
                "bool": {
                    "filter": [
                        { "term": { "status.keyword": "approved" } }
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
                    sort = [{ "activity_count.last_x_days.learnpath_views" : "desc" },{ "ratings" : "desc" }]
                    break; 
                default:
                    sort = [{ "activity_count.all_time.learnpath_views" : "desc" },{ "ratings" : "desc" }]
                    break;
            }
            
            let result = await elasticService.search("learn-path", esQuery, { from: offset, size: limit, sortObject:sort});
                
            if(result.hits){
                for(const hit of result.hits){
                    var data = await this.generateSingleViewData(hit._source,true,currency)
                    learnpaths.push(data);
                }
            }
            
            let response = { success: true, message: "list fetched successfully", data:{ list: learnpaths } };
            if(returnData)
            {
                return learnpaths;
            }
            else
            {
                callback(null, response);
            }
            
        } catch (error) {
            console.log("Error while processing data for popular learnpaths", error);
            callback(error, null);
        }
    }

}