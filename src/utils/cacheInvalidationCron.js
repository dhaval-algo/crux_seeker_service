const models = require("../../models");
const moment = require("moment");
const categoryService = require("../api/services/categoryService");
let CategoryService = new categoryService();
const learnContentService = require("../api/services/learnContentService");
let LearnContentService = new learnContentService();
const fetch = require("node-fetch");
const apiBackendUrl = process.env.API_BACKEND_URL;
const redisConnection = require('../services/v1/redis');
const RedisConnection = new redisConnection();
const {formatImageResponse} = require('../api/utils/general');


const {
    getCurrencies,
    getFilterConfigsUncached,
    getRankingFilter
} = require('../api/utils/general');

const invalidateCategoryTree = async () => {
    try {
       await CategoryService.getTree({query:{}}, (err, data) => {}, true);
       await CategoryService.getTreeV2(true, true);
       await CategoryService.getTreeV2(false, true);
    } catch (error) {
        console.log("category tree cache invalidation Error",error)
    }  
}

const invalidateEntityLabelCache = async () => {
    try {
       await LearnContentService.invalidateEntityLabelCache('categories');
       await LearnContentService.invalidateEntityLabelCache('sub-categories');
       await LearnContentService.invalidateEntityLabelCache('topics');
    } catch (error) {
        console.log("Entity Label cache invalidation Error", error)
    }  
}

const  invalidateLearnTypeImages = async () => {
    try {
       await LearnContentService.getLearnTypeImages(true);
    } catch (error) {
        console.log("Learn Type Images cache invalidation Error", error)
    }  
}

const  invalidateCurrencies = async () => {
    try {
       await getCurrencies(false);
    } catch (error) {
        console.log("Currencies cache invalidation Error", error)
    }  
}

const  invalidateFilterConfigs = async () => {
    try {
       await getFilterConfigsUncached('Article');
       await getFilterConfigsUncached('Learn_Content');
       await getFilterConfigsUncached('Learn_Path');
       await getFilterConfigsUncached('Provider');
    } catch (error) {
        console.log("Filter Configs cache invalidation Error",error)
    }  
}

const  invalidateRankingFilter = async () => {
    try {
       await getRankingFilter(false);
    } catch (error) {
        console.log("Ranking Filter cache invalidation Error",error)
    }  
}

const  invalidatTopics = async () => {
    try {
        await CategoryService.getTopics({query:{}}, (err, data) => {}, true);
    } catch (error) {
        console.log("Ranking Filter cache invalidation Error",error)
    }  
}

const invalidateAboutUs = async () => {
    let result = null;
    const cacheKey = "about-us";
    try{
        result = await fetch(`${apiBackendUrl}/about-us`);
    }catch(e){
        console.log('Error while retriving about us data',e);
    }
    if(result.ok) {
        let response = await result.json();
        if(response.content_section && response.content_section.length > 0)
        {
            response.content_section = response.content_section.map(content_section => {
                content_section.image = formatImageResponse(content_section.image)
                return content_section
            })
        }
        if(response.learn_more_about_us && response.learn_more_about_us.length > 0)
        {
            response.learn_more_about_us = response.learn_more_about_us.map(learn_more_about_us => {
                learn_more_about_us.image = formatImageResponse(learn_more_about_us.image)
                return learn_more_about_us
            })
        }
        let res = {};
        for (let key in response) {
            if(key != "id" && key != "created_at" && key != "created_by" && key != "updated_at" && key != "updated_by"){
                res[key] = response[key];
            }
        }

        RedisConnection.set(cacheKey, res);
    } 
}

const invalidateLeadership = async () => {
    let result = null;
    const cacheKey = "leadership";
    try{
        result = await fetch(`${apiBackendUrl}/leadership`);
    }catch(e){
        console.log('Error while retriving leadership data',e);
    }
    if(result.ok) {
        let response = await result.json();
        if(response.team_section  && response.team_section.length > 0)
        {
            response.team_section = response.team_section.map(team_section => {
                team_section.image = formatImageResponse(team_section.image)
                return team_section
            })
        }
        let res = {};
        for (let key in response) {
            if(key != "id" && key != "created_at" && key != "created_by" && key != "updated_at" && key != "updated_by"){
                res[key] = response[key];
            }
        }

        RedisConnection.set(cacheKey, res);
    }  
}

const invalidateTeam = async () => {
    let result = null;
    const cacheKey = "team";
    try{
        result = await fetch(`${apiBackendUrl}/team`);
    }catch(e){
        console.log('Error while retriving team data',e);
    }
    if(result.ok) {
        let response = await result.json();
        if(response.teams  && response.teams.length > 0)
        {
            response.teams = response.teams.map(teams => {
                teams.image = formatImageResponse(teams.image)
                return teams
            })
        }
        let res = {};
        for (let key in response) {
            if(key != "id" && key != "created_at" && key != "created_by" && key != "updated_at" && key != "updated_by"){
                res[key] = response[key];
            }
        }

        RedisConnection.set(cacheKey, res);
    }
}

const invalidateCareer = async () => {
    let result = null;
    const cacheKey = "career";
    try{
        result = await fetch(`${apiBackendUrl}/career`);
    }catch(e){
        console.log('Error while retriving career data',e);
    }
    if(result.ok) {
        let response = await result.json();
        if(response.content_section && response.content_section.length > 0)
        {
            response.content_section = response.content_section.map(content_section => {
                content_section.image = formatImageResponse(content_section.image)
                return content_section
            })
        }
        let res = {};
        for (let key in response) {
            if(key != "id" && key != "created_at" && key != "created_by" && key != "updated_at" && key != "updated_by"){
                res[key] = response[key];
            }
        }

        RedisConnection.set(cacheKey, res);
    }  
}

const invalidateTNM = async () => {
    let result = null;
    const cacheKey = "term-and-condition";
    try{
        result = await fetch(`${apiBackendUrl}/terms-and-conditions`);
    }catch(e){
        console.log('Error while retriving terms-and-conditions data',e);
    }
    if(result.ok) {
        let response = await result.json();
        let res = {};
        for (let key in response) {
            if(key != "id" && key != "created_at" && key != "created_by" && key != "updated_at" && key != "updated_by"){
                res[key] = response[key];
            }
        }

        RedisConnection.set(cacheKey, res);
    }  
}

const invalidatePP = async () => {
    let result = null;
    const cacheKey = "privacy-policy";
    try{
        result = await fetch(`${apiBackendUrl}/privacy-policy`);
    }catch(e){
        console.log('Error while retriving privacy-policy data',e);
    }
    if(result.ok) {
        let response = await result.json();
        let res = {};
        for (let key in response) {
            if(key != "id" && key != "created_at" && key != "created_by" && key != "updated_at" && key != "updated_by"){
                res[key] = response[key];
            }
        }

        RedisConnection.set(cacheKey, res);
    }
}

const invalidatSkills = async () => {
    try {
        await CategoryService.getSkills({query:{}}, (err, data) => {}, true);
    } catch (error) {
        console.log("Skills cache invalidation Error",error)
    }  
}


   
module.exports = {
    invalidateCategoryTree,
    invalidateEntityLabelCache,
    invalidateLearnTypeImages,
    invalidateCurrencies,
    invalidateFilterConfigs,
    invalidateRankingFilter,
    invalidatTopics,
    invalidateAboutUs,
    invalidateLeadership,
    invalidateTeam,
    invalidateCareer,
    invalidateTNM,
    invalidatePP,
    invalidatSkills
}