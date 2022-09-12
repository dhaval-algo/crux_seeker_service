const categoryService = require("../api/services/categoryService");
let CategoryService = new categoryService();
const learnContentService = require("../api/services/learnContentService");
let LearnContentService = new learnContentService();
const providerService = require("../api/services/providerService");
let ProviderService = new providerService();
const  FooterService = require("../api/services/footerService")
const footerService = new FooterService()


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

const invalidatePartnerWithUs = async () => {
    try {
        await footerService.partnerWithUs((err, data) => {}, false);
    } catch (error) {
        console.log("invalidatePartnerWithUs cache invalidation Error",error)
    }
}

const invalidateLearnersPage = async () => {
    try {
        await footerService.learners((err, data) => {}, false);
    } catch (error) {
        console.log("invalidateLearnersPage cache invalidation Error",error)
    }
}

const invalidateAboutUs = async () => {
    try {
        await footerService.aboutUs((err, data) => {}, false);
    } catch (error) {
        console.log("invalidateAboutUs cache invalidation Error",error)
    }
}

const invalidateLeadership = async () => {
    try {
        await footerService.leadership((err, data) => {}, false);
    } catch (error) {
        console.log("invalidateLeadership cache invalidation Error",error)
    }
}

const invalidateTeam = async () => {
    try {
        await footerService.team((err, data) => {}, false);
    } catch (error) {
        console.log("invalidateTeam cache invalidation Error",error)
    }
}

const invalidateCareer = async () => {
    try {
        await footerService.career((err, data) => {}, false);
    } catch (error) {
        console.log("invalidateCareer cache invalidation Error",error)
    }
}

const invalidateTNM = async () => {
    try {
        await footerService.termandcondition((err, data) => {}, false);
    } catch (error) {
        console.log("invalidateTNM cache invalidation Error",error)
    }
}

const invalidatePP = async () => {
    try {
        await footerService.privacypolicy((err, data) => {}, false);
    } catch (error) {
        console.log("invalidatePP  cache invalidation Error",error)
    }
}

const invalidatSkills = async () => {
    try {
        await CategoryService.getSkills({query:{}}, (err, data) => {}, true);
    } catch (error) {
        console.log("Skills cache invalidation Error",error)
    }  
}
    
const invalidPopularCategories = async () => {
    try {
        await LearnContentService.getPopularCategories({query:{}}, true);
    } catch (error) {
        console.log("Popular Categories cache invalidation Error",error)
    }  
}

const invalidateFacilities = async () => {
    try {
        await ProviderService.invalidateFacilities( (err, data) => {}, false);
    } catch (error) {
        console.log("Facilities cache invalidation Error",error)
    }  
}




   
module.exports = {
    invalidatePartnerWithUs,
    invalidateLearnersPage,
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
    invalidatSkills,
    invalidPopularCategories,
    invalidateFacilities
}
