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
    const degreeCacheKey = "degree";
    const specializationCacheKey = "specialization";
    let currentRole = []
    let preferredRole = []
    let industryChoice = []
    let preferredSkill = []
    let degree = []
    let specialization = []
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

    const degreeObj =  await models.goal.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"], "highestDegree"],         
        group: ['highestDegree'],
        where: {
            "highestDegree": {
              [Op.ne]: ""
            }
        },
        limit:10,
        raw:true,
        order: Sequelize.literal('count DESC')
    })
    for(let key of degreeObj){
        degree.push(key["highestDegree"])
    }

    const specializationObj =  await models.goal.findAll({
        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"], "specialization"],         
        group: ['specialization'],
        where: {
            "specialization": {
              [Op.ne]: ""
            }
        },
        limit:10,
        raw:true,
        order: Sequelize.literal('count DESC')
    })
    for(let key of specializationObj){
        specialization.push(key["specialization"])
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

    if(degree.length > 0){
        RedisConnection.set(degreeCacheKey, degree);
    }

    if(specialization.length > 0){
        RedisConnection.set(specializationCacheKey, specialization);
    }
}
   
module.exports = {
    storeTopTenGoal
}