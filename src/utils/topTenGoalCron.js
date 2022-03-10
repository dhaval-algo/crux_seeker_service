const models = require("../../models");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const moment = require("moment");
const redisConnection = require('../services/v1/redis');
const RedisConnection = new redisConnection();


const storeTopTenGoal = async () => {

    const currentRoleCacheKey = "current-role";
    const preferredRoleCacheKey = "preferred-role";
    const industryChoiceCacheKey = "industry-choice";
    const preferredSkillCacheKey = "preferred-skill";
    let currentRole = []
    let preferredRole = []
    let industryChoice = []
    let preferredSkill = []
    const currentRoleObj =  await models.goal.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"], "currentRole"],         
        group: ['currentRole'],
        where: {
            "currentRole": {
              [Op.ne]: ""
            }
        },
        limit:10,
        raw:true,
        order: Sequelize.literal('count DESC')
    })
    for(let key of currentRoleObj){
        currentRole.push(key["currentRole"])
    }

    const preferredRoleObj =  await models.goal.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"], "preferredRole"],         
        group: ['preferredRole'],
        where: {
            "preferredRole": {
              [Op.ne]: ""
            }
        },
        limit:10,
        raw:true,
        order: Sequelize.literal('count DESC')
    })
    for(let key of preferredRoleObj){
        preferredRole.push(key["preferredRole"])
    }

    const industryChoiceObj =  await models.goal.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"], "industryChoice"],         
        group: ['industryChoice'],
        where: {
            "industryChoice": {
              [Op.ne]: ""
            }
        },
        limit:10,
        raw:true,
        order: Sequelize.literal('count DESC')
    })
    for(let key of industryChoiceObj){
        industryChoice.push(key["industryChoice"])
    }

    const preferredSkillObj =  await models.skill.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"], "name"],         
        group: ['name'],
        where: {
            "name": {
              [Op.ne]: ""
            }
        },
        limit:10,
        raw:true,
        order: Sequelize.literal('count DESC')
    })
    for(let key of preferredSkillObj){
        preferredSkill.push(key["name"])
    }

    if(currentRole.length > 0){
        RedisConnection.set(currentRoleCacheKey, currentRole);
    }

    if(preferredRole.length > 0){
        RedisConnection.set(preferredRoleCacheKey, preferredRole);
    }

    if(industryChoice.length > 0){
        RedisConnection.set(industryChoiceCacheKey, industryChoice);
    }

    if(preferredSkill.length > 0){
        RedisConnection.set(preferredSkillCacheKey, preferredSkill);
    }
}
   
module.exports = {
    storeTopTenGoal
}