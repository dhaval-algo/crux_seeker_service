const elasticService = require("./elasticService");
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();
const LearnContentService = require('./learnContentService');
const learnContentService = new LearnContentService();
const ProviderService = require('./providerService');
const providerService = new ProviderService();
const ArticleService = require('./articleService');
const articleService = new ArticleService();




const getTrendingNow = async (type, fields, category = '_', component_slug = '_') => {

    try {
        let trendingNowData = [];
        const cacheName = 'trending-now-' + type + '-' + category + '-' + component_slug 
        const cacheData = await RedisConnection.getValuesSync(cacheName);

        if (!cacheData.noCacheData) {
            trendingNowData = cacheData;
        } else {

            const esQuery = {
                bool :  {
                    must: [{ match: {_id: type }}]
                }
            }
            if(category != '_')
                esQuery.bool.must.push({ exists: { field: "trending_nows." + category }})
            if(component_slug != '_')
                esQuery.bool.must.push({ match: { [`trending_nows.${category}.list.slug`]: component_slug }})

            const result = await elasticService.search('trending-now', esQuery, {}, fields);

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
        const { type = "category_list_homepage" } = req.query;
        const fields = {
            "includes": ["trending_nows.*.category.slug","trending_nows.*.category.name",
        "trending_nows.*.category.id","trending_nows.*.description"],
        "excludes": ["trending_nows.*.list"]
        }
        const trendingNowData = await getTrendingNow(type, fields);
        let categories = [], categoryData = {};

        for (const category in trendingNowData)
        {   
            categoryData.description = trendingNowData[category].description;
            categoryData.id = trendingNowData[category].category.id;
            categoryData.slug = trendingNowData[category].category.slug;
            categoryData.name = trendingNowData[category].category.name;
            categories.push(categoryData)
        }


        callback(null, { success: true, message: "list fetched successfully", data: categories });

    } catch (error) {

        console.log("error while fetching trending now categories", error);
        callback(null, { success: false, message: "failed to fetch", data: [] });
    }
}


const getTrendingNowList = async (req, callback) => {

    try {

        const { category, page = 1, limit = 5, type = "category_list_homepage" } = req.query;
        const offset = (page - 1) * limit;
        const fields = [`trending_nows.${category}.list.slug`,`trending_nows.${category}.list.title`,
        `trending_nows.${category}.list.type`,`trending_nows.${category}.list.image`,
        `trending_nows.${category}.list.description`]

        const trendingNowData = await getTrendingNow(type, fields, category);
        let list = trendingNowData[category].list.slice(offset, offset + limit);

        callback(null, { success: true, message: "list fetched successfully", data: { list } });


    } catch (error) {
        console.log("error while fetching trending now list", error);
        callback(null, { success: false, message: "failed to fetch", data: { list: [] } });

    }

}


const getTrendingNowComponentData = async (req, callback) => {

    try {

        const { component_slug, category, type = "category_list_homepage"} = req.query;
        const fields = [`trending_nows.${category}`]
        const trendingNowData = await getTrendingNow(type, fields, category, component_slug);

        let component = trendingNowData[category].list[0]


        if (component) {

            component.categoryName = trendingNowData[category].category.name;
            
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

            const careerviraAdvicesIds = component.careervira_advices.map((id) => `ARTCL_PUB_${id}`);

            await articleService.getArticleList({ query: { articleIds: careerviraAdvicesIds } }, (err, result) => {
                component.careervira_advices = result.data.list;
            });
        }

        callback(null, { success: true, message: "data fetched successfully", data: component ? component : {} });


    } catch (error) {
        console.log("error while fetching trending now component data", error);
        callback(null, { success: false, message: "failed to fetch", data: error });
    }

}


module.exports = {
    getTrendingNowCategories,
    getTrendingNowList,
    getTrendingNowComponentData

}