const models = require("../../models");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const { publishToSNS } = require('../services/v1/sns');
const elasticService = require("../api/services/elasticService");
const moment = require("moment");
const redisConnection = require('../services/v1/redis');

const RedisConnection = new redisConnection();
const POPULAR_TRENDING_PERCENTAGE = 20

const learnpathActivity = async () => {
    let activity_types = {}
    let activity_count = {}
    const activities =  await models.activity.findAll({
        attributes: ["id","type"],
        where:{
            "type": ["LEARNPATH_VIEW","LEARNPATH_WISHLIST","LEARNPATH_ENQUIRED","LEARNPATH_PURCHASED"]
        } ,  
        raw:true
    })
    
    for (activity_type of activities)
    {
        activity_types[activity_type.id] = activity_type.type
    }
    
    // All time counts for logged in user 
    const activity_logs_all =  await models.activity_log.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"],"resource","activityId"],         
        group: ['activityId', "resource"],
        raw:true
    })
    
    const activity_log_x_days = await models.activity_log.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"],"resource","activityId"],       
        where: {
            createdAt: {
                [Op.gte]: moment().subtract(process.env.LAST_X_DAYS_COUNT, 'days').toDate()
            }
        },
        group: ['activityId', "resource"],
        raw:true
    }) 
    
    for (let activity of activity_logs_all)
    {
        if(activity.resource){
            if(!activity_count[activity.resource] && activity.resource.startsWith("LRN_PTH"))
            {
                activity_count[activity.resource] = {}
                activity_count[activity.resource].all_time = {
                    learnpath_views:0,
                    learnpath_wishlists:0,
                    learnpath_enquiries:0,
                    learnpath_purchase:0
                }
                activity_count[activity.resource].last_x_days = {
                    learnpath_views:0,
                    learnpath_wishlists:0,
                    learnpath_enquiries:0,
                    learnpath_purchase:0
                }
            }
            
            switch (activity_types[activity.activityId]) {
                case "LEARNPATH_VIEW": 
                    activity_count[activity.resource].all_time.learnpath_views= Number(activity.count)              
                    break;
                case "LEARNPATH_WISHLIST":
                    activity_count[activity.resource].all_time.learnpath_wishlists= Number(activity.count)              
                    break;
                case "LEARNPATH_ENQUIRED":
                    activity_count[activity.resource].all_time.learnpath_enquiries= Number(activity.count)
                    break;                
                case "LEARNPATH_PURCHASED":
                    activity_count[activity.resource].all_time.learnpath_purchase= Number(activity.count)
                    break;
                default:
                    break;
            }
        }  
    }

    for (let activity of activity_log_x_days)
    {
        if(activity.resource){
            switch (activity_types[activity.activityId]) {
                case "LEARNPATH_VIEW": 
                    activity_count[activity.resource].last_x_days.learnpath_views= Number(activity.count)
                    break;
                case "LEARNPATH_WISHLIST":
                    activity_count[activity.resource].last_x_days.learnpath_wishlists= Number(activity.count)
                    break;
                case "LEARNPATH_ENQUIRED":
                    activity_count[activity.resource].last_x_days.learnpath_enquiries= Number(activity.count)
                    break;                
                case "LEARNPATH_PURCHASED":
                    activity_count[activity.resource].last_x_days.learnpath_purchase= Number(activity.count)
                    break;
                default:
                    break;
            }
        }
    }

    // All time counts for non-logged in user 
    const activity_logs_loggedout_all =  await models.activity_log_loggedout.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"],"resource","activityId"],         
        group: ['activityId', "resource"],
        raw:true
    })

    const activity_logs_loggedout_x_days = await models.activity_log_loggedout.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"],"resource","activityId"],       
        where: {
            createdAt: {
                [Op.gte]: moment().subtract(process.env.LAST_X_DAYS_COUNT, 'days').toDate()
            }
        },
        group: ['activityId', "resource"],
        raw:true
    })

    for (let activity of activity_logs_loggedout_all)
    {
        if(activity.resource){
            if(!activity_count[activity.resource] && activity.resource.startsWith("LRN_PTH"))
            {
                activity_count[activity.resource] = {}
                activity_count[activity.resource].all_time = {
                    learnpath_views:0,
                    learnpath_wishlists:0,
                    learnpath_enquiries:0,
                    learnpath_purchase:0
                }

                activity_count[activity.resource].last_x_days = {
                    learnpath_views:0,
                    learnpath_wishlists:0,
                    learnpath_enquiries:0,
                    learnpath_purchase:0
                }
            }

            switch (activity_types[activity.activityId]) {
                case "LEARNPATH_VIEW": 
                    activity_count[activity.resource].all_time.learnpath_views += Number(activity.count)             
                    break;
                case "LEARNPATH_WISHLIST":
                    activity_count[activity.resource].all_time.learnpath_wishlists += Number(activity.count)
                    break;
                case "LEARNPATH_ENQUIRED":
                    activity_count[activity.resource].all_time.learnpath_enquiries += Number(activity.count)
                    break;                
                case "LEARNPATH_PURCHASED":
                    activity_count[activity.resource].all_time.learnpath_purchase += Number(activity.count)
                    break;
                default:
                    break;
            }
        }   
    }

    for (let activity of activity_logs_loggedout_x_days)
    {  
        if(activity.resource){
            switch (activity_types[activity.activityId]) {
                case "LEARNPATH_VIEW": 
                    activity_count[activity.resource].last_x_days.learnpath_views += Number(activity.count)
                    break;
                case "LEARNPATH_WISHLIST":
                    activity_count[activity.resource].last_x_days.learnpath_wishlists += Number(activity.count)
                    break;
                case "LEARNPATH_ENQUIRED":
                    activity_count[activity.resource].last_x_days.learnpath_enquiries += Number(activity.count)
                    break;                
                case "LEARNPATH_PURCHASED":
                    activity_count[activity.resource].last_x_days.learnpath_purchase += Number(activity.count)
                    break;
                default:
                    break;
            }
        }    
    }
    if(Object.keys(activity_count).length){
        for ( const [key, value] of Object.entries(activity_count))
        {
            let payload = {
                learn_path_id:key,
                activity_count:value,
            }
            publishToSNS(process.env.LEARN_PATH_ACTIVITY_TOPIC_ARN, payload, "LEARNPATH_ACTIVITY_COUNT")
        }
    }
    
}

const articleActivity = async () => {
    let activity_types = {}
    let activity_count = {}
    const activities =  await models.activity.findAll({
        attributes: ["id","type"],     
        where:{
            "type": ["ARTICLE_VIEW","ARTICLE_WISHLIST"]
        },   
        raw:true
    })
    
    for (activity_type of activities)
    {
        activity_types[activity_type.id] = activity_type.type
    }
    
    // All time counts for logged in user 
    const activity_logs_all =  await models.activity_log.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"],"resource","activityId"],         
        group: ['activityId', "resource"],
        raw:true
    })
    
    const activity_log_x_days = await models.activity_log.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"],"resource","activityId"],       
        where: {
            createdAt: {
                [Op.gte]: moment().subtract(process.env.LAST_X_DAYS_COUNT, 'days').toDate()
            }
        },
        group: ['activityId', "resource"],
        raw:true
    }) 
    
    for (let activity of activity_logs_all)
    {
        if(activity.resource){
            if(!activity_count[activity.resource] && activity.resource.startsWith("ARTCL_PUB"))
            {
                activity_count[activity.resource] = {}
                activity_count[activity.resource].all_time = {
                    article_views:0,
                    article_wishlists:0
                }
                activity_count[activity.resource].last_x_days = {
                    article_views:0,
                    article_wishlists:0
                }
            }
            
            switch (activity_types[activity.activityId]) {
                case "ARTICLE_VIEW": 
                    activity_count[activity.resource].all_time.article_views= Number(activity.count)              
                    break;
                case "ARTICLE_WISHLIST":
                    activity_count[activity.resource].all_time.article_wishlists= Number(activity.count)              
                    break;
                default:
                    break;
            }
        }  
    }

    for (let activity of activity_log_x_days)
    {
        if(activity.resource){
            switch (activity_types[activity.activityId]) {
                case "ARTICLE_VIEW": 
                    activity_count[activity.resource].last_x_days.article_views= Number(activity.count)
                    break;
                case "ARTICLE_WISHLIST":
                    activity_count[activity.resource].last_x_days.article_wishlists= Number(activity.count)
                    break;
                default:
                    break;
            }
        }
    }

    // All time counts for non-logged in user 
    const activity_logs_loggedout_all =  await models.activity_log_loggedout.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"],"resource","activityId"],         
        group: ['activityId', "resource"],
        raw:true
    })

    const activity_logs_loggedout_x_days = await models.activity_log_loggedout.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"],"resource","activityId"],       
        where: {
            createdAt: {
                [Op.gte]: moment().subtract(process.env.LAST_X_DAYS_COUNT, 'days').toDate()
            }
        },
        group: ['activityId', "resource"],
        raw:true
    })

    for (let activity of activity_logs_loggedout_all)
    {
        if(activity.resource){
            if(!activity_count[activity.resource] && activity.resource.startsWith("ARTCL_PUB"))
            {
                activity_count[activity.resource] = {}
                activity_count[activity.resource].all_time = {
                    article_views:0,
                    article_wishlists:0
                }

                activity_count[activity.resource].last_x_days = {
                    article_views:0,
                    article_wishlists:0
                }
            }

            switch (activity_types[activity.activityId]) {
                case "ARTICLE_VIEW": 
                    activity_count[activity.resource].all_time.article_views += Number(activity.count)             
                    break;
                case "ARTICLE_WISHLIST":
                    activity_count[activity.resource].all_time.article_wishlists += Number(activity.count)
                    break;
                default:
                    break;
            }
        }   
    }

    for (let activity of activity_logs_loggedout_x_days)
    {
        if(activity.resource){
            switch (activity_types[activity.activityId]) {
                case "ARTICLE_VIEW": 
                    activity_count[activity.resource].last_x_days.article_views += Number(activity.count)
                    break;
                case "ARTICLE_WISHLIST":
                    activity_count[activity.resource].last_x_days.article_wishlists += Number(activity.count)
                    break;
                default:
                    break;
            }
        }
    }
    if(Object.keys(activity_count).length){
        for ( const [key, value] of Object.entries(activity_count))
        {
            let payload = {
                article_id:key,
                activity_count:value,
            }
            publishToSNS(process.env.ARTICLE_ACTIVITY_TOPIC_ARN, payload, "ARTICLE_ACTIVITY_COUNT")
        }
    }
}

const storeActivity = async () => {
    let activity_types = {}
    let activity_count = {}
    const activities =  await models.activity.findAll({
        attributes: ["id","type"],     
        where:{
            "type": ["COURSE_VIEW","COURSE_WISHLIST","COURSE_ENQUIRED","COURSE_PURCHASED"]
        } ,  
        raw:true
    })
    
    for (activity_type of activities)
    {
        activity_types[activity_type.id] = activity_type.type
    }
    
    // All time counts for logged in user 
    const activity_logs_all =  await models.activity_log.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"],"resource","activityId"],         
        group: ['activityId', "resource"],
        raw:true
    })

    for (let activity of activity_logs_all)
    {
        if(activity.resource){
            if(!activity_count[activity.resource] && activity.resource.startsWith("LRN_CNT"))
            {
                activity_count[activity.resource] = {}
                activity_count[activity.resource].all_time = {
                    course_views:0,
                    course_wishlists:0,
                    course_enquiries:0,
                    course_purchase:0
                }
                activity_count[activity.resource].last_x_days = {
                    course_views:0,
                    course_wishlists:0,
                    course_enquiries:0,
                    course_purchase:0
                }
            }

            switch (activity_types[activity.activityId]) {
                case "COURSE_VIEW": 
                    activity_count[activity.resource].all_time.course_views= Number(activity.count)              
                    break;
                case "COURSE_WISHLIST":
                    activity_count[activity.resource].all_time.course_wishlists= Number(activity.count)              
                    break;
                case "COURSE_ENQUIRED":
                    activity_count[activity.resource].all_time.course_enquiries= Number(activity.count)
                    break;                
                case "COURSE_PURCHASED":
                    activity_count[activity.resource].all_time.course_purchase= Number(activity.count)
                    break;
                default:
                    break;
            }
        }   
    }

    // All time counts for non-logged in user 
    const activity_logs_loggedout_all =  await models.activity_log_loggedout.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"],"resource","activityId"],         
        group: ['activityId', "resource"],
        raw:true
    })

    for (let activity of activity_logs_loggedout_all)
    {
        if(activity.resource){
            if(!activity_count[activity.resource] && activity.resource.startsWith("LRN_CNT"))
            {
                activity_count[activity.resource] = {}
                activity_count[activity.resource].all_time = {
                    course_views:0,
                    course_wishlists:0,
                    course_enquiries:0,
                    course_purchase:0
                }

                activity_count[activity.resource].last_x_days = {
                    course_views:0,
                    course_wishlists:0,
                    course_enquiries:0,
                    course_purchase:0
                }
            }

            switch (activity_types[activity.activityId]) {
                case "COURSE_VIEW": 
                    activity_count[activity.resource].all_time.course_views += Number(activity.count)             
                    break;
                case "COURSE_WISHLIST":
                    activity_count[activity.resource].all_time.course_wishlists += Number(activity.count)
                    break;
                case "COURSE_ENQUIRED":
                    activity_count[activity.resource].all_time.course_enquiries += Number(activity.count)
                    break;                
                case "COURSE_PURCHASED":
                    activity_count[activity.resource].all_time.course_purchase += Number(activity.count)
                    break;
                default:
                    break;
            }
        }
    }
    
    // Last X days counts for logged in user 
    const activity_logs =  await models.activity_log.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"],"resource","activityId"],       
        where: {
            createdAt: {
                [Op.gte]: moment().subtract(process.env.LAST_X_DAYS_COUNT, 'days').toDate()
            }
        },
        group: ['activityId', "resource"],
        raw:true
    })

    for (let activity of activity_logs)
    {
        if(activity.resource){
            switch (activity_types[activity.activityId]) {
                case "COURSE_VIEW": 
                    activity_count[activity.resource].last_x_days.course_views= Number(activity.count)
                    break;
                case "COURSE_WISHLIST":
                    activity_count[activity.resource].last_x_days.course_wishlists= Number(activity.count)
                    break;
                case "COURSE_ENQUIRED":
                    activity_count[activity.resource].last_x_days.course_enquiries= Number(activity.count)
                    break;                
                case "COURSE_PURCHASED":
                    activity_count[activity.resource].last_x_days.course_purchase= Number(activity.count)
                    break;
                default:
                    break;
            }
        }    
    }

    // Last X days counts for non-logged in user 
    const activity_logs_loggedout =  await models.activity_log_loggedout.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"],"resource","activityId"],       
        where: {
            createdAt: {
                [Op.gte]: moment().subtract(process.env.LAST_X_DAYS_COUNT, 'days').toDate()
            }
        },
        group: ['activityId', "resource"],
        raw:true
    })

    for (let activity of activity_logs_loggedout)
    {
        if(activity.resource){
            switch (activity_types[activity.activityId]) {
                case "COURSE_VIEW": 
                    activity_count[activity.resource].last_x_days.course_views += Number(activity.count)
                    break;
                case "COURSE_WISHLIST":
                    activity_count[activity.resource].last_x_days.course_wishlists += Number(activity.count)
                    break;
                case "COURSE_ENQUIRED":
                    activity_count[activity.resource].last_x_days.course_enquiries += Number(activity.count)
                    break;                
                case "COURSE_PURCHASED":
                    activity_count[activity.resource].last_x_days.course_purchase += Number(activity.count)
                    break;
                default:
                    break;
            }
        }
    }
    if(Object.keys(activity_count).length){
        for ( const [key, value] of Object.entries(activity_count))
        {
            let payload = {
                learn_content_id:key,
                activity_count:value,
            }  
            publishToSNS(process.env.LEARN_CONTENT_ACTIVITY_TOPIC_ARN, payload, "COURSE_ACTIVITY_COUNT")
        }
    }
}

const setTrendingPopularityThreshold = async () => {
    let esQuery = {
        "bool": {
            "filter": [
                { "term": { "status.keyword": "published" } }
            ]
        }
    }

    // Get total count of course
    let count = await elasticService.count("learn-content", {"query": esQuery});
    if(count)
    {
        //calculate popular/trending number of cources
        let thresholdCount = Math.ceil((count.count*POPULAR_TRENDING_PERCENTAGE)/100)        
        let result = await elasticService.search("learn-content", esQuery, { from: thresholdCount, size: 1, sortObject: { "activity_count.all_time.popularity_score": "desc" } ,_source: ["activity_count"]});
         if (result.hits) {      
            RedisConnection.set("COURSE_POPULARITY_SCORE_THRESHOLD", result.hits[0]._source.activity_count.all_time.popularity_score); 
        }

        result = await elasticService.search("learn-content", esQuery, { from: thresholdCount, size: 1, sortObject: { "activity_count.last_x_days.trending_score": "desc" } ,_source: ["activity_count"]});
        if (result.hits) {      
            RedisConnection.set("COURSE_TRENDING_SCORE_THRESHOLD", result.hits[0]._source.activity_count.last_x_days.trending_score); 
        }
    }

    // Get total count of Learnpath
    esQuery = {
        "bool": {
            "filter": [
                { "term": { "status.keyword": "approved" } }
            ]
        }
    }
    count = await elasticService.count("learn-path", {"query": esQuery});
    if(count)
    {
        //calculate popular/trending number of Learnpaths
        let thresholdCount = Math.ceil((count.count*POPULAR_TRENDING_PERCENTAGE)/100)        
        let result = await elasticService.search("learn-path", esQuery, { from: thresholdCount, size: 1, sortObject: { "activity_count.all_time.popularity_score": "desc" } ,_source: ["activity_count"]});
         if (result.hits) {      
            RedisConnection.set("LEARN_PATH_POPULARITY_SCORE_THRESHOLD", result.hits[0]._source.activity_count.all_time.popularity_score); 
        }

        result = await elasticService.search("learn-path", esQuery, { from: thresholdCount, size: 1, sortObject: { "activity_count.last_x_days.trending_score": "desc" } ,_source: ["activity_count"]});
        if (result.hits) {      
            RedisConnection.set("LEARN_PATH_TRENDING_SCORE_THRESHOLD", result.hits[0]._source.activity_count.last_x_days.trending_score); 
        }
    }


    // Get total count of article
    esQuery = {
        "bool": {
            "filter": [
                { "term": { "status.keyword": "published" } }
            ]
        }
    }
    count = await elasticService.count("article", {"query": esQuery});
    if(count)
    {
        //calculate popular/trending number of cources
        let thresholdCount = Math.ceil((count.count*POPULAR_TRENDING_PERCENTAGE)/100)        
        let result = await elasticService.search("article", esQuery, { from: thresholdCount, size: 1, sortObject: { "activity_count.all_time.popularity_score": "desc" } ,_source: ["activity_count"]});
         if (result.hits) {      
            RedisConnection.set("ARTICLE_POPULARITY_SCORE_THRESHOLD", result.hits[0]._source.activity_count.all_time.popularity_score); 
        }

        result = await elasticService.search("article", esQuery, { from: thresholdCount, size: 1, sortObject: { "activity_count.last_x_days.trending_score": "desc" } ,_source: ["activity_count"]});
        if (result.hits) {      
            RedisConnection.set("ARTICLE_PATH_TRENDING_SCORE_THRESHOLD", result.hits[0]._source.activity_count.last_x_days.trending_score); 
        }
    }
}
   
module.exports = {
    storeActivity,
    learnpathActivity,
    articleActivity,
    setTrendingPopularityThreshold
}