const elasticService = require("./elasticService");
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();

const getTrendingNowCategories = async (req, callback) => {

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

        const categories = trendingNowData.map((trendingNow) => trendingNow.category);
        callback(null, { success: true, message: "list fetched succesfully", data: categories });

    } catch (error) {

        console.log("error while fetching trending now categories",error);
        callback(null, { success: false, message: "failed to fetch", data: { list: [] } });
    }
}




module.exports = {

    getTrendingNowCategories

}