const models = require("../../models");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const { publishToSNS } = require('../services/v1/sns');
const moment = require("moment");

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
        }

        switch (activity_types[activity.activityId]) {
            case "COURSE_VIEW": 
                activity_count[activity.resource].all_time.course_views= activity.count               
                break;
            case "COURSE_WISHLIST":
                activity_count[activity.resource].all_time.course_wishlists= activity.count                
                break;
            case "COURSE_ENQUIRED":
                activity_count[activity.resource].all_time.course_enquiries= activity.count       
                break;                
            case "COURSE_PURCHASED":
                activity_count[activity.resource].all_time.course_purchase= activity.count   
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
        }

        switch (activity_types[activity.activityId]) {
            case "COURSE_VIEW": 
                activity_count[activity.resource].all_time.course_views += activity.count               
                break;
            case "COURSE_WISHLIST":
                activity_count[activity.resource].all_time.course_wishlists += activity.count                
                break;
            case "COURSE_ENQUIRED":
                activity_count[activity.resource].all_time.course_enquiries += activity.count       
                break;                
            case "COURSE_PURCHASED":
                activity_count[activity.resource].all_time.course_purchase += activity.count   
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
        if(!activity_count[activity.resource].last_x_days)
        {
            activity_count[activity.resource].last_x_days = {
                course_views:0,
                course_wishlists:0,
                course_enquiries:0,
                course_purchase:0
            }
        }

        switch (activity_types[activity.activityId]) {
            case "COURSE_VIEW": 
                activity_count[activity.resource].last_x_days.course_views= activity.count               
                break;
            case "COURSE_WISHLIST":
                activity_count[activity.resource].last_x_days.course_wishlists= activity.count                
                break;
            case "COURSE_ENQUIRED":
                activity_count[activity.resource].last_x_days.course_enquiries= activity.count       
                break;                
            case "COURSE_PURCHASED":
                activity_count[activity.resource].last_x_days.course_purchase= activity.count   
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
        if(!activity_count[activity.resource].last_x_days)
        {
            activity_count[activity.resource].last_x_days = {
                course_views:0,
                course_wishlists:0,
                course_enquiries:0,
                course_purchase:0
            }
        }

        switch (activity_types[activity.activityId]) {
            case "COURSE_VIEW": 
                activity_count[activity.resource].last_x_days.course_views += activity.count               
                break;
            case "COURSE_WISHLIST":
                activity_count[activity.resource].last_x_days.course_wishlists += activity.count                
                break;
            case "COURSE_ENQUIRED":
                activity_count[activity.resource].last_x_days.course_enquiries += activity.count       
                break;                
            case "COURSE_PURCHASED":
                activity_count[activity.resource].last_x_days.course_purchase += activity.count   
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
    storeActivity
}