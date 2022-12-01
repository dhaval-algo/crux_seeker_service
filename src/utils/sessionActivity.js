const RedisConnection = require("../services/v1/redis");
const redisConnection = new RedisConnection();
const elasticService = require("../api/services/elasticService");

const kpiKeys = ['topics', 'categories', 'sub_categories', 'skills'];
const sessionKPIsCount = {

    'topics': process.env.TOPICS_SESSION_KPIS_COUNT || 6,
    'categories': process.env.CATEGORIES_SESSION_KPIS_COUNT || 3,
    'sub_categories': process.env.SUB_CATEGORIES_SESSION_KPIS_COUNT || 6,
    'skills': process.env.SKILLS_SESSION_KPIS_COUNT || 10
}

const actionWeight = {
    click: 1 || process.env.SESSION_KPI_CLICK_WEIGHT,
    wishlist: 1.5 || process.env.SESSION_KPI_WISHLIST_WEIGHT,
    enquiry: 2 || process.env.SESSION_KPI_ENQUIRY_WEIGHT
}

const getRecentSessionKPIs = async (userId) => {

    const cacheName = `recent-session-kpis-${userId}`;
    const cacheData = await redisConnection.getValuesSync(cacheName);
    if (!cacheData.noCacheData) {

        return cacheData;

    }

    return {};

}

const getAllTimeSessionKPIs = async (userId) => {

    const cacheName = `all-time-session-kpis-${userId}`;
    const cacheData = await redisConnection.getValuesSync(cacheName);
    if (!cacheData.noCacheData) {

        return cacheData;

    }

    return {};

}

const computeRecentSessionKPIs = async (userId, newSessionKPIs) => {
    const sessionKPIs = await getRecentSessionKPIs(userId);
    for (const kpiKey of kpiKeys) {

        if (!sessionKPIs[kpiKey]) sessionKPIs[kpiKey] = [];
        const existingKPIs = sessionKPIs[kpiKey];

        if (!newSessionKPIs[kpiKey]) newSessionKPIs[kpiKey] = [];

        const newKPIs = newSessionKPIs[kpiKey];

        let finalKPIs = [...newKPIs, ...existingKPIs];
        finalKPIs = Array.from(new Set(finalKPIs));
        let removeElementsCount = finalKPIs.length - sessionKPIsCount[kpiKey];

        while (removeElementsCount > 0) {

            finalKPIs.pop();
            removeElementsCount -= 1;
        }

        sessionKPIs[kpiKey] = finalKPIs;

    }

    return sessionKPIs;


}

const computeAllTimeSessionKPIs = async (userId, newSessionKPIs, action) => {

    const sessionKPIs = await getAllTimeSessionKPIs(userId);
    for (const kpiKey of kpiKeys) {

        if (!sessionKPIs[kpiKey]) sessionKPIs[kpiKey] = {};
        if (!newSessionKPIs[kpiKey]) newSessionKPIs[kpiKey] = [];

        for (newKPI of newSessionKPIs[kpiKey]) {

            if (newKPI in sessionKPIs[kpiKey]) sessionKPIs[kpiKey][newKPI] += actionWeight[action];
            else sessionKPIs[kpiKey][newKPI] = actionWeight[action];
        }


    }


    if (!sessionKPIs.topKPIs) sessionKPIs.topKPIs = {};

    for (const kpiKey of kpiKeys) {

        const topKPIs = Object.keys(sessionKPIs[kpiKey]).sort((a, b) => sessionKPIs[kpiKey][b] - sessionKPIs[kpiKey][a]);
        sessionKPIs.topKPIs[kpiKey] = topKPIs.slice(0, 2);

    }

    return sessionKPIs;

}




const saveSessionKPIs = async (userId, newSessionKPIs, action) => {
    const { courses = [], courseIds = [] } = newSessionKPIs;
    const recentSessionKPIsCachename = `recent-session-kpis-${userId}`;
    const allTimeSessionKPIsCachename = `all-time-session-kpis-${userId}`;

    for (const kpiKey of kpiKeys) {
        if (!newSessionKPIs[kpiKey]) newSessionKPIs[kpiKey] = [];
    }

    if (courseIds.length) {

        const esQuery = {
            ids: {
                values: courseIds
            }
        };

        const result = await elasticService.search('learn-content', esQuery, { size: 10 }, fields = ["topics", "categories", "sub_categories", "skills"]);
        if (result && result.hits && result.hits.length) {

            for (const hit of result.hits) {
                const course = hit._source;
                if (course.topics) newSessionKPIs.topics.push(...course.topics);
                if (course.categories) newSessionKPIs.categories.push(...course.categories);
                if (course.sub_categories) newSessionKPIs.sub_categories.push(...course.sub_categories);
                if (course.skills) newSessionKPIs.skills.push(...course.skills);

            }
        }

    }

    for (const course of courses) {

        if (course.topics_list && course.topics_list.length) {
            const topics = course.topics_list.map((topic) => topic.default_display_label);
            newSessionKPIs.topics.push(...topics);
        }
        if (course.categories && course.categories.length) newSessionKPIs.categories.push(...course.categories);
        if (course.sub_categories && course.sub_categories.length) newSessionKPIs.sub_categories.push(...course.sub_categories);
        if (course.skill_tags && course.skill_tags.length) newSessionKPIs.skills.push(...course.skill_tags);
    }

    const recentSessionKPIs = await computeRecentSessionKPIs(userId, newSessionKPIs);
    redisConnection.set(recentSessionKPIsCachename, recentSessionKPIs);
    redisConnection.expire(recentSessionKPIsCachename, process.env.CACHE_EXPIRE_RECENT_SESSION_KPIS || 1800);

    const allTimeSessionKPIs = await computeAllTimeSessionKPIs(userId, newSessionKPIs, action);
    redisConnection.set(allTimeSessionKPIsCachename, allTimeSessionKPIs);
    redisConnection.expire(allTimeSessionKPIsCachename, process.env.CACHE_EXPIRE_ALL_TIME_SESSION_KPIS || 2628000);

}


module.exports = {
    saveSessionKPIs,
    getAllTimeSessionKPIs,
    getRecentSessionKPIs


};