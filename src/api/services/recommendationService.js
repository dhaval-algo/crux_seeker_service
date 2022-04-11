const elasticService = require("./elasticService");
const models = require("../../../models");
const fetch = require("node-fetch");

const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();
const mLService = require("./mLService");
const learnContentService = require("./learnContentService");
let LearnContentService = new learnContentService();
const ArticleService = require("./articleService");
const articleService = new ArticleService();
const userService = require('../../services/v1/users/user');
const apiBackendUrl = process.env.API_BACKEND_URL;

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

            let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit });

            let courses = [];
            if (result && result.hits.length > 0) {
                for (let hit of result.hits) {
                    let course = await LearnContentService.generateSingleViewData(hit._source, false, currency);
                    const { ads_keywords, subtitle, prerequisites, target_students, content, ...optimisedCourse } = course;
                    courses.push(optimisedCourse);
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

    async getPopularCourses(req, callback, returnData) {
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

                let result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject: sort });

                if (result.hits) {
                    for (const hit of result.hits) {
                        var data = await LearnContentService.generateSingleViewData(hit._source, true, currency)
                        courses.push(data);
                    }
                    RedisConnection.set(cacheKey, courses, process.env.CACHE_EXPIRE_POPULAR_CARDS || 60 * 15);
                }
            }
            let response = { success: true, message: "list fetched successfully", data: { list: courses, mlList: [], show: "logic" } };
            if (returnData) {
                return courses;
            }
            else {
                callback(null, response);
            }

        } catch (error) {
            console.log("Error while processing data for popular courses", error);
            callback(error, null);
        }
    }

    async getSimilarCoursesML(courseId, currency = process.env.DEFAULT_CURRENCY, page = 1, limit = 6) {

        const { result, courseIdSimilarityMap } = await mLService.getSimilarCoursesDataML(courseId);
        let courses = [];
        const offset = (page - 1) * limit;
        if (result && result.length) {
            for (const courseElasticData of result.slice(offset, offset + limit)) {
                const courseData = await this.generateSingleViewData(courseElasticData._source, false, currency);
                const { accreditations, ads_keywords, subtitle, prerequisites, target_students, content, meta_information, ...optimisedCourse } = courseData;
                optimisedCourse.similarity = courseIdSimilarityMap[optimisedCourse.id];
                courses.push(optimisedCourse);
            }
        }
        return courses;

    }

    async exploreCoursesFromTopCatgeories(req, callback) {

        try {
            req.query.subType = "Popular"
            const data = await this.getPopularCourses(req, null, true);
            callback(null, { "success": true, message: "list fetched successfully", data: { list: data, mlList: [], show: "logic" } });

        } catch (error) {
            console.log("Error occured while fetching top courses : ", error)
            callback(null, { "success": false, message: "failed to fetch", data: { list: [] } });
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
                        const data = await LearnContentService.generateSingleViewData(hit._source, true, currency)
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
                        const data = await LearnContentService.generateSingleViewData(hit._source, true, currency)
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



    async getRecentlyViewedArticles(req) {

        try {
            const { user } = req;
            const { limit = 5, page = 1, order = "DESC" } = req.query;

            order = order.toUpperCase();
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
                    const data = await articleService.generateSingleViewData(hit._source, true, req);
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
                    const data = await articleService.generateSingleViewData(hit._source, true, req)
                    articles.push(data);
                }
            }


            return { "success": true, message: "list fetched successfully", data: { list: articles, mlList: [], show: "logic" } };

        } catch (error) {
            console.log("Error occured while fetching recently searched articles", error);
            return { "success": false, message: "failed to fetch", data: { list: [] }};

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
                const result = await elasticService.search("article", esQuery, { from: offset, size: limit ,sortObject:sort});
                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        const data = await articleService.generateSingleViewData(hit._source, true, req)
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

    async getFeaturedArticles (req) {
        try {
            let {pageType} = req.query;        
            let { category, sub_category, topic} = req.query; 
            let featured_articles = []
            let articles = []
            let maxArticles = 2;
            let cacheKey = `Featured_Articles-${pageType}-${category || ''}-${sub_category || ''}-${topic || ''}`;
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
                    const result = await elasticService.search('blog_home_page', query, {from: 0, size: 1000})
                    if (result.hits && result.hits.length) {
                    featured_articles =result.hits[0]._source.featured_articles                
                    }
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
                    break
                default:
                    break;
            }                    
        
            // If article is less than 2 fetch from elasticsearch 
            
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

                let result = await elasticService.search("article", esQuery, {});

                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        const data = await articleService.generateSingleViewData(hit._source, true, req)
                        articles.push(data);
                    }
                }
            }

        if(articles && articles.length < maxArticles)
        {      

                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }

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

                let result = await elasticService.search("article", esQuery, { from: 0, size: (maxArticles - articles.length) , sortObject: sort });
            
                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        const data = await articleService.generateSingleViewData(hit._source, true, req)
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

            // fetch featured article if manually added from strapi
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
        
            // If article is less than 2 fetch from elasticsearch 
            
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

                let result = await elasticService.search("article", esQuery, {});

                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        const data = await articleService.generateSingleViewData(hit._source, true, req)
                        articles.push(data);
                    }
                }
            }

        if(articles && articles.length < maxArticles)
        {      

                let esQuery = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "published" } }
                        ]
                    }
                }

                if(articles.length >  0){
                    esQuery.bool.must_not = [
                        {
                        "ids": {
                            "values": article_advice
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

                let fetaured_articles = this.getFeaturedArticles(req)
                if(fetaured_articles.data && fetaured_articles.data.list && fetaured_articles.data.list.length > 0)
                {
                    fetaured_articles = fetaured_articles.map(article => article_advice.push(article.id))
                    esQuery.bool.must_not = [
                        {
                        "ids": {
                            "values": fetaured_articles
                        }
                        }
                    ]
                }
                let sort = [{ "activity_count.last_x_days.article_views": "desc" }]                

                let result = await elasticService.search("article", esQuery, { from: 0, size: (maxArticles - articles.length) , sortObject: sort });
            
                if (result.hits && result.hits.length) {
                    for (const hit of result.hits) {
                        const data = await articleService.generateSingleViewData(hit._source, true, req)
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
}