const elasticService = require("./elasticService");
const { paginate } = require('../utils/general');
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();
module.exports = class homePageService {

  async getHomePageContent(req) {
    let data = {};
    try {
      const query = {
        "match_all": {}
      };
      const payload = {
        "size": 1
      };

      let cacheData = await RedisConnection.getValuesSync('home-page');
      let result = cacheData;

      if (cacheData.noCacheData) {
        result = await elasticService.search('home-page', query, payload, ["top_categories", "top_partners_by_category", "top_institutes_by_region", "course_recommendation_categories", "learn_path_recommendation_categories", "", "most_popular_article_categories", "trending_article_categories"]);
        await RedisConnection.set('home-page', result);
        RedisConnection.expire('home-page', process.env.CACHE_EXPIRE_HOME_PAGE);
      }
      if (result.hits && result.hits.length) {
        data = result.hits[0]._source
        return { success: true, data }
      }
      return { success: false, data: null }

    } catch (error) {
      console.log("Error fetching top categories in home page", error);
      return { success: false, data: null }
    }
  }

  async getHomePageTopCategories(req) {
    let { page = 1, limit = 5 } = req.query

    let data = {};
    try {
      const query = {
        "match_all": {}
      };
      const payload = {
        "size": 1
      };

      let cacheData = await RedisConnection.getValuesSync('home-page-top-categories');
      let result = cacheData;

      if (cacheData.noCacheData) {
        result = await elasticService.search('home-page', query, payload, ["top_categories"]);
        await RedisConnection.set('home-page-top-categories', result);
        RedisConnection.expire('home-page-top-categories', process.env.CACHE_EXPIRE_HOME_PAGE);
      }

      if (result.hits && result.hits.length) {
        data = {
          total: result.hits[0]._source.top_categories.length,
          page,
          limit,
          categories: await paginate(result.hits[0]._source.top_categories, page, limit)
        }
        return { success: true, data }
      }
      return { success: false, data: null }

    } catch (error) {
      console.log("Error fetching top categories in home page", error);
      return { success: false, data: null }
    }
  }

  async getHomePageTopPartnersCategories(req) {

    let data = {};
    try {
      const query = {
        "match_all": {}
      };
      const payload = {
        "size": 1
      };

      let cacheData = await RedisConnection.getValuesSync('home-page-top-partners-categories');
      let result = cacheData;

      if (cacheData.noCacheData) {
        result = await elasticService.search('home-page', query, payload, ["top_partners_by_category"]);
        await RedisConnection.set('home-page-top-partners-categories', result);
        RedisConnection.expire('home-page-top-partners-categories', process.env.CACHE_EXPIRE_HOME_PAGE);
      }
      let categories = []
      if (result.hits && result.hits.length) {

        if (result.hits[0]._source.top_partners_by_category) {
          for (const [key, value] of Object.entries(result.hits[0]._source.top_partners_by_category)) {

            categories.push({ name: key })
          }
        }

        return { success: true, data: categories }
      }
      return { success: false, data: null }

    } catch (error) {
      console.log("Error fetching top home-page-top-partners in home page", error);
      return { success: false, data: null }
    }
  }

  async getHomePageTopPartnersByCategories(req) {
    let { page = 1, limit = 5, category } = req.query
    try {
      const query = {
        "match_all": {}
      };
      const payload = {
        "size": 1
      };

      let cacheData = await RedisConnection.getValuesSync('home-page-top-partners-by-categories');

      if (cacheData.noCacheData) {
        result = await elasticService.search('home-page', query, payload, ["top_partners_by_category"]);
        let data = null
        if (result.hits && result.hits.length) {

          data = {
            total: result.hits[0]._source.top_partners_by_category[category].length,
            page,
            limit,
            partners: await paginate(result.hits[0]._source.top_partners_by_category[category], page, limit)
          }
          await RedisConnection.set('home-page-top-partners-by-categories', result.hits[0]._source.top_partners_by_category[category]);
          RedisConnection.expire('home-page-top-partners-by-categories', process.env.CACHE_EXPIRE_HOME_PAGE);
          return { success: true, data: data }
        }

      }
      else {
        data = {
          total: cacheData.length,
          page,
          limit,
          partners: await paginate(cacheData, page, limit)
        }
        return { success: true, data: categories }
      }

      return { success: false, data: null }

    } catch (error) {
      console.log("Error fetching top home-page-top-partners in home page", error);
      return { success: false, data: null }
    }
  }

  async getHomePageTopInstitutesRegion(req) {
    try {
      const query = {
        "match_all": {}
      };
      const payload = {
        "size": 1
      };

      let cacheData = await RedisConnection.getValuesSync('home-page-top-institutes-region');
      let result = cacheData;

      if (cacheData.noCacheData) {
        let result = await elasticService.search('home-page', query, payload, ["top_institutes_by_region"]);
        await RedisConnection.set('home-page-top-institutes-region', result);
        RedisConnection.expire('home-page-top-institutes-region', process.env.CACHE_EXPIRE_HOME_PAGE);
      }

      if (result.hits && result.hits.length) {
        let regions = []
        if (result.hits && result.hits.length) {

          if (result.hits[0]._source.top_institutes_by_region) {
            for (const [key, value] of Object.entries(result.hits[0]._source.top_institutes_by_region)) {

              regions.push({ name: key.replace("_", " ") })
            }
          }

          return { success: true, data: regions }
        }
      }
      return { success: false, data: null }

    } catch (error) {
      console.log("Error fetching top institutes in home page", error);
      return { success: false, data: null }
    }
  }

  async getHomePageTopInstitutesByRegion(req) {
    let { page = 1, limit = 5, region } = req.query    
    let data = {};
    try {
      const query = {
        "match_all": {}
      };
      const payload = {
        "size": 1
      };
      region = region.replace(" ", "_")

      let cacheData = await RedisConnection.getValuesSync('home-page-top-institutes-by-region');

      if (cacheData.noCacheData) {
        let result = await elasticService.search('home-page', query, payload, ["top_institutes_by_region"]);

        let data = null
        if (result.hits && result.hits.length) {

          data = {
            total: result.hits[0]._source.top_institutes_by_region[region].length,
            page,
            limit,
            institutes: await paginate(result.hits[0]._source.top_institutes_by_region[region], page, limit)
          }
          await RedisConnection.set('home-page-top-institutes-by-region', result.hits[0]._source.top_institutes_by_region[region]);
          RedisConnection.expire('home-page-top-institutes-by-region', process.env.CACHE_EXPIRE_HOME_PAGE);
          return { success: true, data: data }
        }
      }
      else {
        data = {
          total: cacheData.length,
          page,
          limit,
          partners: await paginate(cacheData, page, limit)
        }
        return { success: true, data: categories }
      }

      return { success: false, data: null }

    } catch (error) {
      console.log("Error fetching top institutes in home page", error);
      return { success: false, data: null }
    }
  }
}

