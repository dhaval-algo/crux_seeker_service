const elasticService = require("./elasticService");
const partnerService = require("./partnerService");
let PartnerService = new partnerService();
const models = require("../../../models");
const Sequelize = require('sequelize');
const fetch = require("node-fetch");
const _ = require('underscore');
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();
const mLService = require("./mLService");
const { isDateInRange, getlistPriceFromEcom} = require('../utils/general');

const apiBackendUrl = process.env.API_BACKEND_URL;
const pluralize = require('pluralize')
const courseFields = ["id","partner_name","total_duration_in_hrs","basePrice","images","total_duration","total_duration_unit","conditional_price","finalPrice","provider_name","partner_slug","sale_price","average_rating_actual","provider_slug","learn_content_pricing_currency","slug","partner_currency","level","pricing_type","medium","title","regular_price","partner_id","ratings","reviews", "display_price","schedule_of_sale_price","activity_count","cv_take","listing_image", "card_image", "card_image_mobile", "coupons","subscription_price","buy_on_careervira","enquiry"]
const articleFields = ["id","author_first_name","author_last_name","created_by_role","cover_image","slug","author_id","short_description","title","premium","author_slug","co_authors","partners","activity_count","section_name","section_slug", "listing_image", "card_image", "card_image_mobile"]
const learnPathFields = ["id","title","slug","images","total_duration","total_duration_unit","levels","finalPrice","sale_price","average_rating_actual","currency","pricing_type","medium","regular_price","ratings","reviews","display_price","courses","activity_count","cv_take", "listing_image", "card_image", "card_image_mobile","subscription_price","buy_on_careervira","enquiry"]
const FEATURED_RANK_LIMIT = 2;

function formatQueryForCG (req){  
    let region = (req && req.query && req.query['c697d2981bf416569a16cfbcdec1542b5398f3cc77d2b905819aa99c46ecf6f6'] )? req.query['c697d2981bf416569a16cfbcdec1542b5398f3cc77d2b905819aa99c46ecf6f6']:'India'
    return({
        "bool": {
            "should": [
                {
                    "bool": {
                        "filter": [
                            {
                                "terms": {
                                    "template.keyword": [
                                        "ARTICLE",
                                        "LEARN_GUIDE",
                                        "LEARN_ADVICE"
                                    ]
                                }
                            }
                        ]
                    }
                },
                {
                    "bool": {
                        "filter": [
                            {
                                "term": {
                                    "template.keyword": "CAREER_GUIDE"
                                }
                            },
                            {
                                "term": {
                                    "career_level.keyword": "Level 1"
                                }
                            },
                            {
                                "term": {
                                    "region.keyword": region
                                }
                            }
                        ]
                    }
                }
            ]
        }
    });
    
}

const getAllArticles = (articles_obj) => {
    const {articles = [], learn_advices = [], learn_guides = [], career_guides = [] } = articles_obj;
    let all_articles = [];
    if(articles.length > 0)
        articles.map(article => all_articles.push(article.id))
    if(learn_advices.length > 0)
        learn_advices.map(article => all_articles.push("LEARN_ADVICE_" + article.id))
    if(learn_guides.length > 0)
        learn_guides.map(article => all_articles.push("LEARN_GUIDE_" + article.id))
    if(career_guides.length > 0)
        career_guides.map(article => all_articles.push("CAREER_GUIDE_" + article.id))
    
    return all_articles;
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
            await RedisConnection.set(cacheKey, json);
            return json;
        }else{
            return [];
        }    
    } else {
        return [];
    }
};

const getBaseCurrency = (result) => {
    return result.learn_content_pricing_currency? result.learn_content_pricing_currency.iso_code:null;
};

const roundOff = (number, precision) => {
    return Math.round((number + Number.EPSILON) * Math.pow(10, precision)) / Math.pow(10, precision);
}

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

const formatImageResponse = (imageObject) => {
    let image = null
    if (imageObject.large) image = imageObject.large
    else if (imageObject.medium) image = imageObject.medium
    else if (imageObject.small) image = imageObject.small
    else if (imageObject.thumbnail) image = imageObject.thumbnail
    else if (imageObject.formats) {
        if (imageObject.formats.large && imageObject.formats.large.url) image = imageObject.formats.large.url
        else if (imageObject.formats.medium && imageObject.formats.medium.url) image = imageObject.formats.medium.url
        else if (imageObject.formats.small && imageObject.formats.small.url) image = imageObject.formats.small.url
        else if (imageObject.formats.thumbnail && imageObject.formats.thumbnail.url) image = imageObject.formats.thumbnail.url
    }
    return image
}

const paginate = async (array, page_number, page_size) => {
    return array.slice((page_number - 1) * page_size, page_number * page_size);
  }
const round = (value, step) => {
    step || (step = 1.0);
    var inv = 1.0 / step;
    return Math.round(value * inv) / inv;
};
module.exports = class recommendationService {

    async popularSkillBasedRecommendation(req) {

        try {
            let cacheData = await RedisConnection.getValuesSync("popularSkillBasedRecommendation")
            if(cacheData.noCacheData != true)
            {
                cacheData = await getlistPriceFromEcom(cacheData,"learn_content",req.query['country'])
                return { "success": true, message: "list fetched successfully", data: { list: cacheData, mlList: [], show: "logic", cacheHit:true} }
            }
        }catch(err){
            console.log(err)
        }

        let popularSkills;
        
        try{
            popularSkills =  await models.popular_skills.findAll({
                attributes: ["name"],         
                limit:5,
                raw:true,
                order: Sequelize.literal('count DESC')
            }).map(skill => skill['name'])
        }catch(err){
            console.log("popular_skills query failed",err)
            return { "success": false, message: "failed to fetched ", data: { list: [], mlList: []} }
        }

        const { currency = process.env.DEFAULT_CURRENCY, page = 1, limit = 6 } = req.query;
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
        //query popular on title, skills topics categories to find relevant courses
        esQuery.bool.should[0] = {
            bool: {
                should: [
                    {
                        bool: {
                            must: [
                                {
                                    query_string: {
                                        fields: [
                                            "title^4",
                                            "skills^3",
                                            "topics^2",
                                            "categories"
                                        ],
                                        query: popularSkills.join(" OR ").replace("/", "\\/")
                                    }
                                }                                     
                            ]
                        }
                    }
                ]
            }
        }
        const offset = (page - 1) * limit, courses = []

        try {
            const result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit ,_source: courseFields});
            if (result.hits && result.hits.length) {
                result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])

                for (const hit of result.hits) {
                    const data = await this.generateCourseFinalResponse(hit._source, currency)
                    courses.push(data);
                }
                RedisConnection.set("popularSkillBasedRecommendation", courses, process.env.CACHE_EXPIRE_COURSE_RECOMMENDATION || 60 * 15);

            }
            return { "success": true, message: "list fetched successfully", data: { list: courses, mlList: [], show: "logic" } }
        }catch(err){
            console.log(err)
            return { "success": false, message: "failed to fetched ", data: { list: [], mlList: []} }
        }
    }

    async popularGoalBasedRecommendation(req) {

        try {
            let cacheData = await RedisConnection.getValuesSync("popularGoalBasedRecommendation")
            if(cacheData.noCacheData != true)
            {
                cacheData = await getlistPriceFromEcom(cacheData,"learn_content",req.query['country'])
                return { "success": true, message: "list fetched successfully", data: { list: cacheData, mlList: [], show: "logic", cacheHit:true} }
            }
        }catch(err){
            console.log(err)
        }

        const { currency = process.env.DEFAULT_CURRENCY, page = 1, limit = 6 } = req.query;
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
        let topTenGoalsPreferredRole
        
        try {
                //find top 10 goals from redis
            topTenGoalsPreferredRole = await RedisConnection.getValuesSync("preferred-role");

        }catch(err){
            console.log("failed to fetch toptenGoals",err)
        }
            //query top ten goals on title, skills topics categories to find relevant courses
        esQuery.bool.should[0] = {
            bool: {
                should: [
                    {
                        bool: {
                            must: [
                                {
                                    query_string: {
                                        fields: [
                                            "title^4",
                                            "skills^3",
                                            "topics^2",
                                            "categories"
                                        ],
                                        query: topTenGoalsPreferredRole.join(" OR ").replace("/", "\\/")
                                    }
                                }                                     
                            ]
                        }
                    }
                ]
            }
        }
        const offset = (page - 1) * limit, courses = []
             
        try {
            const result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit ,_source: courseFields});
            if (result.hits && result.hits.length) {
                result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                for (const hit of result.hits) {
                    const data = await this.generateCourseFinalResponse(hit._source, currency)
                    courses.push(data);
                }
                RedisConnection.set("popularGoalBasedRecommendation", courses, process.env.CACHE_EXPIRE_COURSE_RECOMMENDATION || 60 * 15);

            }
            return { "success": true, message: "list fetched successfully", data: { list: courses, mlList: [], show: "logic" } }
        }catch(err){
            console.log(err)
            return { "success": false, message: "failed to fetched ", data: { list: [], mlList: []} }
        }

    }

    async getRelatedCourses(req) {
        try {
            const courseId = req.query.courseId.toString();
            const { currency, page = 1, limit = 6 } = req.query;
            const offset = (page - 1) * limit;

            const mLCourses = await this.getSimilarCoursesML(courseId, req.query['country'], currency, page, limit);
            if (mLCourses && mLCourses.length) {

                return { success: true, message: "list fetched successfully", data: { list: mLCourses, type: 'ml' } };
            }
            
            //fields to fetch 
            let fields = [
                "sub_categories",
                "skills",
                "topics",
                'title', 'id', 'status', 'regular_price'
            ];

            //priority 1 category list
            let priorityList1 = ['skills.keyword', 'topics.keyword', 'sub_categories.keyword'];
            let priorityList2 = [ 'categories.keyword' ];

            const relationData = {
                index: "learn-content",
                id: 'LRN_CNT_PUB_'+courseId
            }

            let esQuery = {
                "bool": {
                    "filter": [
                        { "term": { "status.keyword": "published" } }
                    ],
                    must_not: {
                        term: {
                            "_id": 'LRN_CNT_PUB_'+courseId
                        }
                    }
                }
            }

            function buildQueryTerms(key, i) {
                let termQuery = { "terms": {} };
                termQuery.terms[key] = { ...relationData, "path": key.replace('.keyword','') };
                termQuery.terms.boost = 30 - (i * 5);
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
            let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit ,_source: courseFields});

            let courses = [];
            if (result && result.hits.length > 0) {
                result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                for (let hit of result.hits) {
                    let course = await this.generateCourseFinalResponse(hit._source, currency);
                    courses.push(course);
                }
            }

            return { success: true, message: "list fetched successfully", data: { list: courses, type: 'logic' } };
            
            
        } catch (error) {
            console.log("Error while processing data for related courses", error);
            const response = { success: false, message: "Failed to fetch", data: { list: [], mlList: [], show: null } };
            
            return response
        }
    }

    async getPopularCourses(req) {
        let { subType="Popular", priceType="Paid" } = req.query; // Populer, Trending,Free
        let { category, sub_category, topic, currency = process.env.DEFAULT_CURRENCY,provider,partner,skill, page = 1, limit = 20 } = req.query;

        const offset = (page - 1) * limit

        let courses = [];
        try {
            let cacheKey = `popular-courses-${subType}-${category || 'category'}-${sub_category || 'sub_category'}-${topic || 'topic'}-${provider || 'provider'}-${partner || 'partner'}-${priceType || 'priceType'}-${skill || 'skill'}-${page}-${limit}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            if (cachedData.noCacheData != true) {
                courses = cachedData;
                courses = await getlistPriceFromEcom(courses,"learn_content",req.query['country'])

            } else {

                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }
                if (category) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "categories.keyword": decodeURIComponent(category)
                            }
                        }
                    );
                }
                if (sub_category) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "sub_categories.keyword": decodeURIComponent(sub_category)
                            }
                        }
                    );
                }
                if (topic) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "topics.keyword": decodeURIComponent(topic)
                            }
                        }
                    );
                }
                if (provider) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "provider_name.keyword": decodeURIComponent(provider)
                            }
                        }
                    );
                }
               
                if (partner) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "partner_name.keyword": decodeURIComponent(partner)
                            }
                        }
                    );
                }
                if (skill) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "skills.keyword": skill,
                              
                            }
                        }
                    );
                }

                if (priceType && priceType == "Free") {
                    esQuery.bool.filter.push(
                        { "term": { "pricing_type.keyword": "Free" } }
                    ); 
                }
                if (priceType && priceType == "Paid") {
                    esQuery.bool.filter.push(
                        { "term": { "pricing_type.keyword": "Paid" } }
                    );
                }
                let sort = null
                switch (subType) {
                    case "Trending":
                        sort = [{ "activity_count.last_x_days.trending_score": "desc" }, { "ratings": "desc" }]
                        break;
                    default:
                        sort = [{ "activity_count.all_time.popularity_score": "desc" }, { "ratings": "desc" }]
                        break;
                }

                let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject: sort ,_source: courseFields});

                if (result.hits) {
                    result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                    for (const hit of result.hits) {
                        var data = await this.generateCourseFinalResponse(hit._source, currency)
                        courses.push(data);
                    }
                    await RedisConnection.set(cacheKey, courses);
                    RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_COURSE_RECOMMENDATION); 
                }
            }
            let response = { success: true, message: "list fetched successfully", data: { list: courses, mlList: [], show: "logic" } };            
            return response;
           

        } catch (error) {
            console.log("Error while processing data for popular courses", error);
            let response = { success: false, message: "Failed to fetch", data: { list:[]} };            
            return response;
        }
    }

    async getSimilarCoursesML(courseId, country, currency, page = 1, limit = 6) {

        let result = await mLService.getSimilarCoursesDataML(courseId);
        let courses = [];
        const offset = (page - 1) * limit;
        if (result && result.length) {
            result = await getlistPriceFromEcom(result,"learn_content",country)

            for (const courseElasticData of result.slice(offset, offset + limit)) {
                const courseData = await this.generateCourseFinalResponse(courseElasticData._source, currency);                
                courses.push(courseData);
            }
        }
        return courses;

    }

    async exploreCoursesFromTopCatgeories(req) {

        try {            
            const response = await this.getPopularCourses(req);
            return response

        } catch (error) {
            console.log("Error occured while fetching top courses : ", error)
            return { "success": false, message: "failed to fetch", data: { list: [] } };
        }
    }


    async getTopPicksForYou(req, callback) {

        try {
            const userId = req.user.userId;
            const { profileType, category, sub_category, topic, currency = process.env.DEFAULT_CURRENCY, page = 1, limit = 6 } = req.query;
            const { skillsKeywords = [], workExpKeywords = [] } = await this.getUserProfileKeywords(userId);           

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
            if (category) {
                esQuery.bool.must.push(
                    {
                        "term": {
                            "categories.keyword": decodeURIComponent(category)
                        }
                    }
                );
            }
            if (sub_category) {
                esQuery.bool.must.push(
                    {
                        "term": {
                            "sub_categories.keyword": decodeURIComponent(sub_category)
                        }
                    }
                );
            }
            if (topic) {
                esQuery.bool.must.push(
                    {
                        "term": {
                            "topics.keyword": decodeURIComponent(topic)
                        }
                    }
                );
            }
            let courses = [];

            if(profileType == 'profile'  || !profileType)
            {
                let limitForSkills = 0;
                let limitForWorkExp = 0;

                if (skillsKeywords.length && workExpKeywords.length) {
                    limitForSkills = Math.floor(limit / 2);
                    limitForWorkExp = limit - limitForSkills;
                }
                else if (skillsKeywords.length) {
                    limitForSkills = limit;
                }
                else if (workExpKeywords.length) {
                    limitForWorkExp = limit;
                }
                if (skillsKeywords.length) {
                    const offset = (page - 1) * limitForSkills;
                    esQuery.bool.should[0].query_string.query = skillsKeywords.join(" OR ");
                    let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limitForSkills ,_source: courseFields});
                    if (result.hits && result.hits.length) {
                        result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                        for (const hit of result.hits) {
                            const data = await this.generateCourseFinalResponse(hit._source, currency)
                            courses.push(data);
                        }
                    }
                }

                if (workExpKeywords.length) {
                    const offset = (page - 1) * limitForWorkExp;
                    esQuery.bool.should[0].query_string.query = workExpKeywords.join(" OR ");
                    let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limitForWorkExp ,_source: courseFields});
                    if (result.hits && result.hits.length) {
                        result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                        for (const hit of result.hits) {
                            const data = await this.generateCourseFinalResponse(hit._source, currency)
                            courses.push(data);
                        }
                    }
                }
            }
            else if(profileType == 'goal'  || (!profileType && courses.length < 1)){
                const { highPriorityKeywords, lowPriorityKeywords } = await this.getKeywordsFromUsersGoal(userId);

                esQuery.bool.should[0] = {
                    bool: {
                        should: [
                            {
                                bool: {
                                    must: [
                                        {
                                            query_string: {
                                                fields: [
                                                    "title^4",
                                                    "skills^3",
                                                    "topics^2",
                                                    "categories"
                                                ],
                                                query: highPriorityKeywords.join(" OR ").replace("/", "\\/")
                                            }
                                        }                                     
                                    ],
                                    boost: 1000
                                }
                            },
                            {
                                bool: {
                                    must: [
                                        {
                                            query_string: {
                                                fields: [
                                                    "title^4",
                                                    "skills^3",
                                                    "topics^2",
                                                    "categories"

                                                ],
                                                query: lowPriorityKeywords.join(" OR ").replace("/", "\\/")
                                            }
                                        }                                        
                                    ],
                                    boost: 10
                                }
                            }
                        ]
                    }
                }
                const offset = (page - 1) * limit
               
                let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit ,_source: courseFields});
                if (result.hits && result.hits.length) {
                    result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                    for (const hit of result.hits) {
                        const data = await this.generateCourseFinalResponse(hit._source, currency)
                        courses.push(data);
                    }
                }
            }

            if (courses.length < 1) {
                req.query.subType = "Popular"
                if (!req.query.page) req.query.page = 1;
                if (!req.query.limit) req.query.limit = 6;
                let reposnse = await this.getPopularCourses(req);
                return reposnse
            }
           
            return { "success": true, message: "list fetched successfully", data: { list: courses, mlList: [], show: "logic" } }
        } catch (error) {
            console.log("Error occured while fetching top picks for you : ", error);
            return{ "success": false, message: "failed to fetch", data: { list: [] } }

        }
    }



    async getRecentlyViewedArticles(req) {

        try {
            const { user } = req;
            const { limit = 20, page = 1, order = "DESC" } = req.query;
            const query = {
                limit: limit,
                offset: (page - 1) * limit,
                where: { userId: user.userId },
                order: [['updatedAt', order == "DESC" ? order : "ASC"]],
                attributes: { include: ['id'] }
            }

            const articlesData = await models.recently_viewed_articles.findAll(query);
            const articleIds = articlesData.map((article) => article.articleId);

            const esQuery = {
                "ids": {
                    "values": articleIds
                }
            };
            const articles = [];
            const result = await elasticService.search('article', esQuery);
            if (result.hits && result.hits.length) {
                for (const hit of result.hits) {
                    const data = await this.generateArticleFinalResponse(hit._source);
                    articles.push(data);
                }
            }

            return { "success": true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };

        } catch (error) {
            console.log("Error occured while fetching recently viewed articles", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };
        }
    }


    async getRecentlySearchedArticles(req) {

        try {

            const { limit = 5, page = 1 } = req.query;
            const offset = (page - 1) * limit;

            const searchedArticles = [];            
            let suggestionList = await this.getUserLastSearch(req)            
            searchedArticles.push(...suggestionList['article']);

            const articlesSlugs = searchedArticles.map((article) => article.slug);

            const esQuery = {
                bool: {
                    must: [
                        {
                            term: {
                                "status.keyword": "published"
                            }
                        },
                        {
                            terms: {
                                "slug.keyword": articlesSlugs
                            }
                        }
                    ]
                }
            }
            const articles = [];
            const result = await elasticService.search("article", esQuery, { from: offset, size: limit });

            if (result.hits && result.hits.length) {
                for (const hit of result.hits) {
                    const data = await this.generateArticleFinalResponse(hit._source);
                    articles.push(data);
                }
            }


            return { "success": true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };

        } catch (error) {
            console.log("Error occured while fetching recently searched articles", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };

        }

    }

    async getPeopleAreAlsoViewingArticles(req) {
        try {
            const userId = req.user.userId;
            const { page = 1, limit = 20 ,currency} = req.query;
            const offset = (page - 1) * limit;
            const categories = await models.recently_viewed_categories.findAll({ where: { userId: userId } });
            const categoriesNames = categories.map((category) => category.name);
            const articles = [];
            if (categoriesNames.length) {
                const esQuery = {
                    bool: {
                        must: [
                            {
                                term: {
                                    "status.keyword": "published"
                                }
                            },
                            {
                                terms: {
                                    "categories.keyword": categoriesNames
                                }
                            }
                        ]
                    }
                }
                esQuery.bool.must.push(formatQueryForCG (req))

                const sort = [{ "activity_count.all_time.popularity_score": "desc" }];
                const result = await elasticService.search("article", esQuery, { from: offset, size: limit, sortObject: sort });
                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        const data = await this.generateArticleFinalResponse(hit._source);
                        articles.push(data);
                    }
                }

            }

            return { "success": true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };
        } catch (error) {

            console.log("Error occured while fetching people are also viewing articles", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };
        }
    }


    async getTopPicksForYouArticlesProfile(req) {

        const userId = req.user.userId;
        const { page = 1, limit = 6, section } = req.query;
        const { skillsKeywords = [], workExpKeywords = [] } = await this.getUserProfileKeywords(userId);
        const articles = [];
        let limitForSkills = 0;
        let limitForWorkExp = 0;
    
        if (skillsKeywords.length && workExpKeywords.length) {
            limitForSkills = Math.floor(limit / 2);
            limitForWorkExp = limit - limitForSkills;
        }
        else if (skillsKeywords.length) {
            limitForSkills = limit;
        }
        else if (workExpKeywords.length) {
            limitForWorkExp = limit;
        }
    
        const esQuery = {
            bool: {
                must: [
    
                    {
                        term: {
                            "status.keyword": "published"
                        }
                    },
                    {
                        term: {
                            "section_name.keyword": section
                        }
                    },
    
    
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
        
        esQuery.bool.must.push(formatQueryForCG (req))
        if (skillsKeywords.length) {
            const offset = (page - 1) * limitForSkills;
            esQuery.bool.should[0].query_string.query = skillsKeywords.join(" OR ");
            const result = await elasticService.search("article", esQuery, { from: offset, size: limitForSkills });
            if (result.hits && result.hits.length) {
                for (const hit of result.hits) {
                    const data = await this.generateArticleFinalResponse(hit._source);
                    articles.push(data);
                }
            }
        }
    
        if (workExpKeywords.length) {
            const offset = (page - 1) * limitForWorkExp;
            esQuery.bool.should[0].query_string.query = workExpKeywords.join(" OR ");
            const result = await elasticService.search("article", esQuery, { from: offset, size: limitForWorkExp });
            if (result.hits && result.hits.length) {
                for (const hit of result.hits) {
                    const data = await this.generateArticleFinalResponse(hit._source);
                    articles.push(data);
                }
            }
        }
    
        return articles;
    
    }


    async getTopPicksForYouArticlesGoal(req) {

        const userId = req.user.userId;
        const { page = 1, limit = 6, section } = req.query;
        const offset = (page - 1) * limit;
        const { highPriorityKeywords, lowPriorityKeywords } = await this.getKeywordsFromUsersGoal(userId);
        const articles = [];
        const esQuery = {
            bool: {
                should: [
                    {
                        bool: {
                            must: [
                                {
                                    query_string: {
                                        fields: [
                                            "title^4",
                                            "short_description^3",
                                            "article_topics^2",
                                            "categories"
                                        ],
                                        query: highPriorityKeywords.join(" OR ").replace("/", "\\/")
                                    }
                                },
                                {
                                    term: {
                                        "section_name.keyword": section
                                    }
                                },
                                {
                                    term: {
                                        "status.keyword": "published"
                                    }
                                }
                            ],
                            boost: 1000
                        }
                    },
                    {
                        bool: {
                            must: [
                                {
                                    query_string: {
                                        fields: [
                                            "title^4",
                                            "short_description^3",
                                            "article_topics^2",
                                            "categories"

                                        ],
                                        query: lowPriorityKeywords.join(" OR ").replace("/", "\\/")
                                    }
                                },
                                {
                                    term: {
                                        "section_name.keyword": section
                                    }
                                },
                                {
                                    term: {
                                        "status.keyword": "published"
                                    }
                                }
                            ],
                            boost: 10
                        }
                    }
                ]
            }
        }
        const result = await elasticService.search("article", esQuery, { from: offset, size: limit });
        
        if (result.hits && result.hits.length) {
            for (const hit of result.hits) {
                const data = await this.generateArticleFinalResponse(hit._source);
                articles.push(data);
            }
        }
        return articles;


    }
 
    async getTopPicksForYouArticles(req) {

        try {

            const { profileType } = req.query;

            let articles = [];
            if (profileType == 'profile') {

                articles = await this.getTopPicksForYouArticlesProfile(req);

            } else {

                articles = await this.getTopPicksForYouArticlesGoal(req);
            }

            return { "success": true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };

        } catch (error) {

            console.log("Error occured while fetching top picks for you articles", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };

        }

    }

    async getFeaturedArticles (req) {
        try {
            let {pageType} = req.query;        
            let { category, sub_category, topic, section, currency} = req.query; 
            let featured_articles = []
            let articles = []
            let maxArticles = 2;
            let result = null
            let query = null
            let cacheKey = `Featured_Articles-${pageType}-${category || 'category'}-${sub_category || 'sub_category'}-${topic || 'topic'}-${section || 'section'}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            if (cachedData.noCacheData != true) {
                articles = cachedData;
                return { "success": true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };
            }

            // fetch featured article if manually added from strapi
            switch (pageType) {
                case "homePage":
                case "advicePage":              
                    query = {
                    "match_all": {}
                    };                
                    result = await elasticService.search('blog_home_page', query, {from: 0, size: 1,_source:["featured_articles"]})
                    if (result.hits && result.hits.length) {
                    featured_articles =result.hits[0]._source.featured_articles                
                    }
                    maxArticles = 1
                    break;
                case "sectionPage":              
                    query = {
                        "bool": {
                          "must": [
                            { term: { "default_display_label.keyword": section } },
                          ]
                        }
                      };   
                    result = await elasticService.search('section', query, { from: 0, size: 1, _source: ["all_featured_articles"] })

                    if (result.hits && result.hits.length) {
                        featured_articles = result.hits[0]._source.all_featured_articles
                    }
                    maxArticles = 3
                break;
                case "categoryPage":
                    let categoryResponse = await fetch(`${apiBackendUrl}/categories?default_display_label=${category}`);
                    if (categoryResponse.ok) {
                        let json = await categoryResponse.json();
                        if(json && json[0].featured_articles)
                            featured_articles = getAllArticles(json[0].featured_articles);
                    }
                    maxArticles = 3
                    break
                case "subCategoryPage":
                    let subCategoryResponse = await fetch(`${apiBackendUrl}/sub-categories?default_display_label=${sub_category}`);
                    if (subCategoryResponse.ok) {
                        let json = await subCategoryResponse.json();
                        if(json && json[0].featured_articles)
                            featured_articles = getAllArticles(json[0].featured_articles);
                    }
                    maxArticles = 3
                    break
                case "topicPage":
                    let topicResponse = await fetch(`${apiBackendUrl}/topics?default_display_label=${topic}`);
                    if (topicResponse.ok) {
                        let json = await topicResponse.json();
                        if(json && json[0].featured_articles)
                            featured_articles = getAllArticles(json[0].featured_articles);
                    }
                    maxArticles = 3
                    break
                case "learnPathPage":
                    let learnPathResponse = await fetch(`${apiBackendUrl}/learning-path-landing-page`);
                    if (learnPathResponse.ok) {
                        let json = await learnPathResponse.json();
                        if(json && json.featured_articles)
                            featured_articles = getAllArticles(json.featured_articles);
                    }
                    maxArticles = 2
                    break
                default:
                    break;
            }                    
        
            
            
            if(featured_articles && featured_articles.length > 0)
            {

                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }
                esQuery.bool.must = [
                    { "terms": { "id.keyword": featured_articles }}                   
                ]                

                let result = await elasticService.search("article", esQuery, {_source: articleFields});
                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        const data = await this.generateArticleFinalResponse(hit._source)
                        articles.push(data);
                    }
                }
            }

            // If articles are less than maxArticles fetch from elasticsearch with logic
            if(articles && articles.length < maxArticles)
            {      

                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }
                
                esQuery.bool.filter.push(formatQueryForCG (req))
                //Exclude articles which are manually added
                if(articles.length >  0){
                    esQuery.bool.must_not = [
                        {
                        "ids": {
                            "values": featured_articles
                        }
                        }
                    ]
                }

                if (category) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "categories.keyword": decodeURIComponent(category)
                            }
                        }
                    );
                }
                if (sub_category) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "article_sub_categories.keyword": decodeURIComponent(sub_category)
                            }
                        }
                    );
                }
                if (topic) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "article_topics.keyword": decodeURIComponent(topic)
                            }
                        }
                    );
                }

                if (section) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "section_name.keyword": decodeURIComponent(section)
                            }
                        }
                    );
                }

                if(pageType == "learnPathPage")
                {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "section_name.keyword":"Learn Guide"
                            }
                        }
                    );
                }
            
                let sort = [{ "activity_count.last_x_days.trending_score": "desc" }]                
                let result = await elasticService.search("article", esQuery, { from: 0, size: (maxArticles - articles.length) , sortObject: sort , _source: articleFields});
                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        const data = await this.generateArticleFinalResponse(hit._source)
                        articles.push(data);
                    }
                }
            }
            await RedisConnection.set(cacheKey, articles);
            RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_ARTICLE_RECOMMENDATION); 

            return { "success": true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };
        } catch (error) {
            console.log("Error occured while fetching featured articles", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };
        }
    }


    async getArticleAdvice (req) {
        try {
            let {pageType} = req.query;        
            let { category, sub_category, topic, currency} = req.query; 
            let article_advice = []
            let articles = []
            let maxArticles = 8;
            let cacheKey = `Article_Advice-${pageType}-${category || 'category'}-${sub_category || 'sub_category'}-${topic || 'topic'}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            if (cachedData.noCacheData != true) {
                articles = cachedData;
                return { "success": true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };
            }

            // fetch  article advice if manually added from strapi
            switch (pageType) {               
                case "categoryPage":
                    let categoryResponse = await fetch(`${apiBackendUrl}/categories?default_display_label=${category}`);
                    if (categoryResponse.ok) {
                        let json = await categoryResponse.json();
                        if(json && json[0].article_advice)
                            article_advice = getAllArticles(json[0].article_advice);
                    }
                    break
                case "subCategoryPage":
                    let subCategoryResponse = await fetch(`${apiBackendUrl}/sub-categories?default_display_label=${sub_category}`);
                    if (subCategoryResponse.ok) {
                        let json = await subCategoryResponse.json();
                        if(json && json[0].article_advice)                    
                            article_advice = getAllArticles(json[0].article_advice);
                    }
                    break
                case "topicPage":
                    let topicResponse = await fetch(`${apiBackendUrl}/topics?default_display_label=${topic}`);
                    if (topicResponse.ok) {
                        const json = await topicResponse.json();
                        if(json && json[0].article_advice)
                            article_advice = getAllArticles(json[0].article_advice);
                    }
                    break
                case "learnPathPage":
                    let learnPathResponse = await fetch(`${apiBackendUrl}/learning-path-landing-page`);
                    if (learnPathResponse.ok) {
                        let json = await learnPathResponse.json();
                        if(json && json.article_advice)
                            article_advice = getAllArticles(json.article_advice);
                    }
                    break
                default:
                    break;
            }                    
        
            
            
            if(article_advice && article_advice.length > 0)
            {

                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }
                esQuery.bool.must = [{ "terms": { "id.keyword": article_advice } }]

                let result = await elasticService.search("article", esQuery, {_source: articleFields});

                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        const data = await this.generateArticleFinalResponse(hit._source)
                        articles.push(data);
                    }
                }
            }

            // If articles are less than maxArticles fetch from elasticsearch with logic
            if(articles && articles.length < maxArticles)
            {
                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }
                
                esQuery.bool.filter.push(formatQueryForCG (req))

                // exclude manually added articles and featured articles
                let exclude_articles = []
                if(articles.length >  0){
                    exclude_articles =  article_advice
                }

                let fetaured_articles = await this.getFeaturedArticles(req)
                if(fetaured_articles.data && fetaured_articles.data.list && fetaured_articles.data.list.length > 0)
                {
                    fetaured_articles.data.list.map(article => exclude_articles.push(article.id))
                    
                }
                
                esQuery.bool.must_not = [
                    {
                    "ids": {
                        "values": exclude_articles
                    }
                    }
                ]

                // filter for category 
                if (category) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "categories.keyword": decodeURIComponent(category)
                            }
                        }
                    );
                }

                // filter for subcategory 
                if (sub_category) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "article_sub_categories.keyword": decodeURIComponent(sub_category)
                            }
                        }
                    );
                }

                // filter for topic 
                if (topic) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "article_topics.keyword": decodeURIComponent(topic)
                            }
                        }
                    );
                }
               
                let sort = [{ "activity_count.last_x_days.trending_score": "desc" }]

                if(pageType == "learnPathPage")
                {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "section_name.keyword":"Learn Guide"
                            }
                        }
                    );                                   

                    let result = await elasticService.search("article", esQuery, { from: 0, size: (maxArticles - articles.length) , sortObject: sort ,_source: articleFields});
                
                    if (result.hits && result.hits.length) {
                        for (const hit of result.hits) {
                            const data = await this.generateArticleFinalResponse(hit._source)
                            articles.push(data);
                        }
                    }
                }
                else
                {
                    // Fecth sections
                    let sectionQuery = {
                        "bool": {
                            "filter": [
                                { "term": { "featured": true } }
                            ]
                        }
                    }
                    let sections = []
                    let sectoinResult = await elasticService.search("section", sectionQuery, {_source:["default_display_label"]});
                    if (sectoinResult.hits && sectoinResult.hits.length) {
                        for (const hit of sectoinResult.hits) {
                            const data = await this.generateArticleFinalResponse(hit._source)
                            sections.push(hit._source.default_display_label);
                        }
                    }
                    
                    //calculate articles per section
                    let remaining_articles = maxArticles - articles.length
                    let article_per_section = [];
                    
                    let count = 0;
                    while(count <= remaining_articles)
                    {
                        for(let section  of sections )
                        {
                            if(count <remaining_articles)
                            {
                                (article_per_section[section])?  article_per_section[section]+= 1 : article_per_section[section] = 1;
                            }
                            count++;                         
                        }
                    }

                    let sectioncount = 0;
                    for (const [key, value] of Object.entries(article_per_section)) {
                        if(sectioncount > 0)  esQuery.bool.filter.pop();
                        esQuery.bool.filter.push(
                            {
                                "term": {
                                    "section_name.keyword":key
                                }
                            }
                        );
                        let result = await elasticService.search("article", esQuery, { from: 0, size: value , sortObject: sort ,_source: articleFields});
                
                        if (result.hits && result.hits.length) {
                            for (const hit of result.hits) {
                                const data = await this.generateArticleFinalResponse(hit._source)
                                articles.push(data);
                            }
                        }
                        sectioncount++;
                    }
                    
                }
            }
            await RedisConnection.set(cacheKey, articles);
            RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_ARTICLE_RECOMMENDATION); 
            return { "success": true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };
        } catch (error) {
            console.log("Error occured while fetching featured articles", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };
        }
    }

    async generateCourseFinalResponse(result, currency=process.env.DEFAULT_CURRENCY){
        const partnerCourseImage = await RedisConnection.getValuesSync("partner-course-image-"+result.partner_slug);
        let desktop_course_image = null , mobile_course_image = null, partner_logo = null;
        if(partnerCourseImage.noCacheData != true)
        {
            desktop_course_image = partnerCourseImage.desktop_course_image;
            mobile_course_image = partnerCourseImage.mobile_course_image;
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
            }
        }


        let data = {
            title: result.title,
            slug: result.slug,
            id: `LRN_CNT_PUB_${result.id}`,
            provider: {
                name: result.provider_name,
                slug: result.provider_slug
            },
            partner: {
                name: result.partner_name,
                slug: result.partner_slug,
            },
            cover_image: desktop_course_image ? desktop_course_image : ((result.images)? formatImageResponse(result.images) :null),
            sidebar_listing_image: desktop_course_image ? desktop_course_image : ((result.listing_image)? formatImageResponse(result.listing_image) : ((result.images)? formatImageResponse(result.images) : null)),
            card_image: desktop_course_image ? desktop_course_image : ((result.card_image)? formatImageResponse(result.card_image) : ((result.images)? formatImageResponse(result.images) : null)),
            card_image_mobile: mobile_course_image ? mobile_course_image : ((result.card_image_mobile)? formatImageResponse(result.card_image_mobile) : ((result.images)? formatImageResponse(result.images) : null)),
            course_details: {
                //duration: (result.total_duration_in_hrs) ? Math.floor(result.total_duration_in_hrs/duration_divider)+" "+duration_unit : null,
                duration: getDurationText(result.total_duration, result.total_duration_unit),
                total_duration_unit: result.total_duration_unit,  
                level: (result.level) ? result.level : null,
                medium: (result.medium) ? result.medium : null,
                pricing: {                    
                    display_price: ( typeof result.display_price !='undefined' && result.display_price !=null)? result.display_price :true,
                    pricing_type: result.pricing_type
                },          
            },
            ratings: {
                total_review_count: result.reviews ? result.reviews.length : 0,
                average_rating: 0,
                average_rating_actual: 0                
            },
            isCvTake:(result.cv_take && result.cv_take.display_cv_take)? true: false,
            is_subscription: (result.subscription_price)? result.subscription_price : false,
            buy_on_careervira: (result.buy_on_careervira)? result.buy_on_careervira : false,
            show_enquiry: (result.enquiry)? result.enquiry : false,
            pricing_details:(result.pricing_details)?result.pricing_details :null
           
        };     

        data.couponCount = 0;
        if(result.pricing_type == "Paid")
        {
            data.couponCount = 0;
            if(result.coupons && result.coupons.length > 0){
                for(let coupon of result.coupons)
                    if(coupon.validity_end_date == null || coupon.validity_start_date == null || isDateInRange(coupon.validity_start_date,  coupon.validity_end_date))
                        data.couponCount++
            }
        }

        data.buy_on_careervira = false
        //get buy_on_careervira from partner
        let partnerData = await PartnerService.getPartner({params : {slug:result.partner_slug},query:{currency:currency}})
        if(partnerData && partnerData.buy_on_careervira  && data.course_details.instruction_type !='Instructor Paced')
        {
            data.buy_on_careervira =true
        }
        if(partnerData && partnerData.logo)
        {
            data.partner.logo =partnerData.logo
        }       
       
        if(data.pricing_details)
        {
            data.pricing_details.display_price = ( typeof result.display_price !='undefined' && result.display_price !=null)? result.display_price :true
            data.pricing_details.pricing_type =  result.pricing_type
        }
        
        if(data.course_details.medium == 'Others'){
            data.course_details.medium = null;
        }       
        
        if(data.course_details.pricing.pricing_type == 'Others'){
            data.course_details.pricing.pricing_type = null;
        }
            

        const LEARN_CONTENT_POPULARITY_SCORE_THRESHOLD = await RedisConnection.getValuesSync("COURSE_POPULARITY_SCORE_THRESHOLD");

        data.isPopular  = false
        if(LEARN_CONTENT_POPULARITY_SCORE_THRESHOLD  && result.activity_count && (result.activity_count.all_time.popularity_score > parseInt(LEARN_CONTENT_POPULARITY_SCORE_THRESHOLD)))
        {
            data.isPopular  = true
        }

        const LEARN_CONTENT_TRENDING_SCORE_THRESHOLD = await RedisConnection.getValuesSync("COURSE_TRENDING_SCORE_THRESHOLD");
        
        data.isTrending  = false
        if(LEARN_CONTENT_TRENDING_SCORE_THRESHOLD && result.activity_count && (result.activity_count.last_x_days.trending_score > parseInt(LEARN_CONTENT_TRENDING_SCORE_THRESHOLD)))
        {
            data.isTrending  = true
        }

        if(result.reviews && result.reviews.length > 0){
            let totalRating = 0;
            let ratings = {};
            for(let review of result.reviews){
                totalRating += review.rating;

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

        }

        if(!data.buy_on_careervira && data.pricing_details)
        {
            data.pricing_details.couponCount = data.couponCount
        }

        return data;
    }

    async getAuthor(id){
        try{
            let author = null;
            if(id)
            {
                const query = { "bool": {
                    "filter": [
                    {term: { "user_id": id }}
                    ]
                }};
                const result = await elasticService.search('author', query, {_source: ['first_name','last_name','slug','image']});
                if(result.hits && result.hits.length > 0){
                    author = await this.generateAuthorData(result.hits[0]._source);
                }
            }
            return author;     
        }catch(e){
            console.log("error fetching author", e);
            return null

        }
        
    }

    async generateAuthorData(result){
        let data = {          
            firstname: result.first_name,
            lastname: result.last_name,
            slug: result.slug,
            image: result.image? formatImageResponse(result.image) : null
           
        };
        return data;
    }

    async generateArticleFinalResponse(result){
        try{
            let author = null
            if(!result.created_by_role) result.created_by_role='author'
            if(result.created_by_role=='author')
            {            
                let auth = await this.getAuthor(result.author_id);       
                if(auth){
                    author = [{                        
                        firstname: auth.firstname? auth.firstname.trim():"",
                        lastname: auth.lastname ? auth.lastname.trim():"",                      
                        slug: auth.slug,
                        image:auth.image
                    }];
                }else{
                    author = [{
                        firstname: result.author_first_name ? result.author_first_name.trim(): "",
                        lastname: result.last_name ? result.author_last_name.trim():"",
                        slug: null,
                        image:null
                    }];
                }
            }
            else
            {
                author = []
            }
            

            if(result.co_authors && result.co_authors.length > 0)
            {
                for( let co_author of result.co_authors)
                {
                    author.push({                       
                        firstname:co_author.first_name.trim(),
                        lastname: co_author.last_name ? co_author.last_name.trim():"",
                        slug: co_author.slug,
                        image:(co_author.image)? formatImageResponse(co_author.image) : null
                    });
                }
            }
            if(result.partners && result.partners.length > 0 )
            {
                result.partners = result.partners.filter(partner=>partner.id != null)
            }
            
            if(result.partners && result.partners.length > 0 )
            {

                const partnerQuery = { 
                    "bool": {
                        "should": [
                        {
                            "match": {
                            "id": {"boost": 2, "query": result.partners[0].id }
                            
                            }
                            
                        },
                        {
                            "terms": {
                            "id": result.partners.map(partner=>partner.id) 
                            }
                        }
                        ]
                    }
                };
                const partnerResult = await elasticService.search('partner', partnerQuery, {_source: ['name','slug']}, null);
                let partners = []
                if(partnerResult.total && partnerResult.total.value > 0){
                    for(let hit of partnerResult.hits){
                        partners.push({
                            name: hit._source.name.trim(),
                            slug: hit._source.slug,
                            image:(hit._source.cover_image) ? formatImageResponse (hit._source.cover_image) :null
                        })
                    }
                }
                result.partners = partners
            }     
            if(author && author.length > 0)  
            {
                author = author.filter(entity => entity.slug !=null )
            }         
            
            let data = {
                title: result.title,
                premium: (result.premium)? result.premium:false,
                display_author: (result.display_author)? result.display_author:true,
                slug: result.slug,
                id: `ARTCL_PUB_${result.id}`,          
                cover_image: (result.cover_image)? formatImageResponse(result.cover_image) : null,
                sidebar_listing_image: (result.listing_image)? formatImageResponse(result.listing_image) : ((result.cover_image)? formatImageResponse(result.cover_image) : null),            
                card_image:(result.card_image)? formatImageResponse(result.card_image) : ((result.cover_image)? formatImageResponse(result.cover_image) : null),
                card_image_mobile:(result.card_image_mobile)? formatImageResponse(result.card_image_mobile) : ((result.cover_image)? formatImageResponse(result.cover_image) : null),
                short_description: result.short_description,
                author: (author)? author: [],
                partners: (result.partners)? result.partners : [],
                created_by_role: (result.created_by_role)? result.created_by_role:'author',            
                section_name: result.section_name,
                section_slug: result.section_slug,
            };

            //SET popular and trending keys
            const ARTICLE_POPULARITY_SCORE_THRESHOLD = parseInt(await RedisConnection.getValuesSync("ARTICLE_POPULARITY_SCORE_THRESHOLD"));

            data.isPopular  = false
            if( (ARTICLE_POPULARITY_SCORE_THRESHOLD >= 0 ) && result.activity_count && (result.activity_count.all_time.popularity_score > ARTICLE_POPULARITY_SCORE_THRESHOLD))
            {
                data.isPopular  = true
            }

            const ARTICLE_TRENDING_SCORE_THRESHOLD = parseInt(await RedisConnection.getValuesSync("ARTICLE_TRENDING_SCORE_THRESHOLD"));
            
            data.isTrending  = false
            if( (ARTICLE_TRENDING_SCORE_THRESHOLD >= 0) && result.activity_count && (result.activity_count.last_x_days.trending_score > ARTICLE_TRENDING_SCORE_THRESHOLD))
            {
                data.isTrending  = true
            }
            return data;
        }
        catch(err){
            console.log("ERROR: ",err)
        }
    }

    async relatedLearnPaths(req){
        try {
            const learnPathId = req.query.learnPathId.toString();
            const { currency, page = 1, limit = 6 } = req.query;
            const offset = (page - 1) * limit;

            //priority 1 category list
            let priorityList1 = ['sub_categores.keyword', 'skills.keyword', 'topics.keyword'];
            let priorityList2 = ['regular_price','provider.keyword', 'levels.keyword', 'medium.keyword'];

            const relationData = {
                index: "learn-path",
                id: learnPathId
            }

            let esQuery = {
                "bool": {
                    "filter": [
                        { "term": { "status.keyword": "approved" } }
                    ],
                    must_not: {
                        term: {
                            "_id": learnPathId
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

            let result = await elasticService.search("learn-path", esQuery, { from: offset, size: limit ,_source: learnPathFields});

            let learnPaths = [];
            if (result && result.hits.length > 0) {
                result.hits = await getlistPriceFromEcom(result.hits,"learn_path",req.query['country'])
                for (let hit of result.hits) {
                    let learnPath = await this.generateLearnPathFinalResponse(hit._source, currency);
                    learnPaths.push(learnPath);
                }
            }

            let show = "logic";

            const response = { success: true, message: "list fetched successfully", data:{list:learnPaths,mlList:[],show:show} };
            
            return response
        } catch (error) {
            console.log("Error while processing data for related learnpaths", error);
            const response = { success: false, message: "list fetched successfully", data:{list:[]} };
            
            return response
        }
    }

    async getPopularLearnPaths(req){
        let { subType="Popular", priceType="Paid" } = req.query; // Populer, Trending,Free
        let { category, sub_category, topic, currency, page = 1, limit =20} = req.query;  

        let cacheKey = `popular-learn-paths-${subType}-${category || ''}-${sub_category || ''}-${topic || ''}-${priceType || ''}-${page}-${limit}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);

        if (cachedData.noCacheData != true) {
            cachedData = await getlistPriceFromEcom(cachedData,"learn_path",req.query['country'])
            return { "success": true, message: "list fetched successfully", data: { list: cachedData, mlList: [], show: "logic" } }
        }
        
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
            
            let result = await elasticService.search("learn-path", esQuery, { from: offset, size: limit, sortObject:sort, _source :learnPathFields});
              
            if(result.hits){
                result.hits = await getlistPriceFromEcom(result.hits,"learn_path",req.query['country'])
                for(const hit of result.hits){
                    var data = await this.generateLearnPathFinalResponse(hit._source,currency)
                    learnpaths.push(data);
                }
            }
            await RedisConnection.set(cacheKey, learnpaths);
            RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_LEARN_PATH_RECOMMENDATION); 
            let response = { "success": true, message: "list fetched successfully", data: { list: learnpaths, mlList: [], show: "logic" } };
            
            return response;
           
            
        } catch (error) {
            console.log("Error while processing data for popular learnpaths", error);
            let response = { success: false, message: "failed to fetch", data:{ list:[] } };
            
            return response;
        }
    }
    
    async getRelatedLearningPathForCourse(req){      
        const { page = 1, limit = 5, currency} = req.query;
        const offset = (page - 1) * limit
        const courseId = req.query.courseId;
        let topics = null
        let sub_categories = null
        let categories = null
        let skills  = null
        let learnpaths = [];
        try {
            let cacheKey = `Related-LearnPaths-For-Course-${courseId}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            
            if (cachedData.noCacheData != true) {
                learnpaths = cachedData;
                learnpaths = await getlistPriceFromEcom(learnpaths,"learn_path",req.query['country'])

            } else {

                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } },
                            {"term": { "id":  courseId}}
                        ]
                    }
                }             
                
                let courseData = await elasticService.search("learn-content", esQuery, {_source: ['topics','sub_categories','categories','skills']});
                

                if (courseData.hits) {
                    for (const hit of courseData.hits) {
                        if(hit._source.categories && hit._source.categories.length > 0)
                        {
                            categories = hit._source.categories
                        }
                        if(hit._source.sub_categories && hit._source.sub_categories.length > 0)
                        {
                            sub_categories = hit._source.sub_categories
                        }
                        if(hit._source.topics && hit._source.topics.length > 0)
                        {
                            topics = hit._source.topics
                        }
                        if(hit._source.skills && hit._source.skills.length > 0)
                        {
                            skills = hit._source.skills
                        }                                           
                    }

                }
                esQuery = {}
                esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "approved" } }
                        ],
                        "should":[
                        {
                            "terms": {
                                "courses.id.keyword": [`LRN_CNT_PUB_${courseId}`],
                                "boost":10
                            }
                        }
                        ]
                    }
                }
                if (topics) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "topics.keyword": topics,
                                "boost":5
                            }
                        }
                    );
                }
                if (sub_categories) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "sub_categories.keyword": sub_categories,
                                boost:4
                            }
                        }
                    );
                }
                if (skills) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "title.keyword": skills,
                                boost:3
                            }
                        }
                    );                   
                }
                if (categories) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "categories.keyword": categories,
                                boost:2
                            }
                        }
                    );
                }                
            
                let  sort =null
                
                let result = await elasticService.search("learn-path", esQuery, { from: offset, size: limit, sortObject:sort, _source :learnPathFields});

                if(result.hits){
                    result.hits = await getlistPriceFromEcom(result.hits,"learn_path",req.query['country'])
                    for(const hit of result.hits){
                        var data = await this.generateLearnPathFinalResponse(hit._source,currency)
                        learnpaths.push(data);
                    }
                }
                await RedisConnection.set(cacheKey, learnpaths);
                RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_LEARN_PATH_RECOMMENDATION); 
            }

            return { success: true, message: "list fetched successfully", data: { list: learnpaths, mlList: [], show: "logic" } };


        } catch (error) {
            console.log("Error while processing data for related learnpath for course", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };

        }
    }

    async getAssociatedLearningPathForCourse(req){      
        const { page = 1, limit = 5, currency} = req.query;
        const offset = (page - 1) * limit
        const courseId = req.query.courseId.toString();     
        let learnpaths = [];
        try {
            let cacheKey = `sssociated-LearnPaths-For-Course-${courseId}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            
            if (cachedData.noCacheData != true) {
                learnpaths = cachedData;
                learnpaths = await getlistPriceFromEcom(learnpaths,"learn_path",req.query['country'])
            } else {

                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "approved" } },
                            {"term" : {"courses.id.keyword":courseId}}
                        ],

                    }
                }               
                
                let result = await elasticService.search("learn-path", esQuery, { from: offset, size: limit, _source :learnPathFields});
                if(result.hits){
                    result.hits = await getlistPriceFromEcom(result.hits,"learn_path",req.query['country'])
                    for(const hit of result.hits){
                        var data = await this.generateLearnPathFinalResponse(hit._source,currency)
                        learnpaths.push(data);
                    }
                }
                await RedisConnection.set(cacheKey, learnpaths);
                RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_LEARN_PATH_RECOMMENDATION); 
            }

            return { success: true, message: "list fetched successfully", data: { list: learnpaths, mlList: [], show: "logic" } };


        } catch (error) {
            console.log("Error while processing data for related learnpath for course", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };

        }
    }
    

    async getLearnPathRecommendationForUser(req){
        const userId = req.user.userId;
        if(!userId){
            return { "success": false, message: "failed to fetch", data: { list: [] } };
        }
        const { page = 1, limit = 4 ,currency} = req.query;
        const offset = (page - 1) * limit;

        let cacheKey = `learn-paths-recommendations-${userId}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);

        if (cachedData.noCacheData != true) {
            cachedData = await getlistPriceFromEcom(cachedData,"learn_path",req.query['country'])
            return { "success": true, message: "list fetched successfully", data: { list: cachedData, mlList: [], show: "logic" }}
        }
        try {
            let goalsKeywords = []
            const { highPriorityKeywords, lowPriorityKeywords } = await this.getKeywordsFromUsersGoal(userId);
            goalsKeywords = [...highPriorityKeywords, ...lowPriorityKeywords];

            const learnPaths = [];

            const query = {
                where: {userId: userId},   
                attributes: { include: ['id'] }
            }

            let courseIds = [];
            courseIds = await models.recently_viewed_course.findAll(query);
            courseIds = courseIds.map((course)=> course.courseId);

            let topics = []
            let sub_categories = []
            let categories = []
            let skills  = []

            let esQuery
            esQuery = {
                "bool": {
                    "filter": [
                        { "term": { "status.keyword": "published" } }
                    ]
                }
            }
            esQuery.bool.must = [
                {
                "ids": {
                    "values": courseIds
                }
                }
            ]
            
            let courseData = await elasticService.search("learn-content", esQuery, {_source: ['topics','sub_categories','categories','skills']});
            if (courseData.hits) {
                for (const hit of courseData.hits) {
                    if(hit._source.categories && hit._source.categories.length > 0)
                    {
                        categories.push(...hit._source.categories)
                    }
                    if(hit._source.sub_categories && hit._source.sub_categories.length > 0)
                    {
                        sub_categories.push(...hit._source.sub_categories)
                    }
                    if(hit._source.topics && hit._source.topics.length > 0)
                    {
                        topics.push(...hit._source.topics)
                    }
                    if(hit._source.skills && hit._source.skills.length > 0)
                    {
                        skills.push(...hit._source.skills)
                    }                   
                }

            }
            esQuery = {}

            esQuery = {
                bool: {
                    filter:[
                        { "term": { "status.keyword": "approved" } }
                    ],
                    should: [
                        {
                            bool: {
                                should: [
                                    {
                                        query_string: {
                                            fields: [
                                                "title^4",
                                                "description^3",
                                                "topics^2",
                                                "categories"
                                            ],
                                            query: goalsKeywords.join(" OR ").replace("/", "\\/")
                                        }
                                    }
                                ],
                                boost: 1000
                            }
                        },
                        {
                            bool: {
                                should: [],
                                boost: 10
                            }
                        }
                    ]
                }
            }
            if (topics.length) {
                esQuery.bool.should[1].bool.should.push(
                    {
                        "terms": {
                            "topics.keyword": topics,
                            "boost":5
                        }
                    }
                );
            }
            if (sub_categories.length) {
                esQuery.bool.should[1].bool.should.push(
                    {
                        "terms": {
                            "sub_categories.keyword": sub_categories,
                            boost:4
                        }
                    }
                );
            }
            if (categories.length) {
                esQuery.bool.should[1].bool.should.push(
                    {
                        "terms": {
                            "categories.keyword": categories,
                            boost:3
                        }
                    }
                );
            }
            if (skills.length) {
                esQuery.bool.should[1].bool.should.push(
                    {
                        "terms": {
                            "skills.keyword": skills,
                            boost:2
                        }
                    }
                );
            }
            let result = await elasticService.search("learn-path", esQuery, { from: offset, size: limit,_source :learnPathFields});
            
            if (result.hits && result.hits.length) {
                result.hits = await getlistPriceFromEcom(result.hits,"learn_path",req.query['country'])
                for (const hit of result.hits) {
                    const data = await this.generateLearnPathFinalResponse(hit._source, currency);
                    learnPaths.push(data);
                }
            }
            await RedisConnection.set(cacheKey, learnPaths);
            RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_LEARN_PATH_RECOMMENDATION);
            let response = { "success": true, message: "list fetched successfully", data: { list: learnPaths, mlList: [], show: "logic" } };
            
            return response;
           
            
        } catch (error) {
            console.log("Error while processing data for learn Paths Recommendations", error);
            let response = { success: false, message: "failed to fetch", data: { list: []} };
            
            return response;
        }
    }

    async getPopularArticles(req) {
        const { subType, category, sub_category, topic, skill, section, page = 1, limit = 6 ,currency} = req.query;
        const offset = (page - 1) * limit

        const articles = [];
        try {
            let esQuery = {
                "bool": {
                    "filter": [
                        { "term": { "status.keyword": "published" } }
                    ]
                }
            }
            esQuery.bool.filter.push(formatQueryForCG (req))

            if (category) {
                esQuery.bool.filter.push(
                    {
                        "term": {
                            "categories.keyword": decodeURIComponent(category)
                        }
                    }
                );
            }
           
            if (sub_category) {
                esQuery.bool.filter.push(
                    {
                        "term": {
                            "article_sub_categories.keyword": decodeURIComponent(sub_category)
                        }
                    }
                );
            }
            if (topic) {
                esQuery.bool.filter.push(
                    {
                        "term": {
                            "article_topics.keyword": decodeURIComponent(topic)
                        }
                    }
                );
            }

            if (skill) {
                esQuery.bool.filter.push(
                    { "term": { "article_skills.keyword": skill } }
                );

            }
            if (section) {
                esQuery.bool.filter.push(
                    { "term": { "section_name.keyword": section } }
                );

            }
            let sort = null

            switch (subType) {
                case "Trending":
                    sort = [{ "activity_count.last_x_days.trending_score": "desc" }];

                    break;

                case "Recently-Added":
                    sort = [{ "published_date": { "order": "desc" } }];
                    break;
                default:
                    sort = [{ "activity_count.all_time.popularity_score": "desc" }]
                    break;
            }

            const result = await elasticService.search("article", esQuery, { from: offset, size: limit, sortObject: sort, _source: articleFields });
            if (result.hits) {
                for (const hit of result.hits) {
                    const data = await this.generateArticleFinalResponse(hit._source);                    
                    articles.push(data);
                }

            }

            return { success: true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };


        } catch (error) {
            console.log("Error while processing data for popular articles", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };

        }

    }

    async generateLearnPathFinalResponse(result, currency = process.env.DEFAULT_CURRENCY) {
        let orderedLevels = ["Beginner","Intermediate","Advanced","Ultimate","All Level","Others"]; //TODO. ordering should be sorting while storing in elastic search.
        let data = {
            id: `LRN_PTH_${result.id}`,
            title: result.title,
            slug: result.slug,
            cover_images: (result.images)? formatImageResponse(result.images) :null,
            sidebar_listing_image: (result.card_image_mobile)? formatImageResponse(result.card_image_mobile) : ((result.images)? formatImageResponse(result.images) : null),            
            card_image:(result.card_image)? formatImageResponse(result.card_image) : ((result.images)? formatImageResponse(result.images) : null),
            card_image_mobile:(result.card_image_mobile)? formatImageResponse(result.card_image_mobile) : ((result.cover_iimagesmage)? formatImageResponse(result.images) : null),
            levels: result.levels ? orderedLevels.filter(value=> result.levels.includes(value)) : [],          
            pricing: {              
                display_price: result.display_price,
                pricing_type: result.pricing_type               
            },
            ratings: {
                total_review_count: result.reviews ? result.reviews.length : 0,
                average_rating: 0,
                average_rating_actual: 0,
            },           
            duration: {
                total_duration: result.total_duration,
                total_duration_unit: result.total_duration_unit,
            },
            course_count: (result.courses)? result.courses.length : 0,
            isCvTake:(result.cv_take && result.cv_take.display_cv_take)? true: false,
            is_subscription: (result.subscription_price)? result.subscription_price : false,
            buy_on_careervira: (result.buy_on_careervira)? result.buy_on_careervira : false,
            show_enquiry: (result.enquiry)? result.enquiry : false,
            pricing_details:(result.pricing_details)? result.pricing_details:null
        }
        
        if(data.pricing_details)
        {
            data.pricing_details.display_price = ( typeof result.display_price !='undefined' && result.display_price !=null)? result.display_price :true
            data.pricing_details.pricing_type =  result.pricing_type
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
        }

        //SET popular and trending keys
        const LEARN_PATH_POPULARITY_SCORE_THRESHOLD = parseInt(await RedisConnection.getValuesSync("LEARN_PATH_POPULARITY_SCORE_THRESHOLD"));

        data.isPopular = false
        if ( (LEARN_PATH_POPULARITY_SCORE_THRESHOLD >= 0) && result.activity_count && (result.activity_count.all_time.popularity_score > LEARN_PATH_POPULARITY_SCORE_THRESHOLD)) {
            data.isPopular = true
        }

        const LEARN_PATH_TRENDING_SCORE_THRESHOLD = parseInt(await RedisConnection.getValuesSync("LEARN_PATH_TRENDING_SCORE_THRESHOLD"));

        data.isTrending = false
        if ( (LEARN_PATH_TRENDING_SCORE_THRESHOLD >= 0) && result.activity_count && (result.activity_count.last_x_days.trending_score > LEARN_PATH_TRENDING_SCORE_THRESHOLD)) {
            data.isTrending = true
        }

        return data;
    }

    async getRecentlyViewedCourses (req) {
        const { user } = req;
        let { limit = 20, page = 1, order="DESC", currency } = req.query
        
        order = order.toUpperCase();
        const query = {
            limit: limit,
            offset: (page -1) * limit,
            where: {userId: user.userId},   
            order: [['updatedAt', order == "DESC" ? order : "ASC"]],
            attributes: { include: ['id'] }
        }
    
        let courses = [];
        let courseIds = [];
        try {
            let unsortedCourses = [];
            courseIds = await models.recently_viewed_course.findAll(query);
            courseIds = courseIds.map((course)=> course.courseId);
    
            let esQuery = {
                "ids": {
                    "values": courseIds
                }
            };    
           
    
            let result = await elasticService.search('learn-content', esQuery, {form: 0, size: 20,_source:courseFields});
    
            if(result.hits){
                result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                for(const hit of result.hits){
                    let data = await this.generateCourseFinalResponse(hit._source, currency)
                    unsortedCourses.push(data);
                }
            }
    
            for (var i=0; i < courseIds.length; i++) {
                for(let course of unsortedCourses){
                    if (course.id === courseIds[i]) {
                        courses[i] = course;
                    }
                }
            }
            const response = { success: true, message: "list fetched successfully", data:{list:courses,mlList:[],show:'logic'} };
            return response
        } catch(error){
            //statusCode = 200; //should send a valid status code here
            console.error("Failed to fetch recently viewed courses",error);
            const response = { success: false, message: "Failed to fetched", data:{list:[]} };
            return response
        } 
       
    }
    async getUserLastSearch  (req) {
        
        const { user} = req;
        let userId = user.userId
    
         const existSearch = await models.user_meta.findOne({where:{userId:userId, key:'last_search'}})
    
        let suggestionList = (existSearch!=null && existSearch.value!="") ? JSON.parse(existSearch.value) : {'learn-path':[],'learn-content':[],'provider':[],'article':[]};
        if(!suggestionList['learn-path']){
            suggestionList['learn-path'] = []
        }
        if(!suggestionList['learn-content']){
            suggestionList['learn-content'] = []
        }
        if(!suggestionList['provider']){
            suggestionList['provider'] = []
        }
        if(!suggestionList['article']){
            suggestionList['article'] = []
        }

        return suggestionList
    
    }
    async recentlySearchedCourses (req) {

        try {
    
            const { currency = process.env.DEFAULT_CURRENCY, page = 1, limit = 6 } = req.query;
            const offset = (page - 1) * limit;
            let searchedCourses = [];
            let suggestionList = await this.getUserLastSearch(req)            
            searchedCourses.push(...suggestionList['learn-content']);    
            const searchedCoursesSlugs = searchedCourses.map((course) => course.slug);
    
            const esQuery = {
                bool: {
                    must: [
                        {
                            term: {
                                "status.keyword": "published"
                            }
                        },
                        {
                            terms: {
                                "slug.keyword": searchedCoursesSlugs
                            }
                        }
                    ]
                }
            }
            const courses  =[];
            let result = await elasticService.search("learn-content",esQuery,{from:offset,size:limit, _source: courseFields})
            
            if (result.hits && result.hits.length) {
                result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                for (const hit of result.hits) {
                    const data = await this.generateCourseFinalResponse(hit._source,  currency)
                    courses.push(data);
                }
            }
    
            return{ "success": true, message: "list fetched successfully", data: { list: courses, mlList: [], show: 'logic' } }
    
        } catch (error) {
            console.log("Error occured while fetching recently searched courses : ", error);
            return{ "success": false, message: "failed to fetch", data: { list: [] } };
        }
    
    }


    async peopleAreAlsoViewing (req)  {

        try {
            const userId = req.user.userId;
            const { page = 1, limit = 20, currency = process.env.DEFAULT_CURRENCY } = req.query;
            const offset = (page - 1) * limit;
            const categories = await models.recently_viewed_categories.findAll({ where: { userId: userId } });
            const categoriesNames = categories.map((category) => category.name);
            const courses = [];
            if (categoriesNames.length) {
                const esQuery = {
                    bool: {
                        must: [
                            {
                                term: {
                                    "status.keyword": "published"
                                }
                            },
                            {
                                terms: {
                                    "categories.keyword": categoriesNames
                                }
                            }
                        ]
                    }
                }
    
                const sort = [{ "activity_count.all_time.popularity_score": "desc" }, { "ratings": "desc" }];
                let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject: sort, _source:courseFields });
    
                if (result.hits && result.hits.length) {
                    result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                    for (const hit of result.hits) {
                        const data = await this.generateCourseFinalResponse(hit._source, currency)
                        courses.push(data);
                    }
                }
    
            }
            
            return { "success": true, message: "list fetched successfully", data: { list: courses, mlList: [], show: "logic" } }
        } catch (error) {
    
            console.log("Error occured while fetching people Are Also Viewing : ", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } }
        }
    }

    async enquiryBasedRecommendation (req)  {

        try {
            const userId = req.user.userId;
            if(!userId){
                return { "success": false, message: "Only authenticated users allowed.", data: { list: [] } }
            }
            const { page = 1, limit = 5, currency = process.env.DEFAULT_CURRENCY} = req.query;
            const offset = (page - 1) * limit;
            const courseValues = await models.enquiry.findAll({ where: { userId: userId} });
            if(!courseValues)
            {
                return { "success": false, message: "No list", data: { list: [] } }
            }
            const courseIds = courseValues.map((course) => course.courseId)
            // Course Ids -> Now it is used for getting topics out of them.

            let topics = []
            let sub_categories = []
            let categories = []
            let skills  = []
            let partners  = []    
            let providers  = []    
            let courses = [];

            let esQuery = {
                "bool": {
                    "filter": [
                        { "term": { "status.keyword": "published" } }
                    ]
                }
            }
            esQuery.bool.must = [
                {
                "ids": {
                    "values": courseIds
                }
                }
            ]
            
            let courseData = await elasticService.search("learn-content", esQuery, {_source: ['topics','sub_categories','categories','skills','partner_name', 'provider_name']});

            if (courseData.hits) {
                for (const hit of courseData.hits) {
                    if(hit._source.categories && hit._source.categories.length > 0)
                    {
                        categories = categories.concat(hit._source.categories)
                    }
                    if(hit._source.sub_categories && hit._source.sub_categories.length > 0)
                    {
                        sub_categories = sub_categories.concat(hit._source.sub_categories)
                    }
                    if(hit._source.topics && hit._source.topics.length > 0)
                    {
                        topics = topics.concat(hit._source.topics)
                    }
                    if(hit._source.skills && hit._source.skills.length > 0)
                    {
                        skills = skills.concat(hit._source.skills)
                    }
                    if(hit._source.partner_name)
                    {
                        partners.push(hit._source.partner_name)
                    }
                    if(hit._source.provider_name)
                    {
                        if(Array.isArray(hit._source.provider_name))
                        {
                            providers.concat(hit._source.provider_name)
                        }else{
                            providers.push(hit._source.provider_name)
                        }  
                    }                            
                }
            }
            esQuery = {}
            esQuery = {
                "bool": {
                    "filter": [
                        { "term": { "status.keyword": "published" } }
                    ],
                    "should":[],
                    "must_not":[
                        {
                            "ids": {
                                "values": courseIds
                            }
                        }
                    ]
                }
            }
            if (topics) {
                esQuery.bool.should.push(
                    {
                        "terms": {
                            "topics.keyword": topics,
                            "boost":6
                        }
                    }
                );
            }
            if (sub_categories) {
                esQuery.bool.should.push(
                    {
                        "terms": {
                            "sub_categories.keyword": sub_categories,
                            boost:5
                        }
                    }
                );
            }
            if (categories) {
                esQuery.bool.should.push(
                    {
                        "terms": {
                            "categories.keyword": categories,
                            boost:4
                        }
                    }
                );
            }
            if (skills) {
                esQuery.bool.should.push(
                    {
                        "terms": {
                            "skills.keyword": skills,
                            boost:3
                        }
                    }
                );
            }
            if (partners) {
                esQuery.bool.should.push(
                    {
                        "terms": {
                            "partner_name.keyword": partners,
                            boost:2
                        }
                    }
                );
            }

            if (providers) {
                esQuery.bool.should.push(
                    {
                        "terms": {
                            "provider_name.keyword": providers,
                            boost:1
                        }
                    }
                );
            }
        
            let  sort = [{ "activity_count.all_time.course_views": "desc" }]
            let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject: sort, _source: courseFields });
            if (result.hits && result.hits.length) {
                result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                for (const hit of result.hits) {
                    const data = await this.generateCourseFinalResponse(hit._source, currency)
                    courses.push(data);
                }
            }

            return { "success": true, message: "list fetched successfully", data: { list: courses, mlList: [], show: "logic" } }
        } catch (error) {
    
            console.log("Error occured while fetching enquiry based recommendation : ", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } }
        }
    }

    async wishlistBasedRecommendation (req)  {

        try {
            const userId = req.user.userId;
            if(!userId){
                return { "success": false, message: "Only authenticated users allowed.", data: { list: [] } }
            }
            const { page = 1, limit = 5, currency = process.env.DEFAULT_CURRENCY} = req.query;
            const offset = (page - 1) * limit;
            const courseValues = await models.user_meta.findAll({ where: { userId: userId,key:"course_wishlist"} });
            if(!courseValues)
            {
                return { "success": false, message: "No list", data: { list: [] } }
            }
            const courseIds = courseValues.map((course) => course.value)
            // Course Ids -> Now it is used for getting topics out of them.

            let topics = []
            let sub_categories = []
            let categories = []
            let skills  = []
            let partners  = []    
            let providers  = []    
            let courses = [];

            let esQuery = {
                "bool": {
                    "filter": [
                        { "term": { "status.keyword": "published" } }
                    ]
                }
            }
            esQuery.bool.must = [
                {
                "ids": {
                    "values": courseIds
                }
                }
            ]
            
            let courseData = await elasticService.search("learn-content", esQuery, {_source: ['topics','sub_categories','categories','skills','partner_name', 'provider_name']});

            if (courseData.hits) {
                for (const hit of courseData.hits) {
                    if(hit._source.categories && hit._source.categories.length > 0)
                    {
                        categories = categories.concat(hit._source.categories)
                    }
                    if(hit._source.sub_categories && hit._source.sub_categories.length > 0)
                    {
                        sub_categories = sub_categories.concat(hit._source.sub_categories)
                    }
                    if(hit._source.topics && hit._source.topics.length > 0)
                    {
                        topics = topics.concat(hit._source.topics)
                    }
                    if(hit._source.skills && hit._source.skills.length > 0)
                    {
                        skills = skills.concat(hit._source.skills)
                    }
                    if(hit._source.partner_name)
                    {
                        partners.push(hit._source.partner_name)
                    }
                    if(hit._source.provider_name)
                    {
                        if(Array.isArray(hit._source.provider_name))
                        {
                            providers.concat(hit._source.provider_name)
                        }else{
                            providers.push(hit._source.provider_name)
                        }                        
                       
                    }                            
                }
            }
            esQuery = {}
            esQuery = {
                "bool": {
                    "filter": [
                        { "term": { "status.keyword": "published" } }
                    ],
                    "should":[],
                    "must_not":[
                        {
                            "ids": {
                                "values": courseIds
                            }
                        }
                    ]
                }
            }
            if (topics) {
                esQuery.bool.should.push(
                    {
                        "terms": {
                            "topics.keyword": topics,
                            "boost":6
                        }
                    }
                );
            }
            if (sub_categories) {
                esQuery.bool.should.push(
                    {
                        "terms": {
                            "sub_categories.keyword": sub_categories,
                            boost:5
                        }
                    }
                );
            }
            if (categories) {
                esQuery.bool.should.push(
                    {
                        "terms": {
                            "categories.keyword": categories,
                            boost:4
                        }
                    }
                );
            }
            if (skills) {
                esQuery.bool.should.push(
                    {
                        "terms": {
                            "skills.keyword": skills,
                            boost:3
                        }
                    }
                );
            }
            if (partners) {
                esQuery.bool.should.push(
                    {
                        "terms": {
                            "partner_name.keyword": partners,
                            boost:2
                        }
                    }
                );
            }

            if (providers) {
                esQuery.bool.should.push(
                    {
                        "terms": {
                            "provider_name.keyword": providers,
                            boost:1
                        }
                    }
                );
            }
            
            let  sort = [{ "activity_count.all_time.course_views": "desc" }]
            let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject: sort, _source: courseFields });
            if (result.hits && result.hits.length) {
                result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                for (const hit of result.hits) {
                    const data = await this.generateCourseFinalResponse(hit._source, currency)
                    courses.push(data);
                }
            }

            return { "success": true, message: "list fetched successfully", data: { list: courses, mlList: [], show: "logic" } }
        } catch (error) {
    
            console.log("Error occured while fetching wishlist based recommendation : ", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } }
        }
    }

    async coursesRecommendationForUser (req)  {
        const user = req.user;
        if(!user){
            return { "success": false, message: "failed to fetch", data: { list: [] } };
        }
        const userId = user.userId
        const { page = 1, limit = 4, partner_slug=null, currency } = req.query;
        const offset = (page - 1) * limit;

        let cacheKey = `learn-content-recommendations-${userId}`;
        let cachedData = await RedisConnection.getValuesSync(cacheKey);

        if (cachedData.noCacheData != true) {
            return { "success": true, message: "list fetched successfully", data: { list: cachedData, mlList: [], show: "logic" }}
        }
        try {
            let goalsKeywords = []
            const { highPriorityKeywords, lowPriorityKeywords } = await this.getKeywordsFromUsersGoal(userId);
            goalsKeywords = [...highPriorityKeywords, ...lowPriorityKeywords];

            const learnContents = [];

            const query = {
                where: {userId: userId},   
                attributes: { include: ['id'] }
            }

            let courseIds = [];
            courseIds = await models.recently_viewed_course.findAll(query);
            courseIds = courseIds.map((course)=> course.courseId);

            let topics = []
            let sub_categories = []
            let categories = []
            let skills  = []
            let partners = []

            let esQuery
            esQuery = {
                "bool": {
                    "filter": [
                        { "term": { "status.keyword": "published" } }
                    ]
                }
            }
            esQuery.bool.must = [
                {
                "ids": {
                    "values": courseIds
                }
                }
            ]
            
            let courseData = await elasticService.search("learn-content", esQuery, {_source: ['topics','sub_categories','categories','skills','partner_slug']});
            if (courseData.hits) {
                for (const hit of courseData.hits) {
                    if(hit._source.categories && hit._source.categories.length > 0)
                    {
                        categories.push(...hit._source.categories)
                    }
                    if(hit._source.sub_categories && hit._source.sub_categories.length > 0)
                    {
                        sub_categories.push(...hit._source.sub_categories)
                    }
                    if(hit._source.topics && hit._source.topics.length > 0)
                    {
                        topics.push(...hit._source.topics)
                    }
                    if(hit._source.skills && hit._source.skills.length > 0)
                    {
                        skills.push(...hit._source.skills)
                    }
                    if(hit._source.partner_id)
                    {
                        partners.push(...hit._source.partner_slug)
                    }                   
                }

            }
            esQuery = {}

            esQuery = {
                bool: {
                    filter:[
                        { "term": { "status.keyword": "published" } }
                    ],
                    should: [
                        {
                            bool: {
                                should: [
                                    {
                                        query_string: {
                                            fields: [
                                                "title^4",
                                                "description^3",
                                                "topics^2",
                                                "categories"
                                            ],
                                            query: goalsKeywords.join(" OR ").replace("/", "\\/")
                                        }
                                    }
                                ],
                                boost: 1000
                            }
                        },
                        {
                            bool: {
                                should: [],
                                boost: 10
                            }
                        }
                    ]
                }
            }
            if(partner_slug !== null){
                esQuery.bool.filter.push(
                    {
                        "term": {
                            "partner_slug.keyword": partner_slug
                        }
                    }
                );
            }
            if (topics.length) {
                esQuery.bool.should[1].bool.should.push(
                    {
                        "terms": {
                            "topics.keyword": topics,
                            "boost":5
                        }
                    }
                );
            }
            if (sub_categories.length) {
                esQuery.bool.should[1].bool.should.push(
                    {
                        "terms": {
                            "sub_categories.keyword": sub_categories,
                            boost:4
                        }
                    }
                );
            }
            if (categories.length) {
                esQuery.bool.should[1].bool.should.push(
                    {
                        "terms": {
                            "categories.keyword": categories,
                            boost:3
                        }
                    }
                );
            }
            if (skills.length) {
                esQuery.bool.should[1].bool.should.push(
                    {
                        "terms": {
                            "skills.keyword": skills,
                            boost:2
                        }
                    }
                );
            }
            if (partners.length) {
                esQuery.bool.should[1].bool.should.push(
                    {
                        "term": {
                            "partner_slug.keyword": partners,
                            boost:1
                        }
                    }
                );
            }
            let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit,_source :courseFields});
            
            if (result.hits && result.hits.length) {
                result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                for (const hit of result.hits) {
                    const data = await this.generateCourseFinalResponse(hit._source,currency);
                    learnContents.push(data);
                }
            }
            await RedisConnection.set(cacheKey, learnContents);
            RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_COURSE_RECOMMENDATION); 
            let response = { "success": true, message: "list fetched successfully", data: { list: learnContents, mlList: [], show: "logic" } };
            
            return response;
           
            
        } catch (error) {
            console.log("Error while processing data for learn Content Recommendations", error);
            let response = { success: false, message: "failed to fetch", data: { list: []} };
            
            return response;
        }
    }

    async relatedCoursesForLearnPath (req)  {
        const { page = 1, limit = 5, currency} = req.query;
        const offset = (page - 1) * limit
        const learnPathId = req.query.learnPathId.toString();
        let topics = null
        let sub_categories = null
        let categories = null
        let skills  = null
        let courses = [];
        try {
            let cacheKey = `Related-Courses-For-Learnpath-${learnPathId}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            
            if (cachedData.noCacheData != true) {
                courses = cachedData;
                courses = await getlistPriceFromEcom(courses,"learn_content",req.query['country'])

            } else {

                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "approved" } }
                        ]
                    }
                }
                esQuery.bool.must = [
                    {
                    "ids": {
                        "values": [learnPathId]
                    }
                    }
                ]
                
                let learnPathData = await elasticService.search("learn-path", esQuery, {_source: ['topics','sub_categories','categories','skills']});
                

                if (learnPathData.hits) {
                    for (const hit of learnPathData.hits) {
                        if(hit._source.categories && hit._source.categories.length > 0)
                        {
                            categories = hit._source.categories
                        }
                        if(hit._source.sub_categories && hit._source.sub_categories.length > 0)
                        {
                            sub_categories = hit._source.sub_categories
                        }
                        if(hit._source.topics && hit._source.topics.length > 0)
                        {
                            topics = hit._source.topics
                        }
                        if(hit._source.skills && hit._source.skills.length > 0)
                        {
                            skills = hit._source.skills
                        }                                         
                    }

                }
                esQuery = {}
                esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ],
                        "should":[]
                    }
                }
                if (topics) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "topics.keyword": topics,
                                "boost":10
                            }
                        }
                    );
                }
                if (sub_categories) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "sub_categories.keyword": sub_categories,
                                boost:5
                            }
                        }
                    );
                }

                if (skills) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "skills.keyword": skills,
                                boost:4
                            }
                        }
                    );
                }

                if (skills) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "title.keyword": skills,
                                boost:3
                            }
                        }
                    );                    
                }

                if (categories) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "categories.keyword": categories,
                                boost:2
                            }
                        }
                    );
                }
               
            
                let  sort = [{ "activity_count.all_time.popularity_score": "desc" }]
                
                let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject:sort, _source :courseFields});

                if(result.hits){
                    result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                    for(const hit of result.hits){
                        var data = await this.generateCourseFinalResponse(hit._source,currency)
                        courses.push(data);
                    }
                }
                await RedisConnection.set(cacheKey, courses);
                RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_COURSE_RECOMMENDATION); 
            }

            return { success: true, message: "list fetched successfully", data: { list: courses, mlList: [], show: "logic" } };


        } catch (error) {
            console.log("Error while processing data for related courses for learnpaths", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };

        }
    }

    async relatedCoursesForArticle (req)  {
        const { page = 1, limit = 5, currency} = req.query;
        const offset = (page - 1) * limit
        const articleId = req.query.articleId.toString();
        let topics = null
        let sub_categories = null
        let categories = null
        let skills  = null
        let partners  = null
        let courses = [];
        try {
            let cacheKey = `Related-Courses-For-Article-${articleId}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            
            if (cachedData.noCacheData != true) {
                courses = cachedData;
                courses = await getlistPriceFromEcom(courses,"learn_content",req.query['country'])

            } else {

                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }
                esQuery.bool.must = [
                    {
                    "ids": {
                        "values": [articleId]
                    }
                    }
                ]
                
                let articleData = await elasticService.search("article", esQuery, {_source: ['article_topics','article_sub_categories','categories','article_skills','partners']});
                

                if (articleData.hits) {
                    for (const hit of articleData.hits) {
                        if(hit._source.categories && hit._source.categories.length > 0)
                        {
                            categories = hit._source.categories
                        }
                        if(hit._source.article_sub_categories && hit._source.article_sub_categories.length > 0)
                        {
                            sub_categories = hit._source.article_sub_categories
                        }
                        if(hit._source.article_topics && hit._source.article_topics.length > 0)
                        {
                            topics = hit._source.article_topics
                        }
                        if(hit._source.article_skills && hit._source.article_skills.length > 0)
                        {
                            skills = hit._source.article_skills
                        } 
                        if(hit._source.partners)
                        {
                            partners = hit._source.partners
                        }                                        
                    }

                }
                esQuery = {}
                esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ],
                        "should":[]
                    }
                }
                if (topics) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "topics.keyword": topics,
                                "boost":10
                            }
                        }
                    );
                }
                if (sub_categories) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "sub_categories.keyword": sub_categories,
                                boost:5
                            }
                        }
                    );
                }
                if (skills) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "skills.keyword": skills,
                                boost:4
                            }
                        }
                    );
                }
               
                if (skills) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "title.keyword": skills,
                                boost:3
                            }
                        }
                    );                    
                }
                if (categories) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "categories.keyword": categories,
                                boost:2
                            }
                        }
                    );
                }
                if (partners) {
                    partners = partners.map(partner => { 
                        if(partner.id)
                        {
                            return partner.id
                        }
                        else{
                            return partner
                        }
                    })
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "partner_id.keyword": partners,
                                boost:1
                            }
                        }
                    );
                }
            
                let  sort = [{ "activity_count.all_time.popularity_score": "desc" }]
                
                let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject:sort, _source :courseFields});

                if(result.hits){
                    result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                    for(const hit of result.hits){
                        var data = await this.generateCourseFinalResponse(hit._source,currency)
                        courses.push(data);
                    }
                }
                await RedisConnection.set(cacheKey, courses);
                RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_COURSE_RECOMMENDATION); 
            }

            return { success: true, message: "list fetched successfully", data: { list: courses, mlList: [], show: "logic" } };


        } catch (error) {
            console.log("Error while processing data for related courses for learnpaths", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };

        }
    }

    async getRelatedArticle(req) {
        try {
            const articleId = req.query.articleId.toString();
            const { page = 1, limit = 6 ,section} = req.query;
            const offset = (page - 1) * limit;
            let articles = [];
            let cacheKey = `Recommendation-For-Article-${articleId}-${section}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            if (cachedData.noCacheData != true) {
                articles = cachedData;
            } else {
                //priority 1 category list
                let priorityList1 = ['article_skills.keyword', 'article_topics.keyword', 'article_sub_categories.keyword'];
                let priorityList2 = ['author_id', 'partners','section_name','article_job_roles'];

                const relationData = {
                    index: "article",
                    id: articleId
                }

                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ],
                        must_not: {
                            term: {
                                "_id": articleId
                            }
                        }
                    }
                }
                if (section) {
                    esQuery.bool.filter.push(
                        { "term": { "section_name.keyword": section } }
                    );
    
                }
                esQuery.bool.filter.push(formatQueryForCG (req))

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
                
                let result = await elasticService.search("article", esQuery, { from: offset, size: limit ,_source: articleFields});

                
                if (result && result.hits.length > 0) {
                    for (let hit of result.hits) {
                        let article = await this.generateArticleFinalResponse(hit._source);
                        articles.push(article);
                    }
                }
                await RedisConnection.set(cacheKey, articles)
                RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_ARTICLE_RECOMMENDATION); 
            }
           
            const response = { success: true, message: "list fetched successfully", data:{list:articles,mlList:[],show:'logic'} };
            
            return response
        } catch (error) {
            console.log("Error while processing data for related article", error);
            const response = { success: false, message: "list fetched successfully", data:{list:[]} };
            
            return response
        }
    }


    async getRecommendationForArticle(req) {
        const { page = 1, limit = 6 ,currency} = req.query;
        const offset = (page - 1) * limit
        const articleId = req.query.articleId.toString();
        let categories = null
        let section  = null
        let articles = [];
        try {
            let cacheKey = `Recommendation-For-Article-${articleId}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            
            if (cachedData.noCacheData != true) {
                articles = cachedData;
            } else {

                //Find out the category and section of the article
                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }
                esQuery.bool.must = [
                    {
                    "ids": {
                        "values": [articleId]
                    }
                    }
                ]
                
                let currentArticleData = await elasticService.search("article", esQuery, {_source: ['section_name','category']});
                

                if (currentArticleData.hits) {
                    for (const hit of currentArticleData.hits) {
                        if(hit._source.categories && hit._source.categories.length > 0)
                        {
                            categories = hit._source.categories
                        }
                        section = hit._source.section_name                   
                    }

                }

                esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }
                esQuery.bool.filter.push(formatQueryForCG (req))
                
                if (categories) {
                    esQuery.bool.filter.push(
                        {
                            "terms": {
                                "categories.keyword": categories
                            }
                        }
                    );
                }
                else
                {
                    esQuery.bool.filter.push(
                        { "term": { "section_name.keyword": section } }
                    );
                }

                let exclude_articles = [ articleId]
                let related_article_req = {query:articleId}
                let related_article = await this.getRelatedArticle(related_article_req)
                if(related_article.data && related_article.data.list && related_article.data.list.length > 0)
                {
                    related_article.data.list.map(article => exclude_articles.push(article.id))
                    
                }
                
                esQuery.bool.must_not = [
                    {
                    "ids": {
                        "values": exclude_articles
                    }
                    }
                ]

            
                let  sort = [{ "activity_count.all_time.popularity_score": "desc" }]
                    

                const result = await elasticService.search("article", esQuery, { from: offset, size: limit, sortObject: sort, _source: articleFields });
                if (result.hits) {
                    for (const hit of result.hits) {
                        const data = await this.generateArticleFinalResponse(hit._source);
                        articles.push(data);
                    }

                }
                await RedisConnection.set(cacheKey, articles);
                RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_ARTICLE_RECOMMENDATION); 
            }

            return { success: true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };


        } catch (error) {
            console.log("Error while processing data for popular articles", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };

        }

    }

    async getRecommendationArticlesforCourse(req) {
        const { page = 1, limit = 5 , currency} = req.query;
        const offset = (page - 1) * limit
        const courseId = req.query.courseId.toString();
        let topics = null
        let sub_categories = null
        let categories = null
        let skills  = null
        let partners  = null    
        let articles = [];
        try {
            let cacheKey = `Related-Articles-For-Course-${courseId}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            
            if (cachedData.noCacheData != true) {
                articles = cachedData;
            } else {

                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }
                esQuery.bool.must = [
                    {
                    "ids": {
                        "values": [courseId]
                    }
                    }
                ]
                
                let courseData = await elasticService.search("learn-content", esQuery, {_source: ['topics','sub_categories','categories','skills','partner_id']});
                

                if (courseData.hits) {
                    for (const hit of courseData.hits) {
                        if(hit._source.categories && hit._source.categories.length > 0)
                        {
                            categories = hit._source.categories
                        }
                        if(hit._source.sub_categories && hit._source.sub_categories.length > 0)
                        {
                            sub_categories = hit._source.sub_categories
                        }
                        if(hit._source.topics && hit._source.topics.length > 0)
                        {
                            topics = hit._source.topics
                        }
                        if(hit._source.skills && hit._source.skills.length > 0)
                        {
                            skills = hit._source.skills
                        }
                        if(hit._source.partner_id)
                        {
                            partners = hit._source.partner_id
                        }
                                           
                    }

                }
                esQuery = {}
                esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ],
                        "should":[]
                    }
                }
                esQuery.bool.filter.push(formatQueryForCG (req))
                if (topics) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "article_topics.keyword": topics,
                                "boost":5
                            }
                        }
                    );
                }
                if (sub_categories) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "article_sub_categories.keyword": sub_categories,
                                boost:4
                            }
                        }
                    );
                }
                if (categories) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "categories.keyword": categories,
                                boost:3
                            }
                        }
                    );
                }
                if (skills) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "article_skills.keyword": skills,
                                boost:2
                            }
                        }
                    );
                }
                if (partners) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "partners.keyword": [partners],
                                boost:1
                            }
                        }
                    );
                }
            
                let  sort = null
                const result = await elasticService.search("article", esQuery, { from: offset, size: limit, sortObject: sort, _source: articleFields });
                if (result.hits) {
                    for (const hit of result.hits) {
                        const data = await this.generateArticleFinalResponse(hit._source);
                        articles.push(data);
                    }

                }
                await RedisConnection.set(cacheKey, articles);
                RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_ARTICLE_RECOMMENDATION); 
            }

            return { success: true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };


        } catch (error) {
            console.log("Error while processing data for related articles for course", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };

        }
    }

    async getRelatedArticlesForLearnPath(req) {
        const { page = 1, limit = 5, section,currency} = req.query;
        const offset = (page - 1) * limit
        const learnPathId = req.query.learnPathId.toString();
        let topics = null
        let sub_categories = null
        let categories = null
        let skills  = null
        let articles = [];
        try {
            let cacheKey = `Related-Articles-For-LearnPath-${learnPathId}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            
            if (cachedData.noCacheData != true) {
                articles = cachedData;
            } else {

                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "approved" } }
                        ]
                    }
                }
                esQuery.bool.must = [
                    {
                    "ids": {
                        "values": [learnPathId]
                    }
                    }
                ]
                
                let learnPathData = await elasticService.search("learn-path", esQuery, {_source: ['topics','sub_categories','categories','skills']});
                

                if (learnPathData.hits) {
                    for (const hit of learnPathData.hits) {
                        if(hit._source.categories && hit._source.categories.length > 0)
                        {
                            categories = hit._source.categories
                        }
                        if(hit._source.sub_categories && hit._source.sub_categories.length > 0)
                        {
                            sub_categories = hit._source.sub_categories
                        }
                        if(hit._source.topics && hit._source.topics.length > 0)
                        {
                            topics = hit._source.topics
                        }
                        if(hit._source.skills && hit._source.skills.length > 0)
                        {
                            skills = hit._source.skills
                        }                  
                    }

                }
                esQuery = {}
                esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ],
                        "should":[]
                    }
                }
                esQuery.bool.filter.push(formatQueryForCG (req))
                if (section) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "section_name.keyword": section
                            }
                        }
                    );
                }
                if (topics) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "article_topics.keyword": topics,
                                "boost":5
                            }
                        }
                    );
                }
                if (sub_categories) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "article_sub_categories.keyword": sub_categories,
                                boost:4
                            }
                        }
                    );
                }
                if (categories) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "categories.keyword": categories,
                                boost:3
                            }
                        }
                    );
                }
                if (skills) {
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "article_skills.keyword": skills,
                                boost:2
                            }
                        }
                    );
                }
            
                let  sort = [{ "activity_count.all_time.popularity_score": "desc" }]
                const result = await elasticService.search("article", esQuery, { from: offset, size: limit, sortObject: sort, _source: articleFields });
                if (result.hits) {
                    for (const hit of result.hits) {
                        const data = await this.generateArticleFinalResponse(hit._source);
                        articles.push(data);
                    }

                }
                await RedisConnection.set(cacheKey, articles);
                RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_ARTICLE_RECOMMENDATION); 
            }

            return { success: true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };


        } catch (error) {
            console.log("Error while processing data for related articles for learnpath", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };

        }
    }

    async articleRecommendationForUser(req) {
        const user = req.user;
        if(!user){
            return { "success": false, message: "failed to fetch", data: { list: [] } };
        }
        const userId = user.userId
        const { page = 1, limit = 4,section , currency} = req.query;
        const offset = (page - 1) * limit;

        let cacheKey = `article-recommendations-${section}-${userId}`;

        let cachedData = await RedisConnection.getValuesSync(cacheKey);

        if (cachedData.noCacheData != true) {
            return { "success": true, message: "list fetched successfully", data: { list: cachedData, mlList: [], show: "logic" }}
        }
        try {
            let goalsKeywords = []
            const { highPriorityKeywords, lowPriorityKeywords } = await this.getKeywordsFromUsersGoal(userId);
            goalsKeywords = [...highPriorityKeywords, ...lowPriorityKeywords];

            const articles = [];

            const query = {
                where: {userId: userId},   
                attributes: { include: ['id'] }
            }

            let articleIds = [];
            articleIds = await models.recently_viewed_articles.findAll(query);
            articleIds = articleIds.map((article)=> article.articleId);

            let topics = []
            let sub_categories = []
            let categories = []
            let skills  = []
            let partners = []

            let esQuery
            esQuery = {
                "bool": {
                    "filter": [
                        { "term": { "status.keyword": "published" } }
                    ]
                }
            }
            esQuery.bool.must = [
                {
                "ids": {
                    "values": articleIds
                }
                }
            ]
            
            let courseData = await elasticService.search("learn-content", esQuery, {_source: ['article_topics','article_sub_categories','categories','article_skills','partners']});
            if (courseData.hits) {
                for (const hit of courseData.hits) {
                    if(hit._source.categories && hit._source.categories.length > 0)
                    {
                        categories.push(...hit._source.categories)
                    }
                    if(hit._source.article_sub_categories && hit._source.article_sub_categories.length > 0)
                    {
                        sub_categories.push(...hit._source.article_sub_categories)
                    }
                    if(hit._source.article_topics && hit._source.article_topics.length > 0)
                    {
                        topics.push(...hit._source.article_topics)
                    }
                    if(hit._source.article_skills && hit._source.article_skills.length > 0)
                    {
                        skills.push(...hit._source.article_skills)
                    }
                    if(hit._source.partners)
                    {
                        partners.push(...hit._source.partners)
                    }                   
                }

            }
            esQuery = {}

            esQuery = {
                bool: {
                    filter:[
                        { "term": { "status.keyword": "published" } }
                    ],
                    should: [
                        {
                            bool: {
                                should: [
                                    {
                                        query_string: {
                                            fields: [
                                                "title^4",
                                                "short_description^3",
                                                "article_topics^2",
                                                "categories"
                                            ],
                                            query: goalsKeywords.join(" OR ").replace("/", "\\/")
                                        }
                                    }
                                ],
                                boost: 1000
                            }
                        },
                        {
                            bool: {
                                should: [],
                                boost: 10
                            }
                        }
                    ]
                }
            }
            esQuery.bool.filter.push(formatQueryForCG (req))
            if (section) {
                esQuery.bool.filter.push(
                    {
                        "term": {
                            "section_name.keyword": section
                        }
                    }
                );
            }
            if (topics.length) {
                esQuery.bool.should[1].bool.should.push(
                    {
                        "terms": {
                            "article_topics.keyword": topics,
                            "boost":5
                        }
                    }
                );
            }
            if (sub_categories.length) {
                esQuery.bool.should[1].bool.should.push(
                    {
                        "terms": {
                            "article_sub_categories.keyword": sub_categories,
                            boost:4
                        }
                    }
                );
            }
            if (categories.length) {
                esQuery.bool.should[1].bool.should.push(
                    {
                        "terms": {
                            "categories.keyword": categories,
                            boost:3
                        }
                    }
                );
            }
            if (skills.length) {
                esQuery.bool.should[1].bool.should.push(
                    {
                        "terms": {
                            "article_skills.keyword": skills,
                            boost:2
                        }
                    }
                );
            }
            if (partners.length) {
                esQuery.bool.should[1].bool.should.push(
                    {
                        "term": {
                            "partners.keyword": partners,
                            boost:1
                        }
                    }
                );
            }
            const result = await elasticService.search("article", esQuery, { from: offset, size: limit,_source :articleFields});
            
            if (result.hits && result.hits.length) {
                for (const hit of result.hits) {
                    const data = await this.generateArticleFinalResponse(hit._source);
                    articles.push(data);
                }
            }
            await RedisConnection.set(cacheKey, articles);
            RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_ARTICLE_RECOMMENDATION); 
            let response = { "success": true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };
            
            return response;
           
            
        } catch (error) {
            console.log("Error while processing data for article Recommendations", error);
            let response = { success: false, message: "failed to fetch", data: { list: []} };
            
            return response;
        }
    }

    async jobTitleBasedRecommendation (req)  {
        const user = req.user;
        let learnContents = []
        let jobTitles = []
        if (!user) {
            return { "success": false, message: "failed to fetch", data: { list: [] } };
        }
        try {
            const userId = user.userId
            //get job titles
            const user_experiences = await models.user_experience.findAll({
                where: {
                    userId: userId
                },
                attributes: ['jobTitle']
            })
            if (user_experiences.length > 0) {
                user_experiences.map(user_experience => jobTitles.push(user_experience.jobTitle))
                //console.log("user_experiences", user_experiences);

                const { page = 1, limit = 4 , currency} = req.query;
                const offset = (page - 1) * limit;

                let cacheKey = `jobTitleBasedRecommendation-${userId}`;
                let cachedData = await RedisConnection.getValuesSync(cacheKey);

                if (cachedData.noCacheData != true) {
                    cachedData = await getlistPriceFromEcom(cachedData,"learn_content",req.query['country'])

                    return { "success": true, message: "list fetched successfully", data: { list: cachedData, mlList: [], show: "logic" } }
                }


                let esQuery = {
                    bool: {
                        must: [
                            { "term": { "status.keyword": "published" } },
                            {
                                query_string: {
                                    fields: [
                                        "title^4",
                                        "description^3",
                                        "topics^2",
                                        "categories"
                                    ],
                                    query: jobTitles.join(" OR ").replace("/", "\\/")
                                }
                            }

                        ]
                    }
                }
                let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, _source: courseFields });


                if (result.hits && result.hits.length) {
                    result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                    for (const hit of result.hits) {
                        const data = await this.generateCourseFinalResponse(hit._source,currency);
                        learnContents.push(data);
                    }
                }
                await RedisConnection.set(cacheKey, learnContents);
                RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_ARTICLE_RECOMMENDATION); 
                let response = { "success": true, message: "list fetched successfully", data: { list: learnContents, mlList: [], show: "logic" } };

                return response;
            }
            else {

            }

        } catch (error) {
            console.log("Error while processing data for learn Content Recommendations", error);
            let response = { success: false, message: "failed to fetch", data: { list: [] } };

            return response;
        }
    }

    async getPopularComparison(req) {
        try {
            let { currency = process.env.DEFAULT_CURRENCY, page =1, limit =10 } = req.query
            let courses = []
            let compares = []

            let cacheKey = `popular_compares-${req.query.courseId}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);

            if (cachedData.noCacheData != true) {
                cachedData = await paginate(cachedData, page, limit)
                cachedData = await getlistPriceFromEcom(cachedData,"learn_content",req.query['country'])

                return { "success": true, message: "list fetched successfully", data: { list: cachedData } }
            }

            if (req.query.courseId) {
                const courseId = req.query.courseId.toString();
                //fetch course information
                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }
                esQuery.bool.must = [
                    {
                        "ids": {
                            "values": [courseId]
                        }
                    }
                ]

                let courseData = await elasticService.search("learn-content", esQuery, { _source: ['topics', 'sub_categories', 'categories', 'skills', 'partner_name'] });

                esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }
                esQuery.bool.must_not = [
                    {
                        "ids": {
                            "values": [courseId]
                        }
                    }
                ]

                if (courseData.hits) {
                    for (const hit of courseData.hits) {
                        let sort = [{ "activity_count.last_x_days.trending_score": "desc" }, { "ratings": "desc" }];
                        if (hit._source.topics && hit._source.topics.length > 0) {
                            esQuery.bool.filter.push(
                                {
                                    "terms": {
                                        "topics.keyword": hit._source.topics
                                    }
                                }
                            );
                            let result = await elasticService.search("learn-content", esQuery, { from: 0, size: 10, sortObject: sort, _source: courseFields });

                            if (result && result.hits.length > 0) {
                                result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                                for (let hit of result.hits) {
                                    let course = await this.generateCourseFinalResponse(hit._source, currency);
                                    courses.push(course);
                                }
                            }

                        }
                        if (courses.length < 10 && hit._source.sub_categories && hit._source.sub_categories.length > 0) {
                            esQuery.bool.filter[0] =
                            {
                                "terms": {
                                    "sub_categories.keyword": hit._source.sub_categories
                                }
                            }
                            if (courses.length > 0) {
                                esQuery.bool.must_not = [
                                    {
                                        "ids": {
                                            "values": courses.map(course => course.id)
                                        }
                                    }
                                ]
                            }
                            let result = await elasticService.search("learn-content", esQuery, { from: 0, size: 10 - courses.length, sortObject: sort, _source: courseFields });

                            if (result && result.hits.length > 0) {
                                result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                                for (let hit of result.hits) {
                                    let course = await this.generateCourseFinalResponse(hit._source, currency);
                                    courses.push(course);
                                }
                            }
                        }
                        if (courses.length < 10 && hit._source.categories && hit._source.categories.length > 0) {
                            esQuery.bool.filter[0] =
                            {
                                "terms": {
                                    "categories.keyword": hit._source.categories
                                }
                            }
                            if (courses.length > 0) {
                                esQuery.bool.must_not = [
                                    {
                                        "ids": {
                                            "values": courses.map(course => course.id)
                                        }
                                    }
                                ]
                            }
                            let result = await elasticService.search("learn-content", esQuery, { from: 0, size: 10 - courses.length, sortObject: sort, _source: courseFields });

                            if (result && result.hits.length > 0) {
                                result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                                for (let hit of result.hits) {
                                    let course = await this.generateCourseFinalResponse(hit._source, currency);
                                    courses.push(course);
                                }
                            }
                        }


                        if (courses.length < 10 && hit._source.skills && hit._source.skills.length > 0) {
                            esQuery.bool.filter[0] =
                            {
                                "terms": {
                                    "skills.keyword": hit._source.skills
                                }
                            }
                            if (courses.length > 0) {
                                esQuery.bool.must_not = [
                                    {
                                        "ids": {
                                            "values": courses.map(course => course.id)
                                        }
                                    }
                                ]
                            }
                            let result = await elasticService.search("learn-content", esQuery, { from: 0, size: 10 - courses.length, sortObject: sort, _source: courseFields });

                            if (result && result.hits.length > 0) {
                                result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                                for (let hit of result.hits) {
                                    let course = await this.generateCourseFinalResponse(hit._source, currency);
                                    courses.push(course);
                                }
                            }
                        }
                        if (courses.length < 10 && hit._source.partner_name) {
                            esQuery.bool.filter[0] =
                            {
                                "term": {
                                    "partner_name.keyword": hit._source.partner_name
                                }
                            }
                            if (courses.length > 0) {
                                esQuery.bool.must_not = [
                                    {
                                        "ids": {
                                            "values": courses.map(course => course.id)
                                        }
                                    }
                                ]
                            }
                            let result = await elasticService.search("learn-content", esQuery, { from: 0, size: 10 - courses.length, sortObject: sort, _source: courseFields });

                            if (result && result.hits.length > 0) {
                                result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                                for (let hit of result.hits) {
                                    let course = await this.generateCourseFinalResponse(hit._source, currency);
                                    courses.push(course);
                                }
                            }
                        }
                    }

                }
            }
            else
            {
                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }
                
                if (req.query.category) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "categories.keyword": decodeURIComponent(req.query.category)
                            }
                        }
                    );
                }                

                let sort = [{ "activity_count.last_x_days.trending_score": "desc" }, { "ratings": "desc" }];

                let result = await elasticService.search("learn-content", esQuery, { from: 0, size: 10, sortObject: sort, _source: courseFields });
                if (result && result.hits.length > 0) {
                    result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                    for (let hit of result.hits) {
                        let course = await this.generateCourseFinalResponse(hit._source, currency);
                        courses.push(course);
                    }
                }
            }
            for (let course of courses) {
                req.query.courseId = course.id.replace('LRN_CNT_PUB_','')
                let related_courses = await this.getRelatedCourses(req)
                if (course.course_details.pricing.pricing_type == "FREE") course.course_details.pricing.sale_price = 0

                if (related_courses && related_courses.data && related_courses.data.list && related_courses.data.list.length > 0) {
                    let final_course = null
                    let price_diff = null
                    for (let related_course of related_courses.data.list) {
                        if (related_course.course_details.pricing.pricing_type == "FREE") related_course.course_details.pricing.sale_price = 0
                        if (price_diff && price_diff > Math.abs(related_course.course_details.pricing.sale_price - course.course_details.pricing.sale_price)) {
                            final_course = related_course
                            price_diff = Math.abs(related_course.course_details.pricing.sale_price - course.course_details.pricing.sale_price)

                        } else if (!price_diff) {
                            if (related_course.course_details && course.course_details) {
                                final_course = related_course;
                                price_diff = Math.abs(related_course.course_details.pricing.sale_price - course.course_details.pricing.sale_price)
                            }

                        }
                    }
                    if (final_course)
                        compares.push({ course_1: course, course_2: final_course })
                }
            }
            await RedisConnection.set(cacheKey, compares);
            RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_COURSE_RECOMMENDATION); 

            compares = await paginate(compares, page, limit)
            let response = { "success": true, message: "list fetched successfully", data: { list: compares }  };
            return response;

        } catch (error) {
            console.log("Error while processing data for Popular comparison", error);
            let response = { success: false, message: "failed to fetch", data: { list: [] } };

            return response;
        }


    }


    
    async getPopularProviders(req) {
        let { subType = "Populer" } = req.query; // Populer, Trending
        let { category, program, region, page = 1, limit = 20 } = req.query;

        const offset = (page - 1) * limit

        let providers = [];
        try {
            let cacheKey = `popular-providers-${subType}-${category || ''}-${program || ''}-${region || ''}-${page}-${limit}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            if (cachedData.noCacheData != true) {
                providers = cachedData;
            } else {

                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "approved" } }
                        ]
                    }
                }
                if (category) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "categories.keyword": decodeURIComponent(category)
                            }
                        }
                    );
                }
                if (program) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "programs.keyword": decodeURIComponent(program)
                            }
                        }
                    );
                }
                if (region) {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "region.keyword": decodeURIComponent(region)
                            }
                        }
                    );
                }

                let sort = null
                switch (subType) {
                    case "Trending":
                        sort = [{ "activity_count.last_x_days.trending_score": "desc" }]
                        break;
                    default:
                        sort = [{ "activity_count.all_time.popularity_score": "desc" }]
                        break;
                }
                
                let result = await elasticService.search("provider", esQuery, { from: offset, size: limit, sortObject: sort });

                if (result.hits) {
                    for (const hit of result.hits) {
                        var data = await this.generateproviderFinalResponse(hit._source)
                        providers.push(data);
                    }
                    await RedisConnection.set(cacheKey, providers);
                    RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_ARTICLE_RECOMMENDATION); 

                }
            }
            let response = { success: true, message: "list fetched successfully", data: { list: providers, mlList: [], show: "logic" } };
            return response;


        } catch (error) {
            console.log("Error while processing data for popular providers", error);
            let response = { success: false, message: "Failed to fetch", data: { list: [] } };
            return response;
        }
    }

    async generateproviderFinalResponse(result) {
        let data = {
            title: result.name,
            slug: result.slug,
            id: `PVDR_${result.id}`,
            cover_image: (result.cover_image) ? formatImageResponse(result.cover_image) : null,
            card_image:(result.card_image)? formatImageResponse(result.card_image) : ((result.cover_image)? formatImageResponse(result.cover_image) : null),
            card_image_mobile:(result.card_image_mobile)? formatImageResponse(result.card_image_mobile) : ((result.cover_image)? formatImageResponse(result.cover_image) : null),
            study_modes: (result.study_modes) ? result.study_modes : [],           
            contact_details: {
                address_line1: result.address_line1,
                address_line2: result.address_line2,
                city: result.city,
                state: result.state,
                pincode: result.pincode,
                country: result.country,
                phone: result.phone,
                email: result.email,
                website_link: result.website_link
            },
            course_count: (result.course_count) ? result.course_count : 0,
            featured_ranks: [],
            ratings:{}
        };
        if (result.reviews && result.reviews.length > 0) {
            let totalRating = 0;
            let ratings = {};
            for (let review of result.reviews) {
                totalRating += review.rating;
                if (ratings[review.rating]) {
                    ratings[review.rating] += 1;
                } else {
                    ratings[review.rating] = 1;
                }
            }
            const average_rating = totalRating / result.reviews.length;
            data.ratings.average_rating = round(average_rating, 0.5);
            data.ratings.average_rating_actual = average_rating.toFixed(1);            
        }

        return data;
    }

    async getRankingImages(skipCache = false) 
    {
        let ranking_images = {}
        let cacheName = `ranking_images`
        let useCache = false
        if(skipCache !=true) {    
            let cacheData = await RedisConnection.getValuesSync(cacheName);
            if(cacheData.noCacheData != true) {
                ranking_images =  cacheData   
                useCache = true				 
            }
        }
              
        if(useCache !=true)
        {
            let response = await fetch(`${apiBackendUrl}/rankings`);
            if (response.ok) {
                let json = await response.json();
                if(json){
                    for(let ranking of json)
                    {
                        ranking_images[ranking.name] = {}
                        if( ranking.image){
                            ranking_images[ranking.name]['iamge'] = formatImageResponse(ranking.image)
                        } 
                        if( ranking.logo){
                            ranking_images[ranking.name]['logo'] = formatImageResponse(ranking.logo)
                        }                    
                    }
                    await RedisConnection.set(cacheName,  ranking_images);
                }
            }
        }
        return ranking_images
    }


    async lgCourseRecommendationForTechinicalSkill(req) {        
        let { articleId, currency = process.env.DEFAULT_CURRENCY,skill,  region, noRegion, page = 1, limit = 12 } = req.query;
        let category,sub_category,topic
        const offset = (page - 1) * limit

        let courses = [];
        try {
            let cacheKey = `lg-Techinical-Skill-courses-${articleId}-${skill || 'skill'}-${region || 'region'}--${noRegion || 'noRegion'}-${page}-${limit}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            if (cachedData.noCacheData != true) {
                courses = cachedData;
                courses = await getlistPriceFromEcom(courses,"learn_content",req.query['country'])
            } else {

                // Find category /sub-category or topic to which lg belogs to
                let esQuery = {
                    "ids": {
                        "values": articleId
                    }
                };
               
                let result = await elasticService.search('article', esQuery,{_source: ['categories','article_sub_categories','article_topics']});
                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        category =  hit._source.categories;
                        sub_category =  hit._source.article_sub_categories;
                        topic =  hit._source.article_topics;
                    }
                }

               

                esQuery = {
                    "bool": {
                        "must": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }
                if (category) {
                    esQuery.bool.must.push(
                        {
                            "term": {
                                "categories.keyword": category
                            }
                        }
                    );
                }
                if (sub_category) {
                    esQuery.bool.must.push(
                        {
                            "term": {
                                "sub_categories.keyword": sub_category
                            }
                        }
                    );
                }
                if (topic) {
                    esQuery.bool.must.push(
                        {
                            "term": {
                                "topics.keyword": topic
                            }
                        }
                    );
                }

                if (region) {
                    esQuery.bool.must.push(
                        {
                            "term": {
                                "regions.keyword": region
                            }
                        }
                    );
                }

                if (noRegion) {
                    esQuery.bool.must.push(
                        {
                            "bool": {
                              "must_not": [
                                {
                                  "term": {                                   
                                      "regions.keyword": noRegion
                                   
                                  }
                                }
                              ]
                            }
                          }
                    );
                }

                esQuery.bool.must.push(
                    {
                        "term": {
                            "skills.keyword": skill,

                        }
                    }
                );               
               
               
                let sort = [{ "activity_count.all_time.popularity_score": "desc" }, { "ratings": "desc" }]
                sort = null
              
                result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject: sort ,_source: courseFields});
               
                if (result.hits) {
                    result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                    for (const hit of result.hits) {
                        var data = await this.generateCourseFinalResponse(hit._source, currency)
                        courses.push(data);
                    }
                    await RedisConnection.set(cacheKey, courses);
                    RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_COURSE_RECOMMENDATION); 
                }
            }
            let response = { success: true, message: "list fetched successfully", data: { list: courses, mlList: [], show: "logic" } };            
            return response;
           

        } catch (error) {
            console.log("Error while processing data for lgCourseRecommendationForTechinicalSkill courses", error);
            let response = { success: false, message: "Failed to fetch", data: { list:[]} };            
            return response;
        }
    }

    async lgHowToLearncourses(req) {        
        let { articleId, currency = process.env.DEFAULT_CURRENCY, level, learnType,  region, noRegion, priceType ="Paid", page = 1, limit = 12 } = req.query;
        let category,sub_category,topic
        let skills = []
        const offset = (page - 1) * limit
        let courses = [];
        try {
            let cacheKey = `lg-how-to-learn-courses-${articleId}-${level || 'level'}--${learnType || 'learnType'}--${priceType || 'priceType'}-${region || 'region'}--${noRegion || 'noRegion'}-${page}-${limit}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            if (cachedData.noCacheData != true) {
                courses = cachedData;
                courses = await getlistPriceFromEcom(courses,"learn_content",req.query['country'])

            } else {

                // Find category /sub-category or topic to which lg belogs to
                let esQuery = {
                    "ids": {
                        "values": articleId
                    }
                };
               
                let result = await elasticService.search('article', esQuery,{_source: ['categories','article_sub_categories','article_topics', 'technical_skills_advanced_skills','technical_skills_beginner_skills','technical_skills_intermediate_skills']});
                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        category =  hit._source.categories;
                        sub_category =  hit._source.article_sub_categories;
                        topic =  hit._source.article_topics;                        
                        if(level == 'Beginner' || !level)
                        {
                            hit._source.technical_skills_beginner_skills.map(skill=>skills.push(skill.default_display_label))
                        }
                        if(level == 'Intermediate' || !level)
                        {
                            hit._source.technical_skills_intermediate_skills.map(skill=>skills.push(skill.default_display_label))
                        }
                        if(level == 'Advanced' || !level)
                        {
                            hit._source.technical_skills_advanced_skills.map(skill=>skills.push(skill.default_display_label))
                        }
                    }
                }               

                esQuery = {
                    "bool": {
                        "must": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }
                if (category) {
                    esQuery.bool.must.push(
                        {
                            "term": {
                                "categories.keyword": category
                            }
                        }
                    );
                }
                if (sub_category) {
                    esQuery.bool.must.push(
                        {
                            "term": {
                                "sub_categories.keyword": sub_category
                            }
                        }
                    );
                }
                if (topic) {
                    esQuery.bool.must.push(
                        {
                            "term": {
                                "topics.keyword": topic
                            }
                        }
                    );
                }
                if (level) {
                    esQuery.bool.must.push(
                        {
                            "term": {
                                "level.keyword": level
                            }
                        }
                    );
                }
                if (learnType) {
                    esQuery.bool.must.push(
                        {
                            "term": {
                                "learn_type.keyword": learnType
                            }
                        }
                    );
                }
                if (skills) {
                    esQuery.bool.must.push(
                        {
                            "terms": {
                                "skills.keyword": skills
                            }
                        }
                    );
                }
                
                if (region) {
                    esQuery.bool.must.push(
                        {
                            "term": {
                                "regions.keyword": region
                            }
                        }
                    );
                }

                if (noRegion) {
                    esQuery.bool.must.push(
                        {
                            "bool": {
                              "must_not": [
                                {
                                  "term": {                                   
                                      "regions.keyword": noRegion
                                   
                                  }
                                }
                              ]
                            }
                          }
                    );
                }
               
                if (priceType && priceType == "Free") {
                    esQuery.bool.must.push(
                        { "term": { "pricing_type.keyword": "Free" } }
                    ); 
                }
                if (priceType && priceType == "Paid") {
                    esQuery.bool.must.push(
                        { "term": { "pricing_type.keyword": "Paid" } }
                    );
                }
                let sort = [{ "activity_count.all_time.popularity_score": "desc" }, { "ratings": "desc" }]
   
                result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject: sort ,_source: courseFields});
               
                if (result.hits) {
                    result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                    for (const hit of result.hits) {
                        var data = await this.generateCourseFinalResponse(hit._source, currency)
                        courses.push(data);
                    }
                    await RedisConnection.set(cacheKey, courses);
                    RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_COURSE_RECOMMENDATION); 
                }
            }
            let response = { success: true, message: "list fetched successfully", data: { list: courses, mlList: [], show: "logic" } };            
            return response;
           

        } catch (error) {
            console.log("Error while processing data for lgHowToLearncourses", error);
            let response = { success: false, message: "Failed to fetch", data: { list:[]} };            
            return response;
        }
    }

    async cgCoursesWithPlacement(req) {        
        let { articleId, currency = process.env.DEFAULT_CURRENCY,  region, noRegion, page = 1, limit = 12 } = req.query;
        let categories,sub_categories,topics
        let level = []
        const offset = (page - 1) * limit
        let courses = [];
        try {
            let cacheKey = `cg-courses-with-Placement-${articleId}-${region || 'region'}--${noRegion || 'noRegion'}--${page}-${limit}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            if (cachedData.noCacheData != true) {
                courses = cachedData;
                courses = await getlistPriceFromEcom(courses,"learn_content",req.query['country'])
            } else {

                // Find category /sub-category or topic to which lg belogs to
                let esQuery = {
                    "ids": {
                        "values": articleId
                    }
                };
               
                let result = await elasticService.search('article', esQuery,{_source: ['categories','article_sub_categories','article_topics','levels']});
                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        categories =  hit._source.categories;
                        sub_categories =  hit._source.article_sub_categories;
                        topics =  hit._source.article_topics;                        
                        level =  hit._source.levels
                    }
                }               

                esQuery = {
                    "bool": {
                        "must": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }
                if (categories && categories.length > 0) {
                    esQuery.bool.must.push(
                        {
                            "terms": {
                                "categories.keyword": categories
                            }
                        }
                    );
                }
                if (sub_categories && sub_categories.length > 0) {
                    esQuery.bool.must.push(
                        {
                            "terms": {
                                "sub_categories.keyword": sub_categories
                            }
                        }
                    );
                }
                if (topics && topics.length > 0) {
                    esQuery.bool.must.push(
                        {
                            "terms": {
                                "topics.keyword": topics
                            }
                        }
                    );
                }
                if (level) {
                    esQuery.bool.must.push(
                        {
                            "term": {
                                "level.keyword": level
                            }
                        }
                    );
                }

                if (region) {
                    esQuery.bool.must.push(
                        {
                            "term": {
                                "regions.keyword": region
                            }
                        }
                    );
                }

                if (noRegion) {
                    esQuery.bool.must.push(
                        {
                            "bool": {
                              "must_not": [
                                {
                                  "term": {                                   
                                      "regions.keyword": noRegion
                                   
                                  }
                                }
                              ]
                            }
                          }
                    );
                }
                
                esQuery.bool.must.push(
                    {
                        "term": {
                            "job_assistance": true
                        }
                    }
                );                     

                let sort = [{ "activity_count.all_time.popularity_score": "desc" }, { "ratings": "desc" }]
                   
                result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject: sort ,_source: courseFields});
               
                if (result.hits) {
                    result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                    for (const hit of result.hits) {
                        var data = await this.generateCourseFinalResponse(hit._source, currency)
                        courses.push(data);
                    }
                    await RedisConnection.set(cacheKey, courses);
                    RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_COURSE_RECOMMENDATION);
                }
            }
            let response = { success: true, message: "list fetched successfully", data: { list: courses, mlList: [], show: "logic" } };            
            return response;
           

        } catch (error) {
            console.log("Error while processing data for cgCoursesWithPlacement", error);
            let response = { success: false, message: "Failed to fetch", data: { list:[]} };            
            return response;
        }
    }

    async cgCoursesWithLearnType(req) {        
        let { articleId, currency = process.env.DEFAULT_CURRENCY, learnType,  region, noRegion , page = 1, limit = 12 } = req.query;
        let categories,sub_categories,topics
        let level = []
        const offset = (page - 1) * limit
        let courses = [];
        try {
            let cacheKey = `cg-courses-with-Placement-${articleId}-${region || 'region'}--${noRegion || 'noRegion'}--${learnType || 'learnType'}-${page}-${limit}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            if (cachedData.noCacheData != true) {
                courses = cachedData;
                courses = await getlistPriceFromEcom(courses,"learn_content",req.query['country'])
            } else {

                // Find category /sub-category or topic to which lg belogs to
                let esQuery = {
                    "ids": {
                        "values": articleId
                    }
                };
               
                let result = await elasticService.search('article', esQuery,{_source: ['categories','article_sub_categories','article_topics','levels']});
                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        categories =  hit._source.categories;
                        sub_categories =  hit._source.article_sub_categories;
                        topics =  hit._source.article_topics;                        
                        level =  hit._source.levels
                    }
                }               

                esQuery = {
                    "bool": {
                        "must": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }
                if (categories && categories.length > 0) {
                    esQuery.bool.must.push(
                        {
                            "terms": {
                                "categories.keyword": categories
                            }
                        }
                    );
                }
                if (sub_categories && sub_categories.length > 0) {
                    esQuery.bool.must.push(
                        {
                            "terms": {
                                "sub_categories.keyword": sub_categories
                            }
                        }
                    );
                }
                if (topics && topics.length > 0) {
                    esQuery.bool.must.push(
                        {
                            "terms": {
                                "topics.keyword": topics
                            }
                        }
                    );
                }
               
                
                if (learnType) {
                    esQuery.bool.must.push(
                        {
                            "term": {
                                "learn_type.keyword": learnType
                            }
                        }
                    );
                }
                
                if (region) {
                    esQuery.bool.must.push(
                        {
                            "term": {
                                "regions.keyword": region
                            }
                        }
                    );
                }
                
                if (noRegion) {
                    esQuery.bool.must.push(
                        {
                            "bool": {
                              "must_not": [
                                {
                                  "term": {                                   
                                      "regions.keyword": noRegion
                                   
                                  }
                                }
                              ]
                            }
                          }
                    );
                }

                let sort = [{ "activity_count.all_time.popularity_score": "desc" }, { "ratings": "desc" }]
                   
                result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject: sort ,_source: courseFields});
               
                if (result.hits) {
                    result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                    for (const hit of result.hits) {
                        var data = await this.generateCourseFinalResponse(hit._source, currency)
                        courses.push(data);
                    }
                    await RedisConnection.set(cacheKey, courses);
                    RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_COURSE_RECOMMENDATION);
                }
            }
            let response = { success: true, message: "list fetched successfully", data: { list: courses, mlList: [], show: "logic" } };            
            return response;
           

        } catch (error) {
            console.log("Error while processing data for cgCoursesWithLearnType", error);
            let response = { success: false, message: "Failed to fetch", data: { list:[]} };            
            return response;
        }
    }

    async cgFreeCourses(req) {        
        let { articleId, currency = process.env.DEFAULT_CURRENCY, region, noRegion, page = 1, limit = 12 } = req.query;
        let categories,sub_categories,topics
        let level = []
        const offset = (page - 1) * limit
        let courses = [];
        try {
            let cacheKey = `cg-courses-with-Placement-${articleId}-${region || 'region'}--${noRegion || 'noRegion'}--${page}-${limit}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            if (cachedData.noCacheData != true) {
                courses = cachedData;
                courses = await getlistPriceFromEcom(courses,"learn_content",req.query['country'])
            } else {

                // Find category /sub-category or topic to which lg belogs to
                let esQuery = {
                    "ids": {
                        "values": articleId
                    }
                };
               
                let result = await elasticService.search('article', esQuery,{_source: ['categories','article_sub_categories','article_topics','levels']});
                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        categories =  hit._source.categories;
                        sub_categories =  hit._source.article_sub_categories;
                        topics =  hit._source.article_topics;                        
                        level =  hit._source.levels
                    }
                }               

                esQuery = {
                    "bool": {
                        "must": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }
                if (categories && categories.length > 0) {
                    esQuery.bool.must.push(
                        {
                            "terms": {
                                "categories.keyword": categories
                            }
                        }
                    );
                }
                if (sub_categories && sub_categories.length > 0) {
                    esQuery.bool.must.push(
                        {
                            "terms": {
                                "sub_categories.keyword": sub_categories
                            }
                        }
                    );
                }
                if (topics && topics.length > 0) {
                    esQuery.bool.must.push(
                        {
                            "terms": {
                                "topics.keyword": topics
                            }
                        }
                    );
                }

                if (region) {
                    esQuery.bool.must.push(
                        {
                            "term": {
                                "regions.keyword": region
                            }
                        }
                    );
                }

                if (noRegion) {
                    esQuery.bool.must.push(
                        {
                            "bool": {
                              "must_not": [
                                {
                                  "term": {                                   
                                      "regions.keyword": noRegion
                                   
                                  }
                                }
                              ]
                            }
                          }
                    );
                }

                esQuery.bool.must.push(
                    { "term": { "pricing_type.keyword": "Free" } }                
                );                               

                let sort = [{ "activity_count.all_time.popularity_score": "desc" }, { "ratings": "desc" }]
                  
                result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject: sort ,_source: courseFields});
               
                if (result.hits) {
                    result.hits = await getlistPriceFromEcom(result.hits,"learn_content",req.query['country'])
                    for (const hit of result.hits) {
                        var data = await this.generateCourseFinalResponse(hit._source, currency)
                        courses.push(data);
                    }
                    await RedisConnection.set(cacheKey, courses);
                    RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_COURSE_RECOMMENDATION);
                }
            }
            let response = { success: true, message: "list fetched successfully", data: { list: courses, mlList: [], show: "logic" } };            
            return response;
           

        } catch (error) {
            console.log("Error while processing data for cgFreeCourses", error);
            let response = { success: false, message: "Failed to fetch", data: { list:[]} };            
            return response;
        }
    }


    getUserProfileKeywords = async (userId) => {
        const skillsKeywords = [];
        const workExpKeywords = [];
        const userData = await models.user_topic.findAll({
            where: {
                userId: userId
            },
            include: [
                {
                    model: models.user_skill,
                    attributes: ['skill', 'isPrimary']
                }
            ],
            attributes: ['topic']
    
        })
        // Check if there are any primary(key) skills
        if (userData && userData.length > 0) {
            for (let data of userData) {
                for (let user_skill of data.user_skills) {
                    if (user_skill.isPrimary)
                        skillsKeywords.push(user_skill.skill)
                }
            }
        }
        // else conside normal skills
        if (skillsKeywords.length < 1) {
            if (userData && userData.length > 0) {
                for (let data of userData) {
                    for (let user_skill of data.user_skills) {
                        skillsKeywords.push(user_skill.skill)
                    }
                }
            }
        }
    
        const workExperience = await models.user_experience.findAll({ attributes: ['jobTitle', 'industry'], where: { userId: userId } });
        if (workExperience && workExperience.length > 0) {
            for (let workExp of workExperience) {
                if (workExp.jobTitle) {
                    workExpKeywords.push(workExp.jobTitle);
                }
    
                if (workExp.industry) {
                    workExpKeywords.push(workExp.industry);
                }
            }
        }
    
        return { skillsKeywords: skillsKeywords, workExpKeywords: workExpKeywords };
    
    }
    
    getKeywordsFromUsersGoal = async (userId) => {
        const highPriorityKeywords = [];
        const lowPriorityKeywords = [];
        const goals = await models.goal.findAll({ where: { userId: userId } });
        for (const goal of goals) {
    
            if (goal.currentRole) highPriorityKeywords.push(goal.currentRole);
            if (goal.preferredRole) highPriorityKeywords.push(goal.preferredRole);
            if (goal.industryChoice) highPriorityKeywords.push(goal.industryChoice);
    
            if (goal.highestDegree) lowPriorityKeywords.push(goal.highestDegree);
            if (goal.specialization) lowPriorityKeywords.push(goal.specialization);
    
            const goalSkills = await models.skill.findAll({ where: { goalId: goal.id } });
            goalSkills.forEach((goalSkill) => {
                if (goalSkill.name) highPriorityKeywords.push(goalSkill.name)
            });
    
        };
    
        return { highPriorityKeywords: highPriorityKeywords, lowPriorityKeywords: lowPriorityKeywords };
    
    }    
}