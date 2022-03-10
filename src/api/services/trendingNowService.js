const elasticService = require("./elasticService");
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();


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
        const categories = trendingNowData.map((trendingNow) => {
            return { description: trendingNow.description, id: trendingNow.category.slug, name: trendingNow.category.name, slug: trendingNow.category.slug };
        });
        callback(null, { success: true, message: "list fetched succesfully", data: categories });

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

        for (const trendingNow of trendingNowData) {
            if (trendingNow.category.name == category || trendingNow.category.slug == category) {
                list = trendingNow.list;
                break;

            }

        };

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

module.exports = {

    getTrendingNowCategories,
    getTrendingNowList

}