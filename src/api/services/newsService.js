'use strict';

const elasticService = require("./elasticService");
const { logActvity } = require("../../utils/helper");
const RedisConnection = require('../../services/v1/redis');
const redisConnection = new RedisConnection();
const LearnContentService = require("../services/learnContentService");
const learnContentService = new LearnContentService();
const {getPaginationQuery, formatImageResponse, isDateInRange, getFilterConfigs, updateSelectedFilters, calculateFilterCount, getAllFilters,
    getCurrencies, getCurrencyAmount, parseQueryFilters, getFilterAttributeName} = require("../utils/general");
 const { generateMetaInfo } = require('../utils/metaInfo');

let currencies = [];


const getNewsBySlug = async (req, callback) =>
{
    try{
    let { currency = process.env.DEFAULT_CURRENCY } = req.query;
    const { user = null} = req;
    const slug = req.params.slug;
    let cacheKey = `single-news-${slug}-${currency}`

    let cacheData = await redisConnection.getValuesSync(cacheKey);
    if(cacheData.noCacheData != true){
        await logActvity("NEWS_VIEW", user? user.userId : null, cacheData.id);
        return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
    }

    const query = { 
        "bool": {
         "must":[
            { "match": { "slug.keyword": slug}}
          ]
        }
    };

    let result = null;
    try{
        result = await elasticService.search('news', query);
        
    }catch(e){ console.log('Error while retriving news data',e); }

    if(result && result.hits && result.hits.length > 0)
    {
        result.hits[0]._source._id = result.hits[0]._id;
        let data = await generateSingleViewData(result.hits[0]._source, false, currency)
        let meta_information = await generateMetaInfo('NEWS', data);
            
        if(meta_information)
           data.meta_information = meta_information;

        redisConnection.set(cacheKey, data, process.env.CACHE_EXPIRE_SINGLE_NEWS || 360)
        await logActvity("NEWS_VIEW", user? user.userId : null, data.id);
        callback(null, {success: true, message: 'Fetched successfully!', data})
    }
    else
        return callback(null, { success: false, message: 'News Not found!' });
    }catch(err){
        console.log("Single fetch news err ", err);
        return callback(null, { success: false, message: 'Something unexpected happend!' });

    }

}

const filterFields = ['topics','categories','sub_categories','skills','regions', 'type'];


const sortOptions = {
    'Popular' : ["activity_count.all_time.popularity_score:desc"],
    'Trending' : ["activity_count.last_x_days.trending_score:desc"],
    'Newest' :["updated_at:desc"],
    'Oldest' :['updated_at:asc'],
    'A-Z': ["title:asc"],
    'Z-A': ["title:desc"],
}


const getNewsList = async (req, callback) =>
{
    try {
    const query = { 
        "bool": {
            "must": [],
            "filter": []
        }
    };
    let { currency = process.env.DEFAULT_CURRENCY } = req.query;       

    let paginationQuery = await getPaginationQuery(req.query);
    let queryPayload = {}, cacheKey = `news-listing-with-${currency}-p-${paginationQuery.page}-s-${paginationQuery.size}-`;
    queryPayload.from = paginationQuery.from;
    queryPayload.size = paginationQuery.size;

    if(!req.query['sort'])
        req.query['sort'] = "Newest";

    if(req.query['sort'])
    {
        const keywordFields = ['title'];
        let sort = sortOptions[req.query['sort']];
        if(sort && sort.length > 0){
            for(let field of sort){
                let splitSort = field.split(":");
                    if(keywordFields.includes(splitSort[0]))
                        field = `${splitSort[0]}.keyword:${splitSort[1]}`;
                    queryPayload.sort = [field];
            }
        }
        
    
        cacheKey += `${req.query['sort']}-`
    }

    let queryString = null;
    if(req.query['q'])
    {
        const q = decodeURIComponent(req.query['q'])
        query.bool.must.push( 
            {
                match: { "title": q }
            }
        );
        cacheKey += `${q}-`

    }

    //lets do filtering; with or without params
    let parsedFilters = [];
    const filterConfigs = await getFilterConfigs('Custom_News');
    let filterQuery = JSON.parse(JSON.stringify(query));
    let filterQueryPayload = JSON.parse(JSON.stringify(queryPayload));
    let filterResponse = await getAllFilters('news', filterQuery, filterQueryPayload, filterConfigs);
    let filters = filterResponse.filters;

    if(req.query['f'])
    {
        parsedFilters = parseQueryFilters(req.query['f']);
        for(const filter of parsedFilters)
        {
            let elasticAttribute = filterConfigs.find(o => o.label === filter.key);
            if(elasticAttribute)
            {
                const attribute_name  = getFilterAttributeName(elasticAttribute.elastic_attribute_name, filterFields);
                query.bool.must.push({ "terms": {[ attribute_name ]: filter.value} });
                cacheKey += `${filter.key}-${filter.value}`

            }
        }
      
    }
    let cacheData = await redisConnection.getValuesSync(cacheKey);
    if(cacheData.noCacheData != true)
        return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});

    const result = await elasticService.search('news', query, queryPayload, queryString);
    if(result.total && result.total.value > 0)
    {

        const list = await generateListViewData(result.hits, currency);

        let pagination = {
            page: paginationQuery.page,
            count: list.length,
            perPage: paginationQuery.size,
            totalCount: result.total.value
        }

        //update selected flags
        if(parsedFilters.length > 0)
        {
            filters = await calculateFilterCount(filters, parsedFilters, filterConfigs, 'news', result.hits, filterResponse.total, query);
            filters = updateSelectedFilters(filters, parsedFilters);
        }

          let data = {
            list: list,
            filters,
            pagination: pagination,
            sort: req.query['sort'],
            sortOptions: Object.keys(sortOptions)
          };

        let meta_information = await generateMetaInfo('NEWS_LIST', list);
            
        if (meta_information)
            data.meta_information = meta_information;

        redisConnection.set(cacheKey, data, process.env.CACHE_EXPIRE_NEWS_LIST || 360)
        callback(null, {success: true, message: 'Fetched successfully!', data: data});
    }
    else
        callback(null, {success: true, message: 'No records found!', data: {list: [], pagination: {}, filters: []}});
    }catch(err){
        console.log("news listing caught ", err);
        callback(null, {success: false, message: 'Something unexpected happend .!', data: {}});
    }
}

const generateListViewData = async (rows, currency) =>
{
    let dataArr = [];
    const P_THRESHOLD = parseInt(await redisConnection.getValuesSync("NEWS_POPULARITY_SCORE_THRESHOLD"));
    const T_THRESHOLD = parseInt(await redisConnection.getValuesSync("NEWS_TRENDING_SCORE_THRESHOLD"));
    for(let row of rows){
        row._source._id = row._id;
        const data = await generateSingleViewData(row._source, true, currency, P_THRESHOLD, T_THRESHOLD);
        dataArr.push(data);
    }
    return dataArr;
}

const generateSingleViewData = async (result, isList = false, currency = process.env.DEFAULT_CURRENCY, P_THRESHOLD = 0, T_THRESHOLD = 0) =>
{    
    let data = 
    {
        title: result.title,
        slug: result.slug,
        short_description: result.short_description ? result.short_description : null, //check if optional
        id: result._id,
        cover_image: result.logo? result.logo : result.card_image? result.card_image: null,
        sidebar_listing_image: result.sidebar_listing_image? result.sidebar_listing_image : null,            
        logo: result.logo? result.logo: null,
        card_image: result.card_image? result.card_image: null,
        card_image_mobile: result.card_image_mobile? result.card_image_mobile: null,
        regions: result.regions? result.regions: null,
        skills: result.skills? result.skills: null,
        categories: result.categories? result.categories: null,
        sub_categories: result.sub_categories? result.categories: null,
        topics: result.topics? result.topics: null,
        section: result.section ? result.section : null,
        author_info: result.author_info,
        type: result.type,
        banner: result.banner? {type: result.banner.type} : null,
        isTrending: false,
        isPopular: false,
        updated_at: result.updated_at? result.updated_at : new Date().toDateString().toISOString(),
        created_at: result.created_at ? result.created_at: new Date().toDateString().toISOString()

    }

    if(result.author_info && result.authors && result.authors.length) //common
    {
        let authors = result.authors;

        try{
            let query = { "bool": {"filter": [{"terms": {"id": authors} }]}}

            authors = await elasticService.search('author', query);

        }catch(err) {
            console.log("single view news author fetch err: ",err);
            data.author = [];
        }
        if(authors && authors.hits && authors.hits.length)
        {
            
            data.author = authors.hits.map(hit => {
                hit = hit._source; 
                if(hit.image)
                    hit.image = formatImageResponse(hit.image)

                return {
                        bio: hit.bio? hit.bio: null,
                        slug: hit.slug? hit.slug: null,
                        designation: hit.designation? hit.designation: null,
                        image: hit.image? hit.image: null,
                        first_name: hit.first_name? hit.first_name: null,
                        last_name: hit.last_name? hit.last_name: null,
                        facebook_url: hit.facebook_url? hit.facebook_url: null,
                        twitter_url: hit.twitter_url? hit.twitter_url: null,
                        linkedin_url: hit.linkedin_url? hit.linkedin_url: null }
            })
        }
    }
    else
        data.author = [];

    if(result.partners && result.partners.length) //common
    {
        let partners = result.partners;

        try
        {
            let query = { "bool": {"filter": [{"terms": {"id": partners} }]}}

            partners = await elasticService.search('partner', query, {}, ['name', 'logo', 'slug']);

        }catch(err) {
            console.log("single view news partners fetch err: ",err);
            data.partner = [];
        }
        if(partners && partners.hits && partners.hits.length)
        {
            
            data.partner = partners.hits.map(hit => {
                hit = hit._source; 
                return {
                    name: hit.name,
                    slug: hit.slug,
                    logo: hit.logo ? formatImageResponse(hit.logo) : null}
            })
        }
    }
    else
        data.partner = [];
  

    if(!isList)
    {
        if(result.course)//custom
        {
            data.course = result.course;
            if(data.course.learn_contents && data.course.learn_contents.length > 0){
                let learn_contents_ids = data.course.learn_contents.map(learn_content => learn_content.id)
                const req = {query: {ids: learn_contents_ids.join() }};
                data.course.learn_contents = await learnContentService.getCourseByIds(req, null);
                data.course.learn_contents = data.course.learn_contents.map(each => {

                    each.daysLeft = Math.ceil(( new Date(each.course_enrollment_end_date).getTime() - new Date().getTime())/ (1000 * 3600 * 24)) || -1;
                    return each;
                })

            }
        }
        else
            data.course = {}

        data.summary = result.summary ? result.summary: null; //gen
        if(result.partners_section && result.partners_section.length > 0)  //gen
        {
            let sections = []
            for(let eachSection of result.partners_section)
            {
                if(eachSection.offers_course){
                    eachSection.offers_course = eachSection.offers_course.map(course => course.id)
                    if(eachSection.offers_course.length)
                        eachSection.offers_course = await getCourseCoupons(eachSection.offers_course, currency);
                }
                sections.push(eachSection)
            }

            data.partners_section = sections;
        }
        else
            data.partners_section = []

         
        data.contents = result.contents ? result.contents : null; //common

        data.key_faculties = result.key_faculties ? result.key_faculties: null; //custom

        if(result.banner)  //custom
        {
            data.banner = result.banner;
            if(result.banner.learn_content.id)
                data.banner.learn_content = await getCourseCoupons([result.banner.learn_content.id], currency, true);
        }
        else
            data.banner = {}
        if(result.offers_courses && result.offers_courses.length > 1)// custom
            data.top_coupon_offers = await getCourseCoupons(result.offers_courses, currency)

        else
            data.top_coupon_offers = []


        if(result.key_takeaways) 
            data.key_takeaways = { title: "Key Takeaways", values: result.key_takeaways}
        else
            data.key_takeaways = [];
    }
    //SET isPopular and isTrending
    if( P_THRESHOLD && result.activity_count && (result.activity_count.all_time.popularity_score >= P_THRESHOLD))
        data.isPopular  = true;

    if( T_THRESHOLD && result.activity_count && (result.activity_count.last_x_days.trending_score >= T_THRESHOLD))
        data.isTrending  = true;

    return data;
}


const courseFields = ['coupons', 'sale_price', 'regular_price', 'images','card_image','card_image_mobile','course_enrollment_end_date',
                    'listing_image', 'partner_slug', "partner_name", "title", "slug", 'learn_content_pricing_currency','subscription_price','id']

const getCourseCoupons = async (coursesIds, currency, singleCourse = false) =>
{
    try{

        let result, query = {
            "bool": {
              "filter": [{ "terms": {"id": coursesIds}}, {"term": { "status.keyword": 'published' }} ]
            }}
        
        try
        {
            result = await elasticService.search('learn-content', query, {}, courseFields);
        }
        catch(err)
        {
            console.log("single view news partner fetch err: ",err)
            return []; //empty
        }
        
        let data = [], u_currency_symbol = '$';
        if(result.hits && result.hits.length){
            if(currencies.length == 0)
                currencies = await getCurrencies();
            currencies.map(c => {if(c.iso_code == currency) u_currency_symbol = c.currency_symbol})
            for(let hit of result.hits)
            {
                hit = hit._source;
                let coupons = [], offerRange = {low:100, high:0}, price = hit.sale_price ? hit.sale_price: hit.regular_price;
                let baseCurrency = hit.learn_content_pricing_currency? hit.learn_content_pricing_currency.iso_code : null;
                let best_offer = 0, best_offer_index = 0, i = 0, daysLeft = -1;                
                hit.display_price = true

                if(hit.course_enrollment_end_date)                                                                   //converts 24 hrs into ms
                    daysLeft = Math.ceil((new Date(hit.course_enrollment_end_date).getTime() - new Date().getTime())/ (1000 * 3600 * 24))

                for(let coupon of hit.coupons)
                {
                    if(coupon.validity_start_date == null)
                        coupon.validity_start_date == new Date();
                    if(coupon.validity_end_date == null || isDateInRange(coupon.validity_start_date,  coupon.validity_end_date))
                    {
                        let percent, discount;
                        if(coupon.discount){
                            coupon.discount = {value: coupon.discount.value, currency: coupon.discount.currency.iso_code}
                            discount = getCurrencyAmount(coupon.discount.value, currencies, coupon.discount.currency, currency);
                            price = getCurrencyAmount(price, currencies, baseCurrency, currency);
                            percent = Math.ceil((100 * discount)/price)
                            if(percent > best_offer )
                            {
                                best_offer = percent;
                                best_offer_index = i;
                            }
                            if(percent < offerRange.low)
                                offerRange.low = percent
                            if(percent > offerRange.high)
                                offerRange.high = percent
                            currencies.map(c => {if(c.iso_code == coupon.discount.currency) coupon.discount.currency_symbol = c.currency_symbol})
                            coupon.youSave = coupon.discount.currency_symbol +coupon.discount.value;

                        }
                        else{
                            coupon.youSave = coupon.discount_percent + "%"
                            if(coupon.discount_percent > best_offer )
                            {
                                best_offer = percent;
                                best_offer_index = i;
                            }
                            if(coupon.discount_percent < offerRange.low)
                                offerRange.low = coupon.discount_percent
                            if(coupon.discount_percent > offerRange.high)
                                offerRange.high = coupon.discount_percent
                        }
                        coupon.offer_percent  = percent ? percent : coupon.discount_percent;
                        coupons[i++] = coupon
                    }
                }
                if(!singleCourse && !coupons.length )
                    continue;
                
                 let partner = hit.partner_slug ? await getPartnerDetails(hit.partner_slug): { name: hit.partner_name, slug: hit.partner_slug, logo: null }
                 let course = {
                    id: `LRN_CNT_PUB_${hit.id}`,
                    numeric_id:hit.id,
                    title: hit.title,
                    slug: hit.slug,
                    buy_on_careervira: (partner.buy_on_careervira)? partner.buy_on_careervira : false,
                    display_price: hit.display_price,
                    subscription_price: hit.subscription_price,
                    image: hit.images ? formatImageResponse(hit.images): null,
                    card_image: hit.card_image ? formatImageResponse(hit.card_image):  hit.images? formatImageResponse(hit.images) : null,
                    card_image_mobile: hit.card_image_mobile? formatImageResponse(hit.card_image_mobile): hit.images? formatImageResponse(hit.images) : null,
                    sidebar_listing_image: hit.sidebar_listing_image ? formatImageResponse(hit.sidebar_listing_image): hit.images? formatImageResponse(hit.images) : null,
                    partner: partner,
                    enrollmentEndDate: hit.course_enrollment_end_date? hit.course_enrollment_end_date: null,
                    daysLeft: daysLeft,
                    sale_price: hit.sale_price? getCurrencyAmount(hit.sale_price, currencies, hit.learn_content_pricing_currency.iso_code, currency): null,
                    regular_price: hit.regular_price ? getCurrencyAmount(hit.regular_price, currencies, hit.learn_content_pricing_currency.iso_code, currency): null,
                    offer_percent: coupons[best_offer_index] ? coupons[best_offer_index].offer_percent : hit.sale_price ? (Math.round(((hit.regular_price - hit.sale_price) * 100) / hit.regular_price)) : null,
                    u_currency_symbol,
                    b_currency_symbol : hit.learn_content_pricing_currency? hit.learn_content_pricing_currency.currency_symbol : null,
                    best_offer_index,
                    coupons
                 }

                data.push(course)

            }

        }
        if(singleCourse)
            return data.length == 1 ? data[0]: {};
        else return data;

    }catch(err) {
        console.log("partner service getTopCoupons err", err)
        return [];
    }

}

const getPartnerDetails = async (partnerSlug) =>
{
    let partner, query = { "bool": { "must": [{ "match": { "slug.keyword" : partnerSlug } }] }}

    try
    {
        partner = await elasticService.search('partner', query, {}, ['name','logo', 'buy_on_careervira','name_image']);
    }
    catch(err)
    {
        console.log("single view news partner fetch err: ",err)
        return { name: partnerSlug, slug: partnerSlug, logo: null }; //empty
    }

    if(partner && partner.hits && partner.hits.length)
    {
        partner = partner.hits[0]._source;
        return {
            name: partner.name,
            slug: partnerSlug,
            logo: partner.logo ? formatImageResponse(partner.logo) : null,
            name_image: partner.name_image ? formatImageResponse(partner.name_image) : null,
            buy_on_careervira: partner.buy_on_careervira
        }
    }
    else
        return { name: partnerSlug, slug: partnerSlug, logo: null }
}

const getNewsByIds = async (req, callback) => {
    try {

        if(!currencies.length)
            currencies = await getCurrencies();

        let news = [];
        const newsOrdered = [], { currency = process.env.DEFAULT_CURRENCY } = req.query;
        let ids = [];
        if(req.query['ids'])
            ids = req.query['ids'].split(",");

        if(ids.length){

            const queryBody =  {
                "ids": {
                    "values": ids
                }
            };
            const queryPayload = { size : 100 }
            const result = await elasticService.search('news', queryBody, queryPayload);
            if(result.hits){

                news = await generateListViewData(result.hits, currency);
                for(const id of ids){
                    const n = news.find(o => o.id === id);
                    if(n)
                        newsOrdered.push(n);
                }
            }
        }
        if(callback)
            callback(null, {success: true, message: 'Fetched successfully!', data: newsOrdered});
        else
            return newsOrdered;
    } catch (error) {
        callback(null, {success: false, message: 'Failed to Fetch', data: null});
        console.log("[news by id] error",error)
    }

    }
module.exports = {
    getNewsByIds,
    generateSingleViewData,
    getNewsList,
    getNewsBySlug,
}