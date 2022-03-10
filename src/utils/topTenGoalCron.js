const models = require("../../models");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const { publishToSNS } = require('../services/v1/sns');
const moment = require("moment");
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();


const storeTopTenGoal = async () => {

    const currentRoleCacheKey = "current-role";
    const preferredRoleCacheKey = "preferred-role";
    const industryChoiceCacheKey = "industry-choice";
    const preferredSkillCacheKey = "preferred-skill";

    // const currentRoleObj =  await models.goal.findAll({
    //     attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"], [Sequelize.fn('DISTINCT', Sequelize.col('currentRole')), "currentRole"]],         
    //     where:{
    //         count: {
    //             [Op.gte]: 2
    //         }
    //     },
    //     limit:10,
    //     raw:true
    // })
    const currentRoleObj = await queryInterface.sequelize.query(`SELECt curerntRole FROM goals where `);
    for(let key of currentRoleObj){
        console.log(key);
    }
    // const result = await elasticService.search('custom_pages', query);
    // if(result.hits && result.hits.length > 0) {

    //     let data = { content:result.hits[0]._source };
    //     RedisConnection.set(cacheKey, data);
    //     RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_CUSTOM_PAGE); 

    //     callback(null, {status: 'success', message: 'Fetched successfully!', data:data});
    // } else {
    //     callback(null, {status: 'failed', message: 'No data available!', data: {}});
    // }

}
   
module.exports = {
    storeTopTenGoal
}