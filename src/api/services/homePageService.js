const elasticService = require("./elasticService");
const {paginate} = require('../utils/general');
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
        "size":1
      };
           
      let cacheData = await RedisConnection.getValuesSync('home-page'); 
      let  result = cacheData;             

      if(cacheData.noCacheData) 
      {
        result = await elasticService.search('home-page', query,payload,["top_categories","top_partners","top_institutes","category_recommendations","lrn_pth_recomndtn_categories"]);
        await RedisConnection.set('home-page', result);
        RedisConnection.expire('home-page', process.env.CACHE_EXPIRE_HOME_PAGE);
      }     
      if (result.hits && result.hits.length) {
        data =  result.hits[0]._source
        return { success: true, data }
      }
      return { success: false, data:null }

    } catch (error) {
      console.log("Error fetching top categories in home page", error);
      return { success: false, data:null }
    }
  } 	

  async getHomePageTopCategories(req) {
    let {page =1, limit= 5} = req.query
    
    let data = {};
    try {
      const query = {
        "match_all": {}
      };
      const payload = {
        "size":1
      };
           
      let cacheData = await RedisConnection.getValuesSync('home-page-top-categories'); 
      let  result = cacheData;             

      if(cacheData.noCacheData) 
      {
        result = await elasticService.search('home-page', query,payload,["top_categories"]);
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
      return { success: false, data:null }

    } catch (error) {
      console.log("Error fetching top categories in home page", error);
      return { success: false, data:null }
    }
  }

  async getHomePageTopPartners(req) {
    let {page =1, limit= 5} = req.query
    
    let data = {};
    try {
      const query = {
        "match_all": {}
      };
      const payload = {
        "size":1
      };
           
      let cacheData = await RedisConnection.getValuesSync('home-page-top-partners'); 
      let  result = cacheData;             

      if(cacheData.noCacheData) 
      {
        result = await elasticService.search('home-page', query,payload,["top_partners"]);
        await RedisConnection.set('home-page-top-partners', result);
        RedisConnection.expire('home-page-top-partners', process.env.CACHE_EXPIRE_HOME_PAGE);
      }
     
      if (result.hits && result.hits.length) {
        data = {
          total: result.hits[0]._source.top_partners.length,
          page,
          limit,
          partners: await paginate(result.hits[0]._source.top_partners, page, limit)
        }
        return { success: true, data }
      }
      return { success: false, data:null }

    } catch (error) {
      console.log("Error fetching top home-page-top-partners in home page", error);
      return { success: false, data:null }
    }
  }

  async getHomePageTopInstitutes(req) {
    let {page =1, limit= 5} = req.query
    
    let data = {};
    try {
      const query = {
        "match_all": {}
      };
      const payload = {
        "size":1
      };
           
      let cacheData = await RedisConnection.getValuesSync('home-page-top-institutes'); 
      let  result = cacheData;             

      if(cacheData.noCacheData) 
      {
        result = await elasticService.search('home-page', query,payload,["top_institutes"]);
        await RedisConnection.set('home-page-top-institutes', result);
        RedisConnection.expire('home-page-top-institutes', process.env.CACHE_EXPIRE_HOME_PAGE);
      }
     
      if (result.hits && result.hits.length) {
        data = {
          total: result.hits[0]._source.top_institutes.length,
          page,
          limit,
          institutes: await paginate(result.hits[0]._source.top_institutes, page, limit)
        }
        return { success: true, data }
      }
      return { success: false, data:null }

    } catch (error) {
      console.log("Error fetching top institutes in home page", error);
      return { success: false, data:null }
    }
  }
}