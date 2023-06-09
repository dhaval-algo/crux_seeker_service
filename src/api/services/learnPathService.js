const elasticService = require("./elasticService");
const learnContentService = require("./learnContentService");
let LearnContentService = new learnContentService();
const partnerService = require("./partnerService");
let PartnerService = new partnerService();
const fetch = require("node-fetch");

const reviewService = require("./reviewService");
const ReviewService = new reviewService();
const helperService = require("../../utils/helper");
const {formatCount,getlistPriceFromEcom} = require("../utils/general")
const {generateMetaInfo} = require("../utils/metaInfo")

const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();

const categoryService = require("./categoryService");
const {getSearchTemplate,getUserKpis} = require("../../utils/searchTemplates");
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
    getCurrencyAmount,
    paginate,
    formatImageResponse
} = require('../utils/general');
const { list } = require("../controllers/listUsersController");

const round = (value, step) => {
    step || (step = 1.0);
    var inv = 1.0 / step;
    return Math.round(value * inv) / inv;
};

let currencies = [];
const ENTRY_PER_PAGE = 25;

const filterFields = ['topics', 'categories', 'sub_categories', 'title', 'levels', 'medium', 'pricing_type','life_stages', 'learn_type_label'];

const sortOptions = {
    'Popular' : ["activity_count.all_time.popularity_score:desc","ratings:desc"],
    'Trending' : ["activity_count.last_x_days.trending_score:desc","ratings:desc"],
    'Highest Rated': ["ratings:desc"],
    'Newest' :["created_at:desc"],
    'Price Low To High': ["default_price:asc"],
    'Price High To Low': ["default_price:desc"],
    'Most Relevant' : []

}


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
                await helperService.logPopularEntities("topics", resource);
            }else if(type == "category"){
                await helperService.logPopularEntities("categories", resource);
            }
            else if(type == "skill"){
                await helperService.logPopularEntities("skills", resource);
            }
        } catch (error) {
            console.log("Learn Path activity entity error",  error)
        }
         
    }

    async getLearnPathList(req, callback, skipCache) {

        try {
            let searchTemplate = null;
            let defaultSize = ENTRY_PER_PAGE;
            let defaultSort =  'Most Relevant';
            let useCache = false;
            let cacheName = "learnpath";
            const userId = (req.user && req.user.userId) ? req.user.userId : req.segmentId;

            if(!userId &&
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
               
                cacheName += `_${defaultSort}`;
    
                if(skipCache != true) {
                    let cacheData = await RedisConnection.getValuesSync(cacheName);
                    if(cacheData.noCacheData != true) {
                        if(cacheData.list)
                        cacheData.list = await getlistPriceFromEcom(cacheData.list,"learn_path",req.query['country'])

                        return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
                    }
                }
            }

            currencies = await getCurrencies();
            const filterConfigs = await getFilterConfigs('Learn_Path');

            let esFilters = {};
            let query = null;
            if (req.query['q']) {

                searchTemplate = await getSearchTemplate('learn-path',decodeURIComponent(req.query['q']).replace("+","//+").trim(),userId);
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
                                    { term: { "status.keyword": 'approved' } }
                                ],
                            }
                        }
                    }
                }

                if (req.query.sort && req.query.sort == 'Most Relevant') {

                    functions.push({
                        field_value_factor: {
                            field: "activity_count.all_time.learnpath_views",
                            modifier: "log2p",
                            missing: 8
                        }
                    });
                }

                functions.push(...await getUserKpis('learn-path', userId));

                if (functions.length) {
                    searchTemplate.function_score.functions = functions
                }
            };

            let queryPayload = {};
            let paginationQuery = await getPaginationQuery(req.query);
            queryPayload.from = paginationQuery.from;
            queryPayload.size = paginationQuery.size;


            if (!req.query['sort']) {
                req.query['sort'] = defaultSort;
            }

            if (req.query['sort']) {
                queryPayload.sort = []
                const keywordFields = ['title'];
                let sort = sortOptions[req.query['sort']];
                if (sort && sort.length > 0) {
                    for (let field of sort) {

                        let splitSort = field.split(":");
                        if (keywordFields.includes(splitSort[0])) {
                            field = `${splitSort[0]}.keyword:${splitSort[1]}`;
                        }
                        queryPayload.sort.push(field)
                    }
                }         

            }

            if (req.query['learnPathIds']) {
                let learnPathIds = req.query['learnPathIds'].split(",");
                learnPathIds = learnPathIds.map(id => {
                    
                    if(!id.includes("LRN_CNT_PUB_"))
                    {
                        id = 'LRN_PTH_'+id
                    }
    
                    return id
                })

                let filter_object = {
                    "terms": {
                        "_id": learnPathIds
                    }
                }

                searchTemplate.function_score.query.bool.must.push(filter_object)
                esFilters['courseIds'] = filter_object;
            }


            let parsedFilters = [];
            let parsedRangeFilters = [];
            let filters = [];

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

                        searchTemplate.function_score.query.bool.must.push(filter_object);
                        esFilters[elasticAttribute.elastic_attribute_name] = filter_object;
                    }
                }
                if (req.query['f'].includes("Price Type:")) {
                    searchTemplate.function_score.query.bool.must.push({
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

                        searchTemplate.function_score.query.bool.must.push(filter_object);
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

            let result = await elasticService.searchWithAggregate('learn-path', searchTemplate , queryPayload);

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
                                        learn_types_images[learn_type.default_display_label] = formatImageResponse({
                                            "small": (learn_type.image.formats.small) ? learn_type.image.formats.small.url : null,
                                            "medium": (learn_type.image.formats.medium) ? learn_type.image.formats.medium.url : null,
                                            "thumbnail": (learn_type.image.formats.thumbnail) ? learn_type.image.formats.thumbnail.url : null,
                                            "large": (learn_type.image.formats.large) ? learn_type.image.formats.large.url : null
                                        })
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

                if (filter.filter_type == "RangeSlider") {

                    if (filter.elastic_attribute_name === "default_price") {
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
                result.hits = await getlistPriceFromEcom(result.hits,"learn_path",req.query['country'])
                list = await this.generateListViewData(result.hits, req.query['currency'],req.query['country']);
            }

            let data = {
                list: list,
                filters: filters,
                pagination: pagination,
                sort: req.query['sort'],
                sortOptions: Object.keys(sortOptions)
            };

            let meta_information = await generateMetaInfo('LEARN_PATH_LIST', result);

            if (meta_information) {
                data.meta_information = meta_information;
            }

            if (useCache == true) {
                RedisConnection.set(cacheName, data);
                RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_LISTING_LEARNPATH || 60 * 60 * 24 );
            }

            callback(null, { success: true, message: 'Fetched successfully!', data: data });
        } catch (e) {
            console.log("Error in learn path listing", e)
            callback(null, { success: false, message: 'Failed to fetch!', data: { list: [], pagination: { total: 0 }, filters: [] } });
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
            ids = ids.map(id => {
                    
                if(!id.includes("LRN_CNT_PUB_"))
                {
                    id = 'LRN_PTH_'+id
                }

                return id
            })
            const queryBody = {
                "query": {
                  "ids": {
                      "values": ids
                  }
                }
            };

            let result = await elasticService.plainSearch('learn-path', queryBody);
            if(result.hits){
                if(result.hits.hits && result.hits.hits.length > 0){
                    if(!req.query.skipPrice)
                    {
                        result.hits.hits = await getlistPriceFromEcom(result.hits.hits,"learn_path",req.query['country'])
                    }
                    for(const hit of result.hits.hits){
                        const learnpath = await this.generateSingleViewData(hit._source, false, req.query.currency,req.query['country']);
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
            callback(null, {success: true, message: 'Fetched successfully!', data: learnpathOrdered});
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
                    callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
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
                    const data = await this.generateSingleViewData(learnPath, false, req.query.currency, req.query.country);
                    learnpathId = data.id
                    callback(null, { success: true, message: 'Fetched successfully!', data: data });
                    RedisConnection.set(cacheName, data); 
                    RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_SINGLE_LEARNPATH  || 60 * 60 * 24);
                } else {
                    let redirectUrl = await helperService.getRedirectUrl(req);
                    if (redirectUrl) {
                        return callback(null, { success: false, redirectUrl: redirectUrl, message: 'Redirect' });
                    }
                    return callback(null, { success: false, message: 'Not found!' });
                }
            }
            if(learnpathId){
                req.body = {learnpathId: learnpathId}
                this.addActivity(req, (err, data) => {})
            }
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

    async generateSingleViewData(result, isList = false, currency = process.env.DEFAULT_CURRENCY,country) {
        let orderedLevels = ["Beginner","Intermediate","Advanced","Ultimate","All Level","Others"]; //TODO. ordering should be sorting while storing in elastic search.
        let data = {
            id: `LRN_PTH_${result.id}`,
            numeric_id:result.id,
            title: result.title,
            slug: result.slug,
            description: result.description,
            cover_images: (result.images)? formatImageResponse(result.images) : null,
            sidebar_listing_image: (result.listing_image)? formatImageResponse(result.listing_image) : ((result.images)? formatImageResponse(result.images) : null),            
            card_image:(result.card_image)? formatImageResponse(result.card_image) : ((result.images)? formatImageResponse(result.images) : null),
            card_image_mobile:(result.card_image_mobile)? formatImageResponse(result.card_image_mobile) : ((result.cover_iimagesmage)? formatImageResponse(result.images) : null),
            levels: result.levels ? orderedLevels.filter(value=> result.levels.includes(value)) : [],
            medium: result.medium,
            reviews_extended: [],
            life_stages: result.life_stages,
            topics: result.topics,
            pricing: {               
                display_price: true,
                pricing_type: result.pricing_type
            },
            ratings: {
                total_review_count: result.reviews ? result.reviews.length : 0,
                average_rating: 0,
                average_rating_actual: 0,
                rating_distribution: []
            },           
            duration: {
                total_duration: result.total_duration,
                total_duration_unit: result.total_duration_unit,
            },
            courses: result.courses,
            skills: (result.skills) ? result.skills :null,
            isCvTake:(result.cv_take && result.cv_take.display_cv_take)? true: false,
            is_subscription: (result.subscription_price)? result.subscription_price : false,
            show_enquiry: (result.enquiry)? result.enquiry : false,
            pricing_details: (result.pricing_details)? result.pricing_details : null,
            partner: (result.partner)? result.partner : null,
            course_access_link: result.course_access_link
        }       

       
        data.buy_on_careervira = false
        //get buy_on_careervira from partner
        if(data.partner)
        {
            let partnerData = await PartnerService.getPartner({params : {slug:data.partner.slug},query:{currency:currency}})
            if(partnerData && partnerData.buy_on_careervira)
            {
                data.buy_on_careervira =true
            }
            if(partnerData && partnerData.logo)
            {
                data.partner.logo =partnerData.logo                  
            }

            if(partnerData && partnerData.name_image)
            {                  
                data.partner.name_image =partnerData.name_image
            }
        }
        
        if(!isList)  data.pricing_details = {}    
        if(data.pricing_details)
        {
            data.pricing_details.pricing_type =  result.pricing_type      
            data.pricing_details.display_price =  true     
        } 
        
        if (!isList) {
            data.meta_information = await generateMetaInfo('LEARN_PATH', result);         


            if(result.cv_take && result.cv_take.display_cv_take)
            {
                data.cv_take = result.cv_take
            }            

            let reviews = await this.getReviews({ params: { learnPathId: data.id }, query: {} });
            if (reviews)
                data.reviews_extended = reviews;

            if (result.courses && result.courses.length > 0) {
                let courseIds = result.courses.sort((a,b) => a.position - b.position).map(item => item.id).join();
                let courses = await LearnContentService.getCourseByIds({ query: { ids: courseIds, country:country } });
                if (courses) {
                    data.courses = courses;
                }
            }
        }

        //SET popular and trending keys
        const LEARN_PATH_POPULARITY_SCORE_THRESHOLD = parseInt(await RedisConnection.getValuesSync("LEARN_PATH_POPULARITY_SCORE_THRESHOLD"));

        data.isPopular  = false
        if( (LEARN_PATH_POPULARITY_SCORE_THRESHOLD >= 0) && result.activity_count && (result.activity_count.all_time.popularity_score > LEARN_PATH_POPULARITY_SCORE_THRESHOLD))
        {
            data.isPopular  = true
        }

        const LEARN_PATH_TRENDING_SCORE_THRESHOLD = parseInt(await RedisConnection.getValuesSync("LEARN_PATH_TRENDING_SCORE_THRESHOLD"));

        data.isTrending  = false
        if( (LEARN_PATH_TRENDING_SCORE_THRESHOLD >= 0) && result.activity_count && (result.activity_count.last_x_days.trending_score > LEARN_PATH_TRENDING_SCORE_THRESHOLD))
        {
            data.isTrending  = true
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

            if(!isList)
            {
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
        }


        return data;
    }

    async generateListViewData(rows, currency, country) {
        if (currencies.length == 0) {
            currencies = await getCurrencies();
        }
        let datas = [];
        for (let row of rows) {
            const data = await this.generateSingleViewData(row._source, true, currency, country);
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

            callback(null, { success: true, message: 'Fetched successfully!', data: data });
        } catch (e) {
            callback(null, { success: false, message: 'Failed to fetch!', data: { list: [], pagination: { total: 0 }, filters: [] } });
        }
    }

    async addActivity(req, callback){
        try {
             const {user} = req;
             const {learnpathId} = req.body	
             const activity_log =  await helperService.logActvity("LEARNPATH_VIEW",(user)? user.userId : null, learnpathId);
             callback(null, {success: true, message: 'Added successfully!', data: null});
        } catch (error) {
            console.log("Learn path view activity error",  error)
            callback(null, {success: false, message: 'Failed to Add', data: null});
        }
    }

    async getPopularLearnPaths(req, callback, returnData){
        let { type, priceType="Paid" } = req.params; // Populer, Trending,Free
        let { category, sub_category, topic, currency, country,page = 1, limit =20} = req.query;       
        
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
            
            if(priceType && priceType =="Free"){
                esQuery.bool.filter.push(
                    { "term": { "pricing_type.keyword": "Free" } }
                );
                 esQuery.bool.filter.push(
                    { "term": { "display_price": true } }
                );
            }
            if(priceType && priceType =="Paid"){
                esQuery.bool.filter.push(
                    { "term": { "pricing_type.keyword": "Paid" } }
                );
                 esQuery.bool.filter.push(
                    { "term": { "display_price": true } }
                );
            }
            let sort = null
            switch (type) {                
                case "Trending":
                    sort = [{ "activity_count.last_x_days.trending_score" : "desc" },{ "ratings" : "desc" }]
                    break; 
                default:
                    sort = [{ "activity_count.all_time.popularity_score" : "desc" },{ "ratings" : "desc" }]
                    break;
            }
            
            let result = await elasticService.search("learn-path", esQuery, { from: offset, size: limit, sortObject:sort});
                
            if(result.hits){
                for(const hit of result.hits){
                    var data = await this.generateSingleViewData(hit._source,true,currency, country)
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

    async getLearnPathLearntypes(req) {
        let {page =1, limit= 5, category, sub_category, topic} = req.query
        let cacheName = 'learn-path-learn-types'
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
                    "field": "learn_type.default_display_label.keyword"
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
                result = await elasticService.searchWithAggregate('learn-path', query, payload);
                await RedisConnection.set(cacheName, result);
                RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_LISTING_LEARNPATH || 60 * 60 * 24);
            }

            let learn_types = []
            let learn_types_images = await LearnContentService.getLearnTypeImages();

            if (result.aggregations && result.aggregations.learn_type_count.buckets.length >0) {
                result.aggregations.learn_type_count.buckets.map(item => learn_types.push({label: item.key, images: learn_types_images[item.key],count:formatCount(item.doc_count)}))
                
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

    async getLearnPathTopics(req) {
        let {page =1, limit= 5, category, sub_category} = req.query
        let cacheName = 'learn-path-topics'
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
                result = await elasticService.searchWithAggregate('learn-path', query, payload);
                await RedisConnection.set(cacheName, result);
                RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_LISTING_LEARNPATH || 60 * 60 * 24);
            }

            let topics = []
           
            if (result.aggregations && result.aggregations.topics_count.buckets.length >0) {
                result.aggregations.topics_count.buckets.map(item => topics.push( item.key))
                // topics = topics.map( async topic =>{
                //     let slug = await helperService.getTreeUrl('topic', topic, true)
                //     return({
                //         label:topic,
                //         slug : slug
                //     })
                // })
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

}