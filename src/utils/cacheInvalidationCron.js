const models = require("../../models");
const moment = require("moment");
const categoryService = require("../api/services/categoryService");
let CategoryService = new categoryService();
const learnContentService = require("../api/services/learnContentService");
let LearnContentService = new learnContentService();

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
    invalidatSkills
}