const elasticService = require("./elasticService");
const helperService = require("../../utils/helper");
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();
const learnContentService = require("./learnContentService");
let LearnContentService = new learnContentService();
const {formatImageResponse} = require('../utils/general');
const {generateMetaInfo} = require("../utils/metaInfo")
module.exports = class trendingListService {
    async getTrendingList(req) {
        try {
            const { pageType, category, sub_category, topic, page = 1, limit = 6 } = req.query;
            let cacheName = `trending-list-${pageType}-${category}-${sub_category}-${topic}-${page}-${limit}`
            const offset = (page - 1) * limit;
            let cacheData = await RedisConnection.getValuesSync(cacheName);
            if (cacheData.noCacheData != true) {
                return { success: true, message: 'Fetched successfully!', data: cacheData }
            } else {



                let query = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "approved" } }
                        ]
                    }
                }

                if (pageType == 'homePage') {
                    query.bool.filter.push({
                        "term": {
                            "homepage": {
                                "value": true
                            }
                        }
                    });
                }
                if (pageType == 'CourseHomePage') {
                    query.bool.filter.push({
                        "term": {
                            "course_landing": {
                                "value": true
                            }
                        }
                    });
                }

                if (category) {
                    query.bool.filter.push({
                        "term": {
                            "list_category.keyword": {
                                "value": category
                            }
                        }
                    });
                }
                else if (sub_category) {
                    query.bool.filter.push({
                        "term": {
                            "list_sub_category.keyword": {
                                "value": sub_category
                            }
                        }
                    });

                }
                else if (topic) {
                    query.bool.filter.push({
                        "term": {
                            "list_topic.keyword": {
                                "value": topic
                            }
                        }
                    });
                }
                let sort = [{ "activity_count.last_x_days.trending_list_views": "desc" }]

                let result = await elasticService.search('trending-list', query, { from: offset, size: limit, sortObject: sort, _source: ["id", "title", "slug", "image", "list_topic", "list_category", "short_description", "region"] });
                if (result.hits && result.hits.length > 0) {
                    let finalData = {
                        list: []
                    }
                    for (let hit of result.hits) {
                        let data = {
                            id: `TRND_LST_${hit._source.id}`,
                            slug: hit._source.slug,
                            region: hit._source.region,
                            category: hit._source.list_category,
                            sub_category: hit._source.list_sub_category,
                            topic: hit._source.list_topic,
                            short_description: hit._source.short_description,
                            image: hit._source.image,
                        }
                        finalData.list.push(data)
                    }
                    RedisConnection.set(cacheName, finalData);
                    RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_TRENDING_LIST || 86400);
                    return { success: true, message: 'Fetched successfully!', data: finalData }
                } else {
                    return { success: false, message: 'No list!', data: null }
                }
            }
        } catch (error) {
            console.log("error fetching trending list", error)
            return { success: false, message: 'Error fetching list!', data: null }
        }

    }

    async getSingleTrendingList(req) {
        try {

            const slug = req.params.slug;
            let cacheName = `single-Trending-list-${slug}_${req.query.currency}`

            let cacheData = await RedisConnection.getValuesSync(cacheName);
            if (cacheData.noCacheData != true) {
                req.body = { trendingListId: cacheData.id }
                this.addActivity(req, (err, data) => { })
                return { success: true, message: 'Fetched successfully!', data: cacheData }
            } else {
                const signle_list = await this.fetchTrendingListBySlug(slug);
                if (signle_list) {
                    let data = {
                        title: signle_list.title,
                        short_description: signle_list.short_description,
                        introduction: signle_list.introduction,
                        category: signle_list.list_category,
                        sub_category: signle_list.list_sub_category,
                        topic: signle_list.list_topic,
                        level: signle_list.level,
                        region: signle_list.region,
                        faq: signle_list.faq,
                        skill: signle_list.skill,
                        price_type: signle_list.price_type,
                        skills_section: (signle_list.skills_section) ? signle_list.skills_section : null,
                        how_to_choose_course: signle_list.how_to_choose_course
                    }
                    if(data.category)
                    {
                        data.list_type = {
                            label: data.category,
                            type:"category",
                            slug: null,
                            source: signle_list.list_type
                        }
                    }else if (data.sub_category)
                    {
                        data.list_type = {
                            label: data.sub_category,
                            type:"sub_category",
                            slug: null,
                            source: signle_list.list_type
                        }
                    }else if (data.topic)
                    {
                        data.list_type = {
                            label: data.topic,
                            type:"topic",
                            slug: null,
                            source: signle_list.list_type
                        }
                    }

                    if (data.skills_section && data.skills_section.skills && data.skills_section.skills.length > 0) {                        
                        data.skills_section.skills = await Promise.all(data.skills_section.skills.map(async (skill, index) => {
                            let skilldetails = await RedisConnection.getValuesSync(`skill_${skill}`);
                            return {
                                label: skill,
                                logo: skilldetails.logo ? formatImageResponse(skilldetails.logo) : null,
                                description: skilldetails.description || null,
                            }
                        })
                        )
                    }
                    data.meta_information = await generateMetaInfo  ('SINGLE_TRENDING_LIST', signle_list);                   
                    await this.getTrendingListCourses (req, async (err, listData) => {
                            if (listData) {                                                     
                                data.course_count = listData.data.pagination.totalCount
                            } else {
                                data.course_count = 0
                            }
                        });   
                    RedisConnection.set(cacheName, data);
                    RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_TRENDING_LIST || 86400);
                    req.body = { trendingListId: data.id }
                    this.addActivity(req, (err, data) => { })
                    return { success: true, message: 'Fetched successfully!', data: data }
                }
                else {
                    let redirectUrl = await helperService.getRedirectUrl(req);
                    if (redirectUrl) {
                        return callback(null, { success: false, redirectUrl: redirectUrl, message: 'Redirect' });
                    }
                    return callback(null, { success: false, message: 'Not found!' });
                }
            }
        } catch (error) {
            console.log("Error fetcing single list====>", error)
            return { success: false, message: 'Error Fetching list!', data: null }
        }
    }

    async getTopLearningplatform(req) {
        try {
            let partner_size = 10
            const slug = req.params.slug;
            let cacheName = `top-learning-platform-${slug}`
            let finalResponse = []

            let cacheData = await RedisConnection.getValuesSync(cacheName);
            if (cacheData.noCacheData != true) {
                return { success: true, message: 'Fetched successfully!', data: cacheData }
            } else {
                const signle_list = await this.fetchTrendingListBySlug(slug);
                if (signle_list) {
                    let query = {
                        "match_all": {}
                    };
                    if (signle_list.list_category) {
                        query = {
                            "term": {
                                "categories.keyword": {
                                    "value": signle_list.list_category
                                }
                            }
                        };
                    }
                    else if (signle_list.list_sub_category) {
                        query = {
                            "term": {
                                "sub_categories.keyword": {
                                    "value": signle_list.list_sub_category
                                }
                            }
                        };

                    }
                    else if (signle_list.list_topic) {
                        query = {
                            "term": {
                                "topics.keyword": {
                                    "value": signle_list.list_topic
                                }
                            }
                        };
                    }

                    const aggs = {
                        "partner_id_count": {
                            "terms": {
                                "field": "partner_id"
                            }
                        }
                    }

                    const payload = {
                        "size": 0,
                        aggs
                    };


                    let result = await elasticService.searchWithAggregate('learn-content', query, payload);

                    if (result.aggregations && result.aggregations.partner_id_count.buckets.length > 0) {
                        result.aggregations.partner_id_count.buckets = result.aggregations.partner_id_count.buckets.slice(0, partner_size)
                        let parter_ids = result.aggregations.partner_id_count.buckets.map(item => item.key)

                        //Get partner info
                        query = {
                            bool: {
                                filter: [{
                                    "terms": {
                                        "id": parter_ids
                                    }
                                }]
                            }
                        };

                        const partnerResult = await elasticService.search("partner", query, { _source: ['id', 'logo', 'name', 'slug'] });
                        
                        let partner_info = {}
                        if (partnerResult.hits && partnerResult.hits.length > 0) {
                            for (let hit of partnerResult.hits) {
                                partner_info[hit._source.id] = {
                                    logo: formatImageResponse(hit._source.logo),
                                    name: hit._source.name,
                                    slug: hit._source.slug,
                                }
                            }
                        }
                        finalResponse =await Promise.all( result.aggregations.partner_id_count.buckets.map(item => {
                            
                            if(typeof (partner_info[item.key]) != 'undefined' && partner_info[item.key])
                            {                                
                                return {
                                    id: item.key,
                                    name: partner_info[item.key].name,
                                    logo: partner_info[item.key].logo,
                                    slug: partner_info[item.key].slug,
                                    course_count: item.doc_count,
                                }
                            }
                            else{
                                return null
                            }
                           
                        }))
                        finalResponse = finalResponse.filter(e =>{ return e != null } )                       
                    }
                    RedisConnection.set(cacheName, finalResponse);
                    RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_TRENDING_LIST || 86400);
                    return { success: true, message: 'Fetched successfully!', data: { list: finalResponse } }
                }
                else {
                    return { success: false, message: "No top learning platforms", data: null }
                }
            }
        } catch (error) {
            console.log("Error fetcing Top learning platform====>", error)
            return { success: false, message: 'Error Fetching list!', data: null }
        }
    }

    async getTrendingListNavigationDropdown(req) {
        try {
            const slug = req.params.slug;
            let cacheName = `trending-list-navigation-dropdown-${slug}`
            let finalResponse = {}

            let cacheData = await RedisConnection.getValuesSync(cacheName);
            if (cacheData.noCacheData != true) {
                return { success: true, message: 'Fetched successfully!', data: cacheData }
            } else {
                const signle_list = await this.fetchTrendingListBySlug(slug);
                if (signle_list) {
                    let query = {
                        "bool": {
                            "filter": [
                                { "term": { "status.keyword": "approved" } }
                            ]
                        }
                    }
                    if (signle_list.list_category) {
                        query.bool.filter.push({
                            "term": {
                                "list_category.keyword": {
                                    "value": signle_list.list_category
                                }
                            }
                        });
                    }
                    else if (signle_list.list_sub_category) {
                        query.bool.filter.push({
                            "term": {
                                "list_sub_category.keyword": {
                                    "value": signle_list.list_sub_category
                                }
                            }
                        });

                    }
                    else if (signle_list.list_topic) {
                        query.bool.filter.push({
                            "term": {
                                "list_topic.keyword": {
                                    "value": signle_list.list_topic
                                }
                            }
                        });
                    }

                    const aggs = {
                        "level_count": {
                            "terms": {
                                "field": "level.keyword"
                            }
                        },
                        "objective_count": {
                            "terms": {
                                "field": "objective.keyword"
                            }
                        },
                        "region_count": {
                            "terms": {
                                "field": "region.keyword"
                            }
                        },
                        "price_type_count": {
                            "terms": {
                                "field": "price_type.keyword"
                            }
                        },
                    }

                    const payload = {
                        "size": 0,
                        aggs
                    };

                    let result = await elasticService.searchWithAggregate('trending-list', query, payload);
                    if (result.aggregations && result.aggregations.level_count.buckets.length > 0) {
                        finalResponse.levels = result.aggregations.level_count.buckets.map(item => item.key)
                    }
                    if (result.aggregations && result.aggregations.objective_count.buckets.length > 0) {
                        finalResponse.objectives = result.aggregations.objective_count.buckets.map(item => item.key)
                    }
                    if (result.aggregations && result.aggregations.region_count.buckets.length > 0) {
                        finalResponse.regions = result.aggregations.region_count.buckets.map(item => item.key)
                    }
                    if (result.aggregations && result.aggregations.price_type_count.buckets.length > 0) {
                        finalResponse.price_types = result.aggregations.price_type_count.buckets.map(item => item.key)
                    }
                    RedisConnection.set(cacheName, finalResponse);
                    RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_TRENDING_LIST || 86400);
                    return { success: true, message: 'Fetched successfully!', data: finalResponse }
                }
                else {
                    return { success: false, message: "No variations", data: null }
                }
            }
        } catch (error) {
            console.log("Error fetcing trending list naviagtion dropdown====>", error)
            return { success: false, message: 'Error Fetching naviagtion dropdown!', data: null }
        }
    }

    async navigateToTrendingList(req) {
        try {
            const { category, sub_category, topic, level, objective, region, price_type } = req.query;
            let cacheName = `navigate-to-trending-list-${category}-${sub_category}-${topic}-${level}-${objective}-${region}-${price_type}`
            let finalResponse = {}

            let cacheData = await RedisConnection.getValuesSync(cacheName);
            if (cacheData.noCacheData != true) {
                return { success: true, message: 'Fetched successfully!', data: cacheData }
            } else {
                let query = {
                    "bool": {
                        "filter": [
                            { "term": { "status.keyword": "approved" } }
                        ]
                    }
                }
                if (category) {
                    query.bool.filter.push({
                        "term": {
                            "list_category.keyword": {
                                "value": category
                            }
                        }
                    });
                }
                else if (sub_category) {
                    query.bool.filter.push({
                        "term": {
                            "list_sub_category.keyword": {
                                "value": sub_category
                            }
                        }
                    });

                }
                else if (topic) {
                    query.bool.filter.push({
                        "term": {
                            "list_topic.keyword": {
                                "value": topic
                            }
                        }
                    });
                }

                if (level) {
                    query.bool.filter.push({
                        "term": {
                            "level.keyword": {
                                "value": level
                            }
                        }
                    });
                }
                if (objective) {
                    query.bool.filter.push({
                        "term": {
                            "objective.keyword": {
                                "value": objective
                            }
                        }
                    });
                }
                if (region) {
                    query.bool.filter.push({
                        "term": {
                            "region.keyword": {
                                "value": region
                            }
                        }
                    });
                }
                if (price_type) {
                    query.bool.filter.push({
                        "term": {
                            "price_type.keyword": {
                                "value": price_type
                            }
                        }
                    });
                }

                let result = await elasticService.search('trending-list', query);
                if (result.hits && result.hits.length > 0) {
                    let finalData = { slug: result.hits[0]._source.slug }
                    RedisConnection.set(cacheName, finalData);
                    RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_TRENDING_LIST || 86400);
                    return { success: true, message: 'Fetched successfully!', data: finalData }
                } else {
                    return { success: false, message: 'No list found!', data: null }
                }
            }


        } catch (error) {
            console.log("Error navigating trending list ====>", error)
            return { success: false, message: 'Error Fetching list!', data: null }
        }
    }

    async fetchTrendingListBySlug(slug) {
        let cacheName = `trending-list-by-slug-${slug}`

        let cacheData = await RedisConnection.getValuesSync(cacheName);
        if (cacheData.noCacheData != true) {
            return { success: true, message: 'Fetched successfully!', data: cacheData }
        } else {
            const query = {
                "bool": {
                    "must": [
                        { term: { "slug.keyword": slug } },
                        { terms: { "status.keyword": ['approved'] } }
                    ]
                }
            };

            let result = await elasticService.search('trending-list', query);
            if (result.hits && result.hits.length > 0) {
                RedisConnection.set(cacheName, result.hits[0]._source);
                RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_TRENDING_LIST || 86400);
                return result.hits[0]._source;
            } else {
                return null;
            }
        }
    }

    async getTrendingListCourses(req, callback) {
        try {
            const slug = req.params.slug;
            let currency = (req.query.currency) ? req.query.currency : 'USD'
            let cacheName = `trending-list-courses-${slug}_${req.query.currency}`

            let cacheData = await RedisConnection.getValuesSync(cacheName);
            if (cacheData.noCacheData != true) {
                return callback(null, { success: true, message: 'Fetched successfully!', data: cacheData })
            } else {
                const signle_list = await this.fetchTrendingListBySlug(slug);
                if (signle_list.list_type == 'Manual') {
                    let courseIds = signle_list.manual_courses.map(course => course.id)
                    req.query.courseIds = courseIds.join(',')
                    await LearnContentService.getLearnContentList(req, (error, data) => {
                        if (data) {
                            return callback(null, { success: true, message: 'Fetched successfully!', data: { list: data.data.list ,pagination: data.data.pagination, sort: data.data.sort, sortOptions: data.data.sortObject} })
                        }
                        else {
                            return callback(null, { success: false, message: 'Error Fetching list!', data: null })
                        }
                    })

                }
                else {

                    // create parse filter object for creating automated list
                    let parsedFilters = []
                    if (signle_list.filters_categories && signle_list.filters_categories.length > 0) {
                        parsedFilters.push({
                            key: 'Category',
                            value: signle_list.filters_categories
                        })
                    }
                    if (signle_list.filters_sub_categories && signle_list.filters_sub_categories.length > 0) {
                        parsedFilters.push({
                            key: 'Sub category',
                            value: signle_list.filters_sub_categories
                        })
                    }
                    if (signle_list.filters_topics && signle_list.filters_topics.length > 0) {
                        parsedFilters.push({
                            key: 'Topic',
                            value: signle_list.filters_topics
                        })
                    }
                    if (signle_list.filters_mediums && signle_list.filters_mediums.length > 0) {
                        parsedFilters.push({
                            key: 'Delivery Method',
                            value: signle_list.filters_mediums
                        })
                    }
                    if (signle_list.filters_level) {
                        parsedFilters.push({
                            key: 'Level',
                            value: [signle_list.filters_level]
                        })
                    }
                    if (signle_list.filters_learn_types && signle_list.filters_learn_types.length > 0) {
                        parsedFilters.push({
                            key: 'Learn Type',
                            value: signle_list.filters_learn_types
                        })
                    }
                    if (signle_list.filters_region) {
                        parsedFilters.push({
                            key: 'Region',
                            value: [signle_list.filters_region]
                        })
                    }
                    if (signle_list.filters_partners && signle_list.filters_partners.length > 0) {
                        parsedFilters.push({
                            key: 'Partner',
                            value: signle_list.filters_partners.map(partner => partner.name)
                        })
                    }
                    if (signle_list.filters_providers && signle_list.filters_providers.length > 0) {
                        parsedFilters.push({
                            key: 'Institute',
                            value: signle_list.filters_providers.map(provider => provider.name)
                        })
                    }
                    if (signle_list.filters_instruction_types && signle_list.filters_instruction_types.length > 0) {
                        parsedFilters.push({
                            key: 'Instruction Type',
                            value: signle_list.filters_instruction_types
                        })
                    }
                    if (signle_list.filters_languages && signle_list.filters_languages.length > 0) {
                        parsedFilters.push({
                            key: 'Language',
                            value: signle_list.filters_languages
                        })
                    }

                    if (signle_list.filters_price_type) {
                        parsedFilters.push({
                            key: 'Price Type',
                            value: [signle_list.filters_price_type]
                        })
                    }


                    req.query.parsedFilters = parsedFilters
                    let parsedFiltersKeys = parsedFilters.map(parsedFilter => parsedFilter.key)
                    await LearnContentService.getLearnContentList(req, (error, data) => {
                        if (data) {
                            let filters = data.data.filters.filter(filter => {
                                if (parsedFiltersKeys.includes(filter.label)) {
                                    return true
                                }
                                else {
                                    return false
                                }
                            })

                            //generate synposys data
                            let self_paced = 0
                            let instructor_paced = 0
                            let capstone_project = 0
                            let virtual_labs = 0
                            let case_based_learning = 0
                            let less_than_week = 0
                            let more_than_month = 0
                            let free = 0
                            let low_price = 0
                            let medium_price = 0
                            let high_price = 0

                            if (data.data.trending_list_synopsys_aggregation.instruction_type.buckets && data.data.trending_list_synopsys_aggregation.instruction_type.buckets.length > 0) {
                                for (let item of data.data.trending_list_synopsys_aggregation.instruction_type.buckets) {
                                    if (item.key == 'Self Paced') {
                                        self_paced = Math.round((item.doc_count / data.data.pagination.totalCount) * 100)
                                    }
                                    if (item.key == 'Instructor Paced') {
                                        instructor_paced = Math.round((item.doc_count / data.data.pagination.totalCount) * 100)
                                    }
                                }
                            }
                            if (data.data.trending_list_synopsys_aggregation.capstone_project && data.data.trending_list_synopsys_aggregation.capstone_project.buckets.length > 0) {
                                for (let item of data.data.trending_list_synopsys_aggregation.capstone_project.buckets) {
                                    if (item.key == 1) {
                                        capstone_project = Math.round((item.doc_count / data.data.pagination.totalCount) * 100)
                                    }

                                }
                            }
                            if (data.data.trending_list_synopsys_aggregation.virtual_labs && data.data.trending_list_synopsys_aggregation.virtual_labs.buckets.length > 0) {
                                for (let item of data.data.trending_list_synopsys_aggregation.virtual_labs.buckets) {
                                    if (item.key == 1) {
                                        virtual_labs = Math.round((item.doc_count / data.data.pagination.totalCount) * 100)
                                    }

                                }
                            }
                            if (data.data.trending_list_synopsys_aggregation.case_based_learning && data.data.trending_list_synopsys_aggregation.case_based_learning.buckets.length > 0) {
                                for (let item of data.data.trending_list_synopsys_aggregation.case_based_learning.buckets) {
                                    if (item.key == 1) {
                                        case_based_learning = Math.round((item.doc_count / data.data.pagination.totalCount) * 100)
                                    }

                                }
                            }
                            if (data.data.trending_list_synopsys_aggregation.duration && data.data.trending_list_synopsys_aggregation.duration.buckets.length > 0) {
                                for (let item of data.data.trending_list_synopsys_aggregation.duration.buckets) {
                                    if (item.key == "*-56.0") {
                                        less_than_week = item.doc_count
                                    }
                                    if (item.key == "255.0-*") {
                                        more_than_month = item.doc_count
                                    }

                                }
                            }
                            if (data.data.trending_list_synopsys_aggregation.price_type && data.data.trending_list_synopsys_aggregation.price_type.buckets.length > 0) {
                                for (let item of data.data.trending_list_synopsys_aggregation.price_type.buckets) {
                                    if (item.key == "Free") {
                                        free = item.doc_count
                                    }

                                }
                            }
                            if (data.data.trending_list_synopsys_aggregation.price_range && data.data.trending_list_synopsys_aggregation.price_range.buckets.length > 0) {
                                for (let item of data.data.trending_list_synopsys_aggregation.price_range.buckets) {
                                    if (item.key == "*-13.0") {
                                        low_price = item.doc_count
                                    }
                                    if (item.key == "*13.0-130.0") {
                                        medium_price = item.doc_count
                                    }
                                    if (item.key == "130.0-*") {
                                        high_price = item.doc_count
                                    }

                                }
                            }


                            let synopsis = {
                                type1:
                                    [
                                        {
                                            label: "Course Count",
                                            stats: data.data.pagination.totalCount || 0
                                        },
                                        {
                                            label: "Topic Count",
                                            stats: data.data.trending_list_synopsys_aggregation.topics.buckets.length || 0
                                        },
                                        {
                                            label: "Partner Count",
                                            stats: data.data.trending_list_synopsys_aggregation.partner.buckets.length || 0
                                        },
                                        {
                                            label: "Self paced",
                                            stats: `${self_paced}%` || `0%`
                                        },

                                        {
                                            label: "Instructor Led",
                                            stats: `${instructor_paced}%` || `0%`
                                        },
                                        {
                                            label: "Capstone Project",
                                            stats: `${capstone_project}%` || `0%`
                                        },
                                        {
                                            label: "Capstone Project",
                                            stats: `${capstone_project}%` || `0%`
                                        },
                                        {
                                            label: "virtual Labs",
                                            stats: `${virtual_labs}%` || `0%`
                                        },
                                        {
                                            label: "Case Based Study",
                                            stats: `${case_based_learning}%` || `0%`
                                        },
                                    ]
                            }
                            if (self_paced > 50) {
                                synopsis.type2 = [{
                                    label: "Learn Type",
                                    stats: `${self_paced}%`,
                                    statement: `Over ${self_paced}p% of the courses offer self-paced learning, while the rest offer instructor-led classes.`
                                }]
                            }
                            else if (instructor_paced > 50) {
                                synopsis.type2 = [{
                                    label: "Learn Type",
                                    stats: `${instructor_paced}%`,
                                    statement: `Although some courses are self-paced, ${instructor_paced}% of the courses are instructor-paced at this level.`
                                }]
                            }
                            else {
                                synopsis.type2 = [{
                                    label: "Learn Type",
                                    stats: `${self_paced}%`,
                                    statement: `${self_paced}% is the percentage of self based courses and ${instructor_paced}% is the percentage of instructor paced courses.`
                                }]
                            }

                            synopsis.type2.push({
                                label: "Course Summary",
                                stats: data.data.pagination.totalCount,
                                statement: `We offer ${data.data.pagination.totalCount} courses ranging from online to offline, self-paced and instructor-paced, in collaboration with top leading course providers.`
                            })
                            synopsis.type3 = []
                            if (case_based_learning > 0) {
                                synopsis.type3.push({
                                    label: "Case Based Learning",
                                    statement: [`More than ${case_based_learning}% of the courses incorporate case-based learning as a part of their curriculum, which is useful in encouraging them to research and reflect on solutions to real-life problems.`]
                                })
                            }
                            if (capstone_project > 0) {
                                synopsis.type3.push({
                                    label: "Capstone Project",
                                    statement: [`Around ${capstone_project}% of the courses require submission of Capstone Projects, which are projects learners must submit at the end of the course.`]
                                })
                            }

                            if (virtual_labs > 0) {
                                if (capstone_project == 0 && case_based_learning == 0) {
                                    synopsis.type3.push({
                                        label: "Virtual Labs",
                                        statement: [`There are ${virtual_labs}% of courses that give the student the convenience of virtual labs, advancing their knowledge of the subject and bringing their knowledge into practicality through a series of experiments.`]
                                    })
                                }
                                else {
                                    synopsis.type3.push({
                                        label: "Virtual Labs",
                                        statement: [`Moreover, ${virtual_labs}% of courses provide learners with hands-on experience through virtual labs, advancing their knowledge of the subject.`]
                                    })
                                }
                            }

                            if (less_than_week > 0 || more_than_month > 0) {
                                synopsis.type3.push({
                                    label: "Duration Band",
                                    statement: []
                                })

                                if (less_than_week > 0) {
                                    synopsis.type3[synopsis.type3.length - 1].statement.push(`${less_than_week} courses are quick to finish, as they take less than a week. The skills are easy to learn, provide a solid base and help learners sharpen their technical abilities.`)
                                }
                                if (more_than_month > 0) {
                                    synopsis.type3[synopsis.type3.length - 1].statement.push(`${more_than_month} courses are long-duration courses, taking more than a month to complete; these courses are perfect for learners who wish to understand and explore the skills and topics in detail.`)
                                }
                            }

                            if (free > 0 || low_price > 0 || high_price > 0 || medium_price > 0) {
                                synopsis.type3.push({
                                    label: "Price Range",
                                    statement: []
                                })
                                let low_price_limit, high_price_limit
                                // set price limit for diffrence currencies for display purpose only
                                switch (currency) {
                                    case 'USD':
                                        low_price_limit = '$13'
                                        high_price_limit = '$130'
                                        break;
                                    case 'EUR':
                                        low_price_limit = '€12'
                                        high_price_limit = '€114'
                                        break;
                                    case 'GBP':
                                        low_price_limit = '£10'
                                        high_price_limit = '£105'
                                        break;
                                    case 'INR':
                                        low_price_limit = '₹1K'
                                        high_price_limit = '₹10K'
                                        break;
                                    default:
                                        break;
                                }

                                if (low_price > 0) {
                                    synopsis.type3[synopsis.type3.length - 1].statement.push(`We offer ${low_price} affordable online courses which cost less than ${low_price_limit} that can suit your budget.`)
                                }
                                if (medium_price > 0) {
                                    synopsis.type3[synopsis.type3.length - 1].statement.push(`For individuals wanting courses with more affordable pricing but with more practical learning, the options for the same are available: ${low_price} courses are available in the price range of ${low_price_limit} - ${high_price_limit}.`)
                                }
                                if (high_price > 0) {
                                    synopsis.type3[synopsis.type3.length - 1].statement.push(`We offer ${high_price} specialized courses by ${data.data.trending_list_synopsys_aggregation.partner.buckets.length} leading partners, which cost more than ${high_price_limit}.`)
                                }
                                if (free > 0) {
                                    synopsis.type3[synopsis.type3.length - 1].statement.push(`We offer ${free} courses that are free of cost from ${data.data.trending_list_synopsys_aggregation.partner.buckets.length} leading partners for Higher ed Learners and professionals.`)
                                }
                            }
                            if (signle_list.filters_number_of_courses) {
                                if (signle_list.filters_number_of_courses < data.data.pagination.totalCount) {
                                    data.data.pagination.totalCount = signle_list.filters_number_of_courses
                                }
                                data.data.sort = null,
                                    data.data.sortOptions = null
                            }

                            let finalData = {
                                list: data.data.list,
                                filters: filters,
                                pagination: data.data.pagination,
                                sort: data.data.sort,
                                sortOptions: data.data.sortOptions,
                                synopsis: synopsis
                            }
                            return callback(null, { success: true, message: 'Fetched successfully!', data: finalData })
                        }
                        else {
                            console.log("error fetching trending list courses", error)
                            return callback(null, { success: false, message: 'Error Fetching list!', data: null })
                        }
                    })

                }
            }
        } catch (error) {
            console.log("error fetching trending list courses", error)
            return callback(null, { success: false, message: 'Error Fetching list!', data: null })
        }
    }

    async addActivity(req, callback) {
        try {
            const { user } = req;
            const { trendingListId } = req.body
            const activity_log = await helperService.logActvity("TRENDING_LIST_VIEW", (user) ? user.userId : null, trendingListId);
            callback(null, { success: true, message: 'Added successfully!', data: null });
        } catch (error) {
            console.log("Trending LIST view activity error", error)
            callback(null, { success: false, message: 'Failed to Add', data: null });
        }
    }
}