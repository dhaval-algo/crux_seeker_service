const elasticService = require("./elasticService");
const models = require("../../../models");
const fetch = require("node-fetch");
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();
const mLService = require("./mLService");
const ArticleService = require("./articleService");
const articleService = new ArticleService();
const userService = require('../../services/v1/users/user');
const apiBackendUrl = process.env.API_BACKEND_URL;
const pluralize = require('pluralize')
const courseFields = ["id","partner_name","total_duration_in_hrs","basePrice","images","total_duration","total_duration_unit","conditional_price","finalPrice","provider_name","partner_slug","partner_url","sale_price","provider_course_url","average_rating_actual","provider_slug","learn_content_pricing_currency","slug","partner_currency","level","pricing_type","medium","title","regular_price","pricing_additional_details","partner_id","ratings","display_price","schedule_of_sale_price","free_condition_description","course_financing_options","activity_count","cv_take"]
const articleFields = ["id","author_first_name","author_last_name","created_by_role","cover_image","slug","author_id","short_description","title","premium","author_slug","co_authors","partners","activity_count"]
const learnPathFields = ["id","title","slug","images","images","total_duration","total_duration_unit","levels","finalPrice","sale_price","average_rating_actual","currency","pricing_type","medium","regular_price","pricing_additional_details","ratings","display_price","courses","activity_count","cv_take"]
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
module.exports = class recommendationService {

    async getRelatedCourses(req) {
        try {
            const courseId = req.query.courseId.toString();
            const { currency, page = 1, limit = 6 } = req.query;
            const offset = (page - 1) * limit;

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

            let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit ,_source: courseFields});

            let courses = [];
            if (result && result.hits.length > 0) {
                for (let hit of result.hits) {
                    let course = await this.generateCourseFinalResponse(hit._source, currency);
                    courses.push(course);
                }
            }

            const mlCourses = await this.getSimilarCoursesML(courseId, currency, page, limit);
            let show = null;
            if (mLService.whetherShowMLCourses("get-similar-courses") && mlCourses && mlCourses.length) {
                show = 'ml';
            }
            else {
                show = 'logic';
            }
            const response = { success: true, message: "list fetched successfully", data:{list:courses,mlList:mlCourses,show:show} };
            
            return response
        } catch (error) {
            console.log("Error while processing data for related courses", error);
            const response = { success: false, message: "list fetched successfully", data:{list:courses,mlList:mlCourses,show:show} };
            
            return response
        }
    }

    async getPopularCourses(req) {
        let { subType } = req.query; // Populer, Trending,Free
        let { category, sub_category, topic, currency = process.env.DEFAULT_CURRENCY, page = 1, limit = 20 } = req.query;

        const offset = (page - 1) * limit

        let courses = [];
        try {
            let cacheKey = `popular-courses-${subType}-${category || ''}-${sub_category || ''}-${topic || ''}-${currency}-${page}-${limit}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            if (cachedData.noCacheData != true) {
                courses = cachedData;
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

                if (subType && subType == "Free") {
                    esQuery.bool.filter.push(
                        { "term": { "pricing_type.keyword": "Free" } }
                    );
                    esQuery.bool.filter.push(
                        { "term": { "display_price": true } }
                    );
                }
                let sort = null
                switch (subType) {
                    case "Trending":
                        sort = [{ "activity_count.last_x_days.course_views": "desc" }, { "ratings": "desc" }]
                        break;
                    default:
                        sort = [{ "activity_count.all_time.course_views": "desc" }, { "ratings": "desc" }]
                        break;
                }

                let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject: sort ,_source: courseFields});

                if (result.hits) {
                    for (const hit of result.hits) {
                        var data = await this.generateCourseFinalResponse(hit._source, currency)
                        courses.push(data);
                    }
                    RedisConnection.set(cacheKey, courses, process.env.CACHE_EXPIRE_POPULAR_CARDS || 60 * 15);
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

    async getSimilarCoursesML(courseId, currency = process.env.DEFAULT_CURRENCY, page = 1, limit = 6) {

        const { result, courseIdSimilarityMap } = await mLService.getSimilarCoursesDataML(courseId);
        let courses = [];
        const offset = (page - 1) * limit;
        if (result && result.length) {
            for (const courseElasticData of result.slice(offset, offset + limit)) {
                const courseData = await this.generateCourseFinalResponse(courseElasticData._source, currency);                
                optimisedCourse.similarity = courseIdSimilarityMap[courseData.id];
                courses.push(courseData);
            }
        }
        return courses;

    }

    async exploreCoursesFromTopCatgeories(req) {

        try {
            req.query.subType = "Popular"
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
            const { category, sub_category, topic, currency = process.env.DEFAULT_CURRENCY, page = 1, limit = 6 } = req.query;
            const { skillsKeywords = [], workExpKeywords = [] } = await userService.getUserProfileKeywords(userId);

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
            if (skillsKeywords.length) {
                const offset = (page - 1) * limitForSkills;
                esQuery.bool.should[0].query_string.query = skillsKeywords.join(" OR ");
                const result = await elasticService.search("learn-content", esQuery, { from: offset, size: limitForSkills ,_source: courseFields});
                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        const data = await this.generateCourseFinalResponse(hit._source, currency)
                        courses.push(data);
                    }
                }
            }

            if (workExpKeywords.length) {
                const offset = (page - 1) * limitForWorkExp;
                esQuery.bool.should[0].query_string.query = workExpKeywords.join(" OR ");
                const result = await elasticService.search("learn-content", esQuery, { from: offset, size: limitForWorkExp ,_source: courseFields});
                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        const data = await this.generateCourseFinalResponse(hit._source, currency)
                        courses.push(data);
                    }
                }
            }

            if (!skillsKeywords.length && !workExpKeywords.length) {
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
            const { limit = 5, page = 1, order = "DESC" } = req.query;
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
            await userService.getUserLastSearch(req, (result) => {
                searchedArticles.push(...result.data['article']);

            });

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
            const { page = 1, limit = 6 } = req.query;
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

                const sort = [{ "activity_count.all_time.article_views": "desc" }];
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
        const { skillsKeywords = [], workExpKeywords = [] } = await userService.getUserProfileKeywords(userId);
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
        const { highPriorityKeywords, lowPriorityKeywords } = await userService.getKeywordsFromUsersGoal(userId);
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
            let { category, sub_category, topic, section} = req.query; 
            let featured_articles = []
            let articles = []
            let maxArticles = 2;
            let cacheKey = `Featured_Articles-${pageType}-${category || ''}-${sub_category || ''}-${topic || ''}-${section || ''}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);
            if (cachedData.noCacheData != true) {
                articles = cachedData;
                return { "success": true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };
            }

            // fetch featured article if manually added from strapi
            switch (pageType) {
                case "homePage":
                case "AdvicePage":              
                        const query = {
                        "match_all": {}
                        };                
                    const result = await elasticService.search('blog_home_page', query, {from: 0, size: 1000,_source:["featured_articles"]})
                    if (result.hits && result.hits.length) {
                    featured_articles =result.hits[0]._source.featured_articles                
                    }
                    maxArticles = 1
                    break;
                case "categoryPage":
                    let categoryResponse = await fetch(`${apiBackendUrl}/categories?default_display_label=${category}`);
                    if (categoryResponse.ok) {
                        let json = await categoryResponse.json();
                        
                        if(json && json.length > 0 && json[0].featured_articles && json[0].featured_articles.length > 0){
                            json[0].featured_articles.map(article => featured_articles.push(article.id))                        
                        }
                    }
                    break
                case "subCategoryPage":
                    let subCategoryResponse = await fetch(`${apiBackendUrl}/sub-categories?default_display_label=${sub_category}`);
                    if (subCategoryResponse.ok) {
                        let json = await subCategoryResponse.json();                    
                        if(json && json.length > 0 && json[0].featured_articles && json[0].featured_articles.length > 0){
                            json[0].featured_articles.map(article => featured_articles.push(article.id))                        
                        }
                    }
                    break
                case "topicPage":
                    let topicResponse = await fetch(`${apiBackendUrl}/topics?default_display_label=${topic}`);
                    if (topicResponse.ok) {
                        let json = await topicResponse.json();
                        if(json && json.length > 0 && json[0].featured_articles && json[0].featured_articles.length > 0){
                            json[0].featured_articles.map(article => featured_articles.push(article.id))                        
                        }
                    }
                    break
                case "learnPathPage":
                    let learnPathResponse = await fetch(`${apiBackendUrl}/learning-path-landing-page`);
                    if (learnPathResponse.ok) {
                        let json = await learnPathResponse.json();
                    
                        if(json && json.featured_articles && json.featured_articles.length > 0){
                            json.featured_articles.map(article => featured_articles.push(article.id))                        
                        }
                    }
                    maxArticles = 1
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
                    {
                    "ids": {
                        "values": featured_articles
                    }
                    }
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
                                "section_name.keyword":"Learn Path"
                            }
                        }
                    );
                }
            
                let sort = [{ "activity_count.last_x_days.article_views": "desc" }]                

                let result = await elasticService.search("article", esQuery, { from: 0, size: (maxArticles - articles.length) , sortObject: sort , _source: articleFields});
            
                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        const data = await this.generateArticleFinalResponse(hit._source)
                        articles.push(data);
                    }
                }
            }
            RedisConnection.set(cacheKey, articles, process.env.CACHE_EXPIRE_FEATURED_ARTICLES || 60 * 15);
            return { "success": true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };
        } catch (error) {
            console.log("Error occured while fetching featured articles", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };
        }
    }


    async getArticleAdvice (req) {
        try {
            let {pageType} = req.query;        
            let { category, sub_category, topic} = req.query; 
            let article_advice = []
            let articles = []
            let maxArticles = 8;
            let cacheKey = `Article_Advice-${pageType}-${category || ''}-${sub_category || ''}-${topic || ''}`;
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
                        
                        if(json && json.length > 0 && json[0].article_advice && json[0].article_advice.length > 0){
                            json[0].article_advice.map(article => article_advice.push(article.id))                        
                        }
                    }
                    break
                case "subCategoryPage":
                    let subCategoryResponse = await fetch(`${apiBackendUrl}/sub-categories?default_display_label=${sub_category}`);
                    if (subCategoryResponse.ok) {
                        let json = await subCategoryResponse.json();                    
                        if(json && json.length > 0 && json[0].article_advice && json[0].article_advice.length > 0){
                            json[0].article_advice.map(article => article_advice.push(article.id))                        
                        }
                    }
                    break
                case "topicPage":
                    let topicResponse = await fetch(`${apiBackendUrl}/topics?default_display_label=${topic}`);
                    if (topicResponse.ok) {
                        let json = await topicResponse.json();
                        if(json && json.length > 0 && json[0].article_advice && json[0].article_advice.length > 0){
                            json[0].article_advice.map(article => article_advice.push(article.id))                        
                        }
                    }
                    break
                case "learnPathPage":
                    let learnPathResponse = await fetch(`${apiBackendUrl}/learning-path-landing-page`);
                    if (learnPathResponse.ok) {
                        let json = await learnPathResponse.json();
                    
                        if(json && json.careervira_advice && json.careervira_advice.length > 0){
                            json.careervira_advice.map(article => article_advice.push(article.id))                        
                        }
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
                esQuery.bool.must = [
                    {
                    "ids": {
                        "values": article_advice
                    }
                    }
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
               
                let sort = [{ "activity_count.last_x_days.article_views": "desc" }]

                if(pageType == "learnPathPage")
                {
                    esQuery.bool.filter.push(
                        {
                            "term": {
                                "section_name.keyword":"Learn Path"
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
            RedisConnection.set(cacheKey, articles, process.env.CACHE_EXPIRE_ARTICLE_ADVICE || 60 * 15);
            return { "success": true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };
        } catch (error) {
            console.log("Error occured while fetching featured articles", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };
        }
    }

    async generateCourseFinalResponse(result, currency=process.env.DEFAULT_CURRENCY){
        let currencies = await getCurrencies();
        const baseCurrency = getBaseCurrency(result);
        let partnerPrice = roundOff(result.finalPrice, 2);   //final price in ES
        let partnerPriceInUserCurrency = parseFloat(getCurrencyAmount(result.finalPrice, currencies, baseCurrency, currency));
        let conversionRate = roundOff((partnerPrice / partnerPriceInUserCurrency), 2);
        let tax = 0.0;
        let canBuy = false;
        if(result.learn_content_pricing_currency && result.learn_content_pricing_currency.iso_code === "INR" && result.pricing_type !="Free") {
            canBuy = true;
            tax = roundOff(0.18 * partnerPrice, 2);
        }
        let data = {
            canBuy: canBuy,
            title: result.title,
            slug: result.slug,
            id: `LRN_CNT_PUB_${result.id}`,
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
            cover_image: (result.images)? result.images :null,
            course_details: {
                //duration: (result.total_duration_in_hrs) ? Math.floor(result.total_duration_in_hrs/duration_divider)+" "+duration_unit : null,
                duration: getDurationText(result.total_duration, result.total_duration_unit),
                total_duration_unit: result.total_duration_unit,  
                level: (result.level) ? result.level : null,
                medium: (result.medium) ? result.medium : null,
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
                    partnerRegularPrice: roundOff(result.regular_price, 2),
                    partnerSalePrice: roundOff(result.sale_price, 2),
                    conversionRate: conversionRate,
                    tax: tax
                },          
            },
            provider_course_url: result.provider_course_url,
            ratings: {
                total_review_count: result.reviews ? result.reviews.length : 0,
                average_rating: 0,
                average_rating_actual: 0,
                rating_distribution: []
            },
            isCvTake:(result.cv_take && result.cv_take.display_cv_take)? true: false
           
        };     
        
        if(data.course_details.medium == 'Others'){
            data.course_details.medium = null;
        }       
        
        if(data.course_details.pricing.pricing_type == 'Others'){
            data.course_details.pricing.pricing_type = null;
        }      
     
        if(result.partner_currency){
            data.provider.currency = result.partner_currency.iso_code;
        }

        const EARN_CONTENT_POPULARITY_SCORE_THRESHOLD = await RedisConnection.getValuesSync("LEARN_CONTENT_POPULARITY_SCORE_THRESHOLD");

        data.isPopular  = false
        if(EARN_CONTENT_POPULARITY_SCORE_THRESHOLD  && result.activity_count && (result.activity_count.all_time.popularity_score > parseInt(EARN_CONTENT_POPULARITY_SCORE_THRESHOLD)))
        {
            data.isPopular  = true
        }

        const LEARN_CONTENT_TRENDING_SCORE_THRESHOLD = await RedisConnection.getValuesSync("LEARN_CONTENT_TRENDING_SCORE_THRESHOLD");
        
        data.isTrending  = false
        if(LEARN_CONTENT_TRENDING_SCORE_THRESHOLD && result.activity_count && (result.activity_count.last_x_days.trending_score > parseInt(LEARN_CONTENT_TRENDING_SCORE_THRESHOLD)))
        {
            data.isTrending  = true
        }

        return data;
    }

    async getAuthor(id){
        let author = null;
        const query = { "bool": {
            "must": [
              {term: { "user_id": id }}
            ]
        }};
        const result = await elasticService.search('author', query, {_source: ['firstname','lastname','slug']});
        if(result.hits && result.hits.length > 0){
            author = await this.generateAuthorData(result.hits[0]._source);
        }
        return author;     
    }

    async generateAuthorData(result){
        let data = {          
            firstname: result.first_name,
            lastname: result.last_name,
            slug: result.slug,
           
        };
        return data;
    }

    async generateArticleFinalResponse(result){
        try{
            let author = null
            if(result.created_by_role=='author')
            {            
                let auth = await this.getAuthor(result.author_id);       
                if(auth){
                    author = [{                        
                        firstname: auth.firstname? auth.firstname.trim():"",
                        lastname: auth.lastname ? auth.lastname.trim():"",                      
                        slug: auth.slug,
                    }];
                }else{
                    author = [{
                        firstname: result.author_first_name.trim(),
                        lastname: result.last_name ? result.author_last_name.trim():"",
                        slug: result.author_slug
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
                    });
                }
            }

            if(result.partners && result.partners.length > 0 )
            {
                const partnerQuery = { 
                    "bool": {
                        "should": [
                        {
                            "match": {
                            "id": {"boost": 2, "query": result.partners[0] }
                            
                            }
                            
                        },
                        {
                            "terms": {
                            "id": result.partners 
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
                        })
                    }
                }
                result.partners = partners
            }                

            let data = {
                title: result.title,
                premium: (result.premium)? result.premium:false,
                slug: result.slug,
                id: `ARTCL_PUB_${result.id}`,          
                cover_image: (result.cover_image)? result.cover_image : null,
                short_description: result.short_description,
                author: (author)? author: [],
                partners: (result.partners)? result.partners : [],
                created_by_role: (result.created_by_role)? result.created_by_role:'author',            
                published_date: result.published_date
            };

            //SET popular and trending keys
            const ARTICLE_POPULARITY_SCORE_THRESHOLD = await RedisConnection.getValuesSync("ARTICLE_POPULARITY_SCORE_THRESHOLD");

            data.isPopular  = false
            if(ARTICLE_POPULARITY_SCORE_THRESHOLD && result.activity_count && (result.activity_count.all_time.popularity_score > parseInt(ARTICLE_POPULARITY_SCORE_THRESHOLD)))
            {
                data.isPopular  = true
            }

            const ARTICLE_TRENDING_SCORE_THRESHOLD = await RedisConnection.getValuesSync("ARTICLE_TRENDING_SCORE_THRESHOLD");
            
            data.isTrending  = false
            if(ARTICLE_TRENDING_SCORE_THRESHOLD && result.activity_count && (result.activity_count.last_x_days.trending_score > parseInt(ARTICLE_TRENDING_SCORE_THRESHOLD)))
            {
                data.isTrending  = true
            }
            return data;
        }
        catch(err){
            console.log("ERROR: ",err)
        }
    }

    async getPopularLearnPaths(req){
        let { subType } = req.params; // Populer, Trending,Free
        let { category, sub_category, topic, currency, page = 1, limit =20} = req.query;  

        let cacheKey = `popular-learn-paths-${subType}-${category || ''}-${sub_category || ''}-${topic || ''}-${currency}-${page}-${limit}`;
            let cachedData = await RedisConnection.getValuesSync(cacheKey);

        if (cachedData.noCacheData != true) {
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
            
            if(subType && subType =="Free"){
                esQuery.bool.filter.push(
                    { "term": { "pricing_type.keyword": "Free" } }
                );
                 esQuery.bool.filter.push(
                    { "term": { "display_price": true } }
                );
            }
            let sort = null
            switch (subType) {                
                case "Trending":
                    sort = [{ "activity_count.last_x_days.learnpath_views" : "desc" },{ "ratings" : "desc" }]
                    break; 
                default:
                    sort = [{ "activity_count.all_time.learnpath_views" : "desc" },{ "ratings" : "desc" }]
                    break;
            }
            
            let result = await elasticService.search("learn-path", esQuery, { from: offset, size: limit, sortObject:sort, _source :learnPathFields});
              
            if(result.hits){
                for(const hit of result.hits){
                    var data = await this.generateLearnPathFinalResponse(hit._source,currency)
                    learnpaths.push(data);
                }
            }
            RedisConnection.set(cacheKey, learnpaths, process.env.CACHE_EXPIRE_POPULAR_LEARN_PATHS || 60 * 15);
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
        const courseId = req.query.courseId.toString();
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
                                "courses.id.keyword": [courseId],
                                "boost":2
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
                                "title.keyword": skills,
                                boost:3
                            }
                        }
                    );
                    esQuery.bool.should.push(
                        {
                            "terms": {
                                "description.keyword": skills,
                                boost:3
                            }
                        }
                    );
                }
            
                let  sort = [{ "activity_count.all_time.learnpath_views": "desc" }]
                
                let result = await elasticService.search("learn-path", esQuery, { from: offset, size: limit, sortObject:sort, _source :learnPathFields});

                if(result.hits){
                    for(const hit of result.hits){
                        var data = await this.generateLearnPathFinalResponse(hit._source,currency)
                        learnpaths.push(data);
                    }
                }
                RedisConnection.set(cacheKey, learnpaths, process.env.CACHE_EXPIRE_POPULAR_LEARN_PATHS || 60 * 15);
            }

            return { success: true, message: "list fetched successfully", data: { list: learnpaths, mlList: [], show: "logic" } };


        } catch (error) {
            console.log("Error while processing data for related learnpath for course", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };

        }
    }

    async getPopularArticles(req) {
        const { subType, category, sub_category, topic, section, page = 1, limit = 6 } = req.query;
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
                    { "term": { "section_name.keyword": section } }
                );

            }
            let sort = null

            switch (subType) {
                case "Trending":
                    sort = [{ "activity_count.last_x_days.article_views": "desc" }];

                    break;

                case "Recently-Added":
                    sort = [{ "published_date": { "order": "desc" } }];
                    break;
                default:
                    sort = [{ "activity_count.all_time.article_views": "desc" }]
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
        let currencies = await getCurrencies();
        let orderedLevels = ["Beginner","Intermediate","Advanced","Ultimate","All Level","Others"]; //TODO. ordering should be sorting while storing in elastic search.
        let data = {
            id: `LRN_PTH_${result.id}`,
            title: result.title,
            slug: result.slug,
            description: result.description,
            cover_images: result.images,
            levels: result.levels ? orderedLevels.filter(value=> result.levels.includes(value)) : [],          
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
            duration: {
                total_duration: result.total_duration,
                total_duration_unit: result.total_duration_unit,
            },
            course_count: result.courses.length,
            isCvTake:(result.cv_take && result.cv_take.display_cv_take)? true: false
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

        //SET popular and trending keys
        const LEARN_PATH_POPULARITY_SCORE_THRESHOLD = await RedisConnection.getValuesSync("LEARN_PATH_POPULARITY_SCORE_THRESHOLD");

        data.isPopular = false
        if (LEARN_PATH_POPULARITY_SCORE_THRESHOLD && result.activity_count && (result.activity_count.all_time.popularity_score > parseInt(LEARN_PATH_POPULARITY_SCORE_THRESHOLD))) {
            data.isPopular = true
        }

        const LEARN_PATH_TRENDING_SCORE_THRESHOLD = await RedisConnection.getValuesSync("LEARN_PATH_TRENDING_SCORE_THRESHOLD");

        data.isTrending = false
        if (LEARN_PATH_TRENDING_SCORE_THRESHOLD && result.activity_count && (result.activity_count.last_x_days.trending_score > parseInt(LEARN_PATH_TRENDING_SCORE_THRESHOLD))) {
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
           
    
            const result = await elasticService.search('learn-content', esQuery, {form: 0, size: 20,_source:courseFields});
    
            if(result.hits){
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
            const result = await elasticService.search("learn-content",esQuery,{from:offset,size:limit, _source: courseFields})
            
            if (result.hits && result.hits.length) {
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
            const { page = 1, limit = 6, currency = process.env.DEFAULT_CURRENCY } = req.query;
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
    
                const sort = [{ "activity_count.all_time.course_views": "desc" }, { "ratings": "desc" }];
                const result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject: sort, _source:courseFields });
    
                if (result.hits && result.hits.length) {
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
            const courseValues = await models.form_submission.findAll({ where: { userId: userId, targetEntityType:"course",formType:"enquiry" } });
            const courseIds = courseValues.map((course) => course.targetEntityId)
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
                        providers.push(hit._source.provider_name)
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
            const result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject: sort, _source: courseFields });
            if (result.hits && result.hits.length) {
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
                        providers.push(hit._source.provider_name)
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
            const result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject: sort, _source: courseFields });
            if (result.hits && result.hits.length) {
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

    async getRelatedArticle(req) {
        try {
            const articleId = req.query.articleId.toString();
            const { page = 1, limit = 6 } = req.query;
            const offset = (page - 1) * limit;
            let articles = [];
            let cacheKey = `Recommendation-For-Article-${articleId}`;
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
                RedisConnection.set(cacheKey, articles, process.env.CACHE_EXPIRE_RELATED_ARTICLE || 60 * 15);
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
        const { page = 1, limit = 6 } = req.query;
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

            
                let  sort = [{ "activity_count.all_time.article_views": "desc" }]
                    

                const result = await elasticService.search("article", esQuery, { from: offset, size: limit, sortObject: sort, _source: articleFields });
                if (result.hits) {
                    for (const hit of result.hits) {
                        const data = await this.generateArticleFinalResponse(hit._source);
                        articles.push(data);
                    }

                }
                RedisConnection.set(cacheKey, articles, process.env.CACHE_EXPIRE_RECOMMENDATION_FOR_ARTICLE || 60 * 15);
            }

            return { success: true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };


        } catch (error) {
            console.log("Error while processing data for popular articles", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };

        }

    }

    async getRecommendationArticlesforCourse(req) {
        const { page = 1, limit = 5 } = req.query;
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
            
                let  sort = [{ "activity_count.all_time.article_views": "desc" }]
                const result = await elasticService.search("article", esQuery, { from: offset, size: limit, sortObject: sort, _source: articleFields });
                if (result.hits) {
                    for (const hit of result.hits) {
                        const data = await this.generateArticleFinalResponse(hit._source);
                        articles.push(data);
                    }

                }
                RedisConnection.set(cacheKey, articles, process.env.CACHE_EXPIRE_RECOMMENDATION_FOR_ARTICLE || 60 * 15);
            }

            return { success: true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };


        } catch (error) {
            console.log("Error while processing data for related articles for course", error);
            return { "success": false, message: "failed to fetch", data: { list: [] } };

        }
    }

    
}