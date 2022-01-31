const models = require("../../models");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const { publishToSNS } = require('../services/v1/sns');
const moment = require("moment");

const learnpathActivity = async () => {
    let activity_types = {}
    let activity_count = []
    const activities =  await models.activity.findAll({
        attributes: ["id","type"],        
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
        if(!activity_count[activity.resource])
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

    for (let activity of activity_log_x_days)
    {
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
        if(!activity_count[activity.resource])
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

    for (let activity of activity_logs_loggedout_x_days)
    {
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

    for ( const [key, value] of Object.entries(activity_count))
    {
        let payload = {
            learn_path_id:key,
            activity_count:value,
        }
        publishToSNS(process.env.LEARN_PATH_ACTIVITY_TOPIC_ARN, payload, "LEARNPATH_ACTIVITY_COUNT")
    }
}

const storeActivity = async () => {
    let activity_types = {}
    let activity_count = []
    const activities =  await models.activity.findAll({
        attributes: ["id","type"],        
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
        if(!activity_count[activity.resource])
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

    // All time counts for non-logged in user 
    const activity_logs_loggedout_all =  await models.activity_log_loggedout.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"],"resource","activityId"],         
        group: ['activityId', "resource"],
        raw:true
    })

    for (let activity of activity_logs_loggedout_all)
    {
        if(!activity_count[activity.resource])
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

    for ( const [key, value] of Object.entries(activity_count))
    {
        let payload = {
            learn_content_id:key,
            activity_count:value,
        }  
       
        publishToSNS(process.env.LEARN_CONTENT_ACTIVITY_TOPIC_ARN, payload, "COURSE_ACTIVITY_COUNT")
    }
    
}
   
module.exports = {
    storeActivity,
    learnpathActivity
}