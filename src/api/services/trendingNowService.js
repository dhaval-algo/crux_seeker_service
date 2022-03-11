const elasticService = require("./elasticService");
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();
const LearnContentService = require('./learnContentService');
const learnContentService = new LearnContentService();
const ProviderService = require('./providerService');
const providerService = new ProviderService();
const ArticleService = require('./articleService');
const articleService = new ArticleService();




const getTrendingNow = async () => {

    try {
        let trendingNowData = [];
        const cacheName = 'trending-now';
        const cacheData = await RedisConnection.getValuesSync(cacheName);

        if (!cacheData.noCacheData) {
            trendingNowData = cacheData;
        } else {

            const esQuery = {

                match_all: {}
            }

            const result = await elasticService.search('trending-now', esQuery, {});

            if (result.hits && result.hits.length) {
                trendingNowData = result.hits[0]._source.trending_nows;
                RedisConnection.set(cacheName, trendingNowData);
                RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_TRENDING_NOW || 86400);
            }
        }

        return trendingNowData;

    } catch (error) {
        console.log("error while fetching trending now ", error);
        return [];

    }
}


const getTrendingNowCategories = async (req, callback) => {

    try {

        const trendingNowData = await getTrendingNow();
        const categories = [];

        for (const category in trendingNowData) {

            const categoryData = {};
            categoryData.description = trendingNowData[category].description;
            categoryData.id = trendingNowData[category].category.id;
            categoryData.slug = trendingNowData[category].category.slug;
            categoryData.name = trendingNowData[category].category.name;

            categories.push(categoryData);
        }


        callback(null, { success: true, message: "list fetched successfully", data: categories });

    } catch (error) {

        console.log("error while fetching trending now categories", error);
        callback(null, { success: false, message: "failed to fetch", data: [] });
    }
}


const getTrendingNowList = async (req, callback) => {

    try {

        const { category, page = 1, limit = 5 } = req.query;
        const offset = (page - 1) * limit;
        const trendingNowData = await getTrendingNow();
        
        let list = [];
        if (trendingNowData[category]) {
            list = trendingNowData[category].list;

        }

        list = list.slice(offset, offset + limit);
        list = list.map((data) => {
            return {
                title: data.title,
                description: data.description,
                slug: data.slug,
                image: data.image,
                type: data.type
            }
        });

        callback(null, { success: true, message: "list fetched successfully", data: list });


    } catch (error) {
        console.log("error while fetching trending now list", error);
        callback(null, { success: false, message: "failed to fetch", data: [] });

    }

}


const getTrendingNowComponentData = async (req, callback) => {

    try {

        const { component_slug, category } = req.query;
        const trendingNowData = await getTrendingNow();

        let component = null;
        let list = [];
        if (trendingNowData[category]) {
            list = trendingNowData[category].list;

        }

        for (const comp of list) {
            if (comp.slug == component_slug) {
                component = comp;
                break;
            }
        }


        if (component) {

            if (component.type == 'learn_content') {
                req.query.courseIds = component.learn_contents.join(',');
                await learnContentService.getLearnContentList(req, (err, result) => {

                    component.learn_contents = result.data;

                }, false);

            }

            else if (component.type == 'institute') {
                req.query.instituteIds = component.institutes.join(',');
                await providerService.getProviderList(req, (err, result) => {

                    component.institutes = result.data
                }, false);

            }
            else if (component.type == 'article') {

                req.query.articleIds = component.articles.map((id) => `ARTCL_PUB_${id}`);
                await articleService.getArticleList(req, (err, result) => {

                    component.articles = result.data;
                });
            }

            const careerviraAdvices = component.careervira_advices.map((id) => `ARTCL_PUB_${id}`);

            await articleService.getArticleList({query:{articleIds:careerviraAdvices}}, (err, result) => {
                component.careervira_advices = result.data.list;
            });
        }

        callback(null, { success: true, message: "data fetched successfully", data: component?component:{} });


    } catch (error) {
        console.log("error while fetching trending now component data", error);
        callback(null, { success: false, message: "failed to fetch", data: error.meta });
    }

}


module.exports = {
    getTrendingNowCategories,
    getTrendingNowList,
    getTrendingNowComponentData

}