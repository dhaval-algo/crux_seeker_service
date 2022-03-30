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
        let res = {};
        for (let key in response) {
            if(key != "id" && key != "created_at" && key != "created_by" && key != "updated_at" && key != "updated_by"){
                res[key] = response[key];
            }
        }

        RedisConnection.set(cacheKey, res);
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
    invalidateCareer
}