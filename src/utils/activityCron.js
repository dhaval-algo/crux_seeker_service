const models = require("../../models");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const { publishToSNS } = require('../services/v1/sns');
const elasticService = require("../api/services/elasticService");
const moment = require("moment");
const redisConnection = require('../services/v1/redis');

const RedisConnection = new redisConnection();
const POPULAR_TRENDING_PERCENTAGE = 20

const learnPathWeightDistribution = {
    "LEARNPATH_VIEW":0.5,
    "LEARNPATH_WISHLIST": 0.166,
    "LEARNPATH_ENQUIRED": 0.166,
    "LEARNPATH_SHARE": 0.166
}

const learnpathActivity = async () => {
    let activity_types = {}
    let activity_count = {}
    const activities =  await models.activity.findAll({
        attributes: ["id","type"],
        where:{
            "type": ["LEARNPATH_VIEW","LEARNPATH_WISHLIST","LEARNPATH_ENQUIRED","LEARNPATH_PURCHASED","LEARNPATH_SHARE"]
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
                    learnpath_purchase:0,
                    learnpath_share:0,
                    popularity_score:0
                }
                activity_count[activity.resource].last_x_days = {
                    learnpath_views:0,
                    learnpath_wishlists:0,
                    learnpath_enquiries:0,
                    learnpath_purchase:0,
                    learnpath_share:0,
                    trending_score:0
                }
            }
            if(!activity.resource.startsWith("LRN_PTH")){
                continue;
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
                case "LEARNPATH_SHARE":
                    activity_count[activity.resource].all_time.learnpath_share= Number(activity.count)
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
                case "LEARNPATH_SHARE":
                    activity_count[activity.resource].last_x_days.learnpath_share= Number(activity.count)
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
                    learnpath_purchase:0,
                    learnpath_share:0,
                    popularity_score:0
                }

                activity_count[activity.resource].last_x_days = {
                    learnpath_views:0,
                    learnpath_wishlists:0,
                    learnpath_enquiries:0,
                    learnpath_purchase:0,
                    learnpath_share:0,
                    trending_score:0
                }
            }
            if(!activity.resource.startsWith("LRN_PTH")){
                continue;
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
                case "LEARNPATH_SHARE":
                    activity_count[activity.resource].all_time.learnpath_share += Number(activity.count)
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
                case "LEARNPATH_SHARE":
                    activity_count[activity.resource].last_x_days.learnpath_share += Number(activity.count)
                    break;
                default:
                    break;
            }
        }    
    }
    
    if(Object.keys(activity_count).length){
        for ( const [key, value] of Object.entries(activity_count))
        {
            value.all_time.popularity_score = learnPathWeightDistribution["LEARNPATH_VIEW"]*value.all_time.learnpath_views + 
                                                                        learnPathWeightDistribution["LEARNPATH_WISHLIST"]*value.all_time.learnpath_wishlists +
                                                                        learnPathWeightDistribution["LEARNPATH_ENQUIRED"]*value.all_time.learnpath_enquiries + 
                                                                        learnPathWeightDistribution["LEARNPATH_SHARE"]*value.all_time.learnpath_share;
            value.last_x_days.trending_score = learnPathWeightDistribution["LEARNPATH_VIEW"]*value.last_x_days.learnpath_views + 
                                                                        learnPathWeightDistribution["LEARNPATH_WISHLIST"]*value.last_x_days.learnpath_wishlists +
                                                                        learnPathWeightDistribution["LEARNPATH_ENQUIRED"]*value.last_x_days.learnpath_enquiries + 
                                                                        learnPathWeightDistribution["LEARNPATH_SHARE"]*value.last_x_days.learnpath_share;
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

const articleWeightDistribution = {
    "ARTICLE_VIEW":0.5,
    "ARTICLE_WISHLIST": 0.25,
    "ARTICLE_SHARE": 0.25
}

const articleActivity = async () => {
    let activity_types = {}
    let activity_count = {}
    const activities =  await models.activity.findAll({
        attributes: ["id","type"],     
        where:{
            "type": ["ARTICLE_VIEW","ARTICLE_WISHLIST","ARTICLE_SHARE"]
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
                    article_wishlists:0,
                    article_share:0,
                    popularity_score:0
                }
                activity_count[activity.resource].last_x_days = {
                    article_views:0,
                    article_wishlists:0,
                    article_share:0,
                    trending_score:0
                }
            }
            if(!activity.resource.startsWith("ARTCL_PUB")){
                continue;
            }
            
            switch (activity_types[activity.activityId]) {
                case "ARTICLE_VIEW": 
                    activity_count[activity.resource].all_time.article_views= Number(activity.count)              
                    break;
                case "ARTICLE_WISHLIST":
                    activity_count[activity.resource].all_time.article_wishlists= Number(activity.count)              
                    break;
                case "ARTICLE_SHARE":
                    activity_count[activity.resource].all_time.article_share= Number(activity.count)              
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
                case "ARTICLE_SHARE":
                    activity_count[activity.resource].last_x_days.article_share= Number(activity.count)              
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
                    article_wishlists:0,
                    article_share:0,
                    popularity_score:0
                }

                activity_count[activity.resource].last_x_days = {
                    article_views:0,
                    article_wishlists:0,
                    article_share:0,
                    trending_score:0
                }
            }

            if(!activity.resource.startsWith("ARTCL_PUB")){
                continue;
            }

            switch (activity_types[activity.activityId]) {
                case "ARTICLE_VIEW": 
                    activity_count[activity.resource].all_time.article_views += Number(activity.count)             
                    break;
                case "ARTICLE_WISHLIST":
                    activity_count[activity.resource].all_time.article_wishlists += Number(activity.count)
                    break;
                case "ARTICLE_SHARE":
                    activity_count[activity.resource].all_time.article_share += Number(activity.count)
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
                case "ARTICLE_SHARE":
                    activity_count[activity.resource].last_x_days.article_share += Number(activity.count)
                    break;
                default:
                    break;
            }
        }
    }
    if(Object.keys(activity_count).length){
        for ( const [key, value] of Object.entries(activity_count))
        {
            value.all_time.popularity_score = articleWeightDistribution["ARTICLE_VIEW"]*value.all_time.article_views + 
                                                                        articleWeightDistribution["ARTICLE_WISHLIST"]*value.all_time.article_wishlists +
                                                                        articleWeightDistribution["ARTICLE_SHARE"]*value.all_time.article_share;
            value.last_x_days.trending_score = articleWeightDistribution["ARTICLE_VIEW"]*value.last_x_days.article_views + 
                                                                        articleWeightDistribution["ARTICLE_WISHLIST"]*value.last_x_days.article_wishlists +
                                                                        articleWeightDistribution["ARTICLE_SHARE"]*value.last_x_days.article_share;
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

const learnContentWeightDistribution = {
    "COURSE_VIEW":0.5,
    "COURSE_WISHLIST": 0.166,
    "COURSE_ENQUIRED": 0.166,
    "COURSE_SHARE": 0.166
}

const storeActivity = async () => {
    let activity_types = {}
    let activity_count = {}
    const activities =  await models.activity.findAll({
        attributes: ["id","type"],     
        where:{
            "type": ["COURSE_VIEW","COURSE_WISHLIST","COURSE_ENQUIRED","COURSE_PURCHASED","COURSE_SHARE"]
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
                    course_purchase:0,
                    course_share:0,
                    popularity_score:0
                }
                activity_count[activity.resource].last_x_days = {
                    course_views:0,
                    course_wishlists:0,
                    course_enquiries:0,
                    course_purchase:0,
                    course_share:0,
                    trending_score:0
                }
            }

            if(!activity.resource.startsWith("LRN_CNT")){
                continue;
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
                case "COURSE_SHARE":
                    activity_count[activity.resource].all_time.course_share= Number(activity.count)
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
                    course_purchase:0,
                    course_share:0,
                    popularity_score:0
                }

                activity_count[activity.resource].last_x_days = {
                    course_views:0,
                    course_wishlists:0,
                    course_enquiries:0,
                    course_purchase:0,
                    course_share:0,
                    trending_score:0
                }
            }

            if(!activity.resource.startsWith("LRN_CNT")){
                continue;
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
                case "COURSE_SHARE":
                    activity_count[activity.resource].all_time.course_share += Number(activity.count)
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
                case "COURSE_SHARE":
                    activity_count[activity.resource].last_x_days.course_share= Number(activity.count)
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
                case "COURSE_SHARE":
                    activity_count[activity.resource].last_x_days.course_share += Number(activity.count)
                    break;
                default:
                    break;
            }
        }
    }
    if(Object.keys(activity_count).length){
        for ( const [key, value] of Object.entries(activity_count))
        {
            value.all_time.popularity_score = learnContentWeightDistribution["COURSE_VIEW"]*value.all_time.course_views + 
                                                                        learnContentWeightDistribution["COURSE_WISHLIST"]*value.all_time.course_wishlists +
                                                                        learnContentWeightDistribution["COURSE_ENQUIRED"]*value.all_time.course_enquiries + 
                                                                        learnContentWeightDistribution["COURSE_SHARE"]*value.all_time.course_share;
            value.last_x_days.trending_score = learnContentWeightDistribution["COURSE_VIEW"]*value.last_x_days.course_views + 
                                                                        learnContentWeightDistribution["COURSE_WISHLIST"]*value.last_x_days.course_wishlists +
                                                                        learnContentWeightDistribution["COURSE_ENQUIRED"]*value.last_x_days.course_enquiries + 
                                                                        learnContentWeightDistribution["COURSE_SHARE"]*value.last_x_days.course_share;
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



const providerWeightDistribution = {
    "INSTITUTE_VIEW":1,
    "INSTITUTE_WISHLIST": 0,
    "INSTITUTE_SHARE":0
}

const providerActivity = async () => {
    let activity_types = {}
    let activity_count = {}
    let activity_ids = []
    const activities =  await models.activity.findAll({
        attributes: ["id","type"],     
        where:{
            "type": ["INSTITUTE_VIEW","INSTITUTE_WISHLIST","INSTITUTE_SHARE"]
        },   
        raw:true
    })
    
    for (activity_type of activities)
    {
        activity_types[activity_type.id] = activity_type.type
        activity_ids.push(activity_type.id)
    }
    
    // All time counts for logged in user 
    const activity_logs_all =  await models.activity_log.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"],"resource","activityId"],         
        group: ['activityId', "resource"],
        raw:true,
        where: {
            activityId: activity_ids
        }
    })
    
    const activity_log_x_days = await models.activity_log.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"],"resource","activityId"],       
        where: {
            createdAt: {
                [Op.gte]: moment().subtract(process.env.LAST_X_DAYS_COUNT, 'days').toDate()
            },
            activityId: activity_ids
        },
        group: ['activityId', "resource"],
        raw:true
    })

    for (let activity of activity_logs_all)
    {
        if(activity.resource){
            if(!activity_count[activity.resource])
            {
                activity_count[activity.resource] = {}
                activity_count[activity.resource].all_time = {
                    institute_views:0,
                    institute_wishlists:0,
                    institute_share:0,
                    popularity_score:0
                }
                activity_count[activity.resource].last_x_days = {
                    institute_views:0,
                    institute_wishlists:0,
                    institute_share:0,
                    trending_score:0
                }
            }           
            
            switch (activity_types[activity.activityId]) {
                case "INSTITUTE_VIEW": 
                    activity_count[activity.resource].all_time.institute_views= Number(activity.count)              
                    break;
                case "INSTITUTE_WISHLIST":
                    activity_count[activity.resource].all_time.institute_wishlists= Number(activity.count)              
                    break;
                case "INSTITUTE_SHARE":
                    activity_count[activity.resource].all_time.institute_share= Number(activity.count)              
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
                case "INSTITUTE_VIEW": 
                    activity_count[activity.resource].last_x_days.institute_views= Number(activity.count)
                    break;
                case "INSTITUTE_WISHLIST":
                    activity_count[activity.resource].last_x_days.institute_wishlists= Number(activity.count)
                    break;
                case "INSTITUTE_SHARE":
                    activity_count[activity.resource].last_x_days.institute_share= Number(activity.count)              
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
        raw:true,
        where: {
            activityId: activity_ids
        }
    })

    const activity_logs_loggedout_x_days = await models.activity_log_loggedout.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"],"resource","activityId"],       
        where: {
            createdAt: {
                [Op.gte]: moment().subtract(process.env.LAST_X_DAYS_COUNT, 'days').toDate()
            },
            activityId: activity_ids
        },
        group: ['activityId', "resource"],
        raw:true
    })
    
    for (let activity of activity_logs_loggedout_all)
    {
        if(activity.resource){
            if(!activity_count[activity.resource] )
            {
                activity_count[activity.resource] = {}
                activity_count[activity.resource].all_time = {
                    institute_views:0,
                    institute_wishlists:0,
                    institute_share:0,
                    popularity_score:0
                }

                activity_count[activity.resource].last_x_days = {
                    institute_views:0,
                    institute_wishlists:0,
                    institute_share:0,
                    trending_score:0
                }
            }            

            switch (activity_types[activity.activityId]) {
                case "INSTITUTE_VIEW": 
                    activity_count[activity.resource].all_time.institute_views += Number(activity.count)             
                    break;
                case "INSTITUTE_WISHLIST":
                    activity_count[activity.resource].all_time.institute_wishlists += Number(activity.count)
                    break;
                case "INSTITUTE_SHARE":
                    activity_count[activity.resource].all_time.institute_share += Number(activity.count)
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
                case "INSTITUTE_VIEW": 
                    activity_count[activity.resource].last_x_days.institute_views += Number(activity.count)
                    break;
                case "INSTITUTE_WISHLIST":
                    activity_count[activity.resource].last_x_days.institute_wishlists += Number(activity.count)
                    break;
                case "INSTITUTE_SHARE":
                    activity_count[activity.resource].last_x_days.institute_share += Number(activity.count)
                    break;
                default:
                    break;
            }
        }
    }
    if(Object.keys(activity_count).length){
        for ( const [key, value] of Object.entries(activity_count))
        {
            value.all_time.popularity_score = providerWeightDistribution["INSTITUTE_VIEW"]*value.all_time.institute_views + 
                                                                        providerWeightDistribution["INSTITUTE_WISHLIST"]*value.all_time.institute_wishlists +
                                                                        providerWeightDistribution["INSTITUTE_SHARE"]*value.all_time.institute_share;
            value.last_x_days.trending_score = providerWeightDistribution["INSTITUTE_VIEW"]*value.last_x_days.institute_views + 
            providerWeightDistribution["INSTITUTE_WISHLIST"]*value.last_x_days.institute_wishlists +
            providerWeightDistribution["INSTITUTE_SHARE"]*value.last_x_days.institute_share;
        }
    }
    if(Object.keys(activity_count).length){
        for ( const [key, value] of Object.entries(activity_count))
        {
            let payload = {
                provider_id:key,
                activity_count:value,
            }
            publishToSNS(process.env.PROVIDER_ACTIVITY_TOPIC_ARN, payload, "INSTITUTE_ACTIVITY_COUNT")
        }
    }
}
   
module.exports = {
    storeActivity,
    learnpathActivity,
    articleActivity,
    providerActivity,
    setTrendingPopularityThreshold
}