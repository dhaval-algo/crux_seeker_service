const models = require("../../models");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const { publishToSNS } = require('../services/v1/sns');
const moment = require("moment");
const fetch = require("node-fetch");
const apiBackendUrl = process.env.API_BACKEND_URL;

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

    try{
        var learnPathWeightDistribution = {}
        let response = await fetch(`${apiBackendUrl}/learn-path-weight?_limit=-1`)
        if (response.ok) {
            let json = await response.json();
            if(json){
                learnPathWeightDistribution["LEARNPATH_VIEW"] = json.priority_weights.view
                learnPathWeightDistribution["LEARNPATH_WISHLIST"] = json.priority_weights.wishlist
                learnPathWeightDistribution["LEARNPATH_ENQUIRED"] = json.priority_weights.enquiry
                learnPathWeightDistribution["LEARNPATH_SHARE"] = json.priority_weights.share
            }
        }else{
            console.log("err in access weights")
            return ;
        }

    }catch(err){
        console.log(err)
    }

    try{
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
    }catch(err){
        console.log(err)
    }
    
}

const articleWeightDistribution = {}

let responsearticle = fetch(`${apiBackendUrl}/article-weight?_limit=-1`).then(async function(response){
    if (response.ok) {
        let json = await response.json();
        if(json){
            articleWeightDistribution["ARTICLE_VIEW"] = json.priority_weights.view
            articleWeightDistribution["ARTICLE_WISHLIST"] = json.priority_weights.wishlist
            articleWeightDistribution["ARTICLE_SHARE"] = json.priority_weights.share
        }
    }
    else{
        console.log("err in access weights")
        return ;
    }
});

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
    try{
        var articleWeightDistribution = {}
        let response = await fetch(`${apiBackendUrl}/article-weight?_limit=-1`)
        if (response.ok) {
            let json = await response.json();
            if(json){
                articleWeightDistribution["ARTICLE_VIEW"] = json.priority_weights.view
                articleWeightDistribution["ARTICLE_WISHLIST"] = json.priority_weights.wishlist
                articleWeightDistribution["ARTICLE_SHARE"] = json.priority_weights.share
            }
        }
        else{
            console.log("err in access weights")
            return ;
        }
    }catch(err){
        console.log(err)
    }
    try{
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
    }catch(err){
        console.log(err)
    }
}

const storeActivity = async () => {
    let activity_types = {}
    let activity_count = []
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
    try{
        var learnContentWeightDistribution = {}

        let response = await fetch(`${apiBackendUrl}/learn-content-weight?_limit=-1`)
        if (response.ok) {
            let json = await response.json();
            if(json){
                learnContentWeightDistribution["COURSE_VIEW"] = json.priority_weights.view
                learnContentWeightDistribution["COURSE_WISHLIST"] = json.priority_weights.wishlist
                learnContentWeightDistribution["COURSE_SHARE"] = json.priority_weights.share
                learnContentWeightDistribution["COURSE_ENQUIRED"] = json.priority_weights.enquiry
            }
        }
        else{
            console.log("err in access weights")
            return ;
        }
    }catch(err){
        console.log(err)
    }
    try{
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
    }catch(err){
        console.log(err);
    }
}
   
module.exports = {
    storeActivity,
    learnpathActivity,
    articleActivity
}