const elasticService = require("./elasticService");
const { paginate, getSubCategoriesByType} = require('../utils/general');
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();
const recommendationService = require("./recommendationService");
let RecommendationService = new recommendationService();
const {generateMetaInfo} = require('../utils/metaInfo');
module.exports = class homePageService {

  async getHomePageContent(req) {
    let data = {};
    try {
      const query = {
        "bool": {
          "filter": [
              { "term": { "id": 1 } }
          ]
      }
      };
      const payload = {
        "size": 1
      };

      let cacheData = await RedisConnection.getValuesSync('home-page');
      let result = cacheData;

      if (cacheData.noCacheData) {
        result = await elasticService.search('home-page', query, payload, ["top_categories", "top_partners_by_category", "top_institutes_by_region", "course_recommendation_categories", "learn_path_recommendation_categories", "", "most_popular_article_categories", "trending_article_categories", "meta_description", "meta_keywords"]);
      
        // check if course recomndation categories have minimum 4 courses 
        if (result.hits[0]._source.course_recommendation_categories && result.hits[0]._source.course_recommendation_categories) {
          result.hits[0]._source.course_recommendation_categories = await Promise.all(
            result.hits[0]._source.course_recommendation_categories.map(async (category) => {
              let reqObj = {
                query: {
                  category: category.name
                }
              }
              let recommendation = await RecommendationService.getPopularCourses(reqObj)
              if (recommendation.success && recommendation.data && recommendation.data.list && recommendation.data.list.length > 3) {
                return category
              } else {
                return null
              }

            })
          )

          result.hits[0]._source.course_recommendation_categories = result.hits[0]._source.course_recommendation_categories.filter(category => category != null)

        }

        // check if learn path  recomndation categories have minimum 4 learn paths 
        if (result.hits[0]._source.learn_path_recommendation_categories && result.hits[0]._source.learn_path_recommendation_categories) {
          result.hits[0]._source.learn_path_recommendation_categories = await Promise.all(
            result.hits[0]._source.learn_path_recommendation_categories.map(async (category) => {
              let reqObj = {
                query: {
                  category: category.name
                }
              }
              let recommendation = await RecommendationService.getPopularLearnPaths(reqObj)

              if (recommendation.success && recommendation.data && recommendation.data.list && recommendation.data.list.length > 3) {
                return category

              } else {
                return null
              }

            })
          )
          result.hits[0]._source.learn_path_recommendation_categories = result.hits[0]._source.learn_path_recommendation_categories.filter(category => category != null)
        }

        // check if most popular article categories have minimum 6 articles
        if (result.hits[0]._source.most_popular_article_categories && result.hits[0]._source.most_popular_article_categories) {
          result.hits[0]._source.most_popular_article_categories = await Promise.all(
            result.hits[0]._source.most_popular_article_categories.map(async (category) => {
              let reqObj = {
                query: {
                  category: category.name
                }
              }
              let recommendation = await RecommendationService.getPopularArticles(reqObj)

              if (recommendation.success && recommendation.data && recommendation.data.list && recommendation.data.list.length > 5) {
                return category

              } else {
                return null
              }

            })
          )
          result.hits[0]._source.most_popular_article_categories = result.hits[0]._source.most_popular_article_categories.filter(category => category != null)
        }

        // check if most trending article categories have minimum 6 articles
        if (result.hits[0]._source.trending_article_categories && result.hits[0]._source.trending_article_categories) {
          result.hits[0]._source.trending_article_categories = await Promise.all(
            result.hits[0]._source.trending_article_categories.map(async (category) => {
              let reqObj = {
                query: {
                  category: category.name,
                  subType:'Trending'
                }
              }
              let recommendation = await RecommendationService.getPopularArticles(reqObj)

              if (recommendation.success && recommendation.data && recommendation.data.list && recommendation.data.list.length > 5) {
                return category

              } else {
                return null
              }

            })
          )
          result.hits[0]._source.trending_article_categories = result.hits[0]._source.trending_article_categories.filter(category => category != null)
        }
        
        await RedisConnection.set('home-page', result);
        RedisConnection.expire('home-page', process.env.CACHE_EXPIRE_HOME_PAGE);
      }
      if (result.hits && result.hits.length) {
        data = result.hits[0]._source
        data.meta_information = await generateMetaInfo('HOME_PAGE', data)
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
        "bool": {
          "filter": [
              { "term": { "id": 1 } }
          ]
      }
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
        "bool": {
          "filter": [
              { "term": { "id": 1 } }
          ]
      }
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
        "bool": {
          "filter": [
              { "term": { "id": 1 } }
          ]
      }
      };
      const payload = {
        "size": 1
      };

      let cacheData = await RedisConnection.getValuesSync('home-page-top-partners-by-categories');

      if (cacheData.noCacheData) {
        let result = await elasticService.search('home-page', query, payload, ["top_partners_by_category"]);
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
        let data = {
          total: cacheData.length,
          page,
          limit,
          partners: await paginate(cacheData, page, limit)
        }
        return { success: true, data: data }
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
        "bool": {
          "filter": [
              { "term": { "id": 1 } }
          ]
      }
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
    try {
      const query = {
        "bool": {
          "filter": [
              { "term": { "id": 1 } }
          ]
      }
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
        let data = {
          total: cacheData.length,
          page,
          limit,
          partners: await paginate(cacheData, page, limit)
        }
        return { success: true, data: data }
      }

      return { success: false, data: null }

    } catch (error) {
      console.log("Error fetching top institutes in home page", error);
      return { success: false, data: null }
    }
  }

  async getCategoriesWithMostCourses(subCategoryType) {

    const cacheName = `categories-with-most-courses-${subCategoryType}`;

    const cacheData = await RedisConnection.getValuesSync(cacheName);
    if (!cacheData.noCacheData) return cacheData;

    const subCategories = getSubCategoriesByType(subCategoryType);

    const elasticQuery = {

      bool: {
        should: subCategories.map((subCategory) => (
          {
            "term": {
              "sub_categories.keyword": subCategory
            }
          })
        )
      }
    }

    const aggs = {
      sub_categories_count: {
        composite: {
          size: 100,
          sources: [
            {
              sub_categories: {
                terms: {
                  field: "sub_categories.keyword"
                }
              }
            }
          ]
        },
        aggs: {
          doc_count: {
            value_count: {
              field: "_index"
            }
          },
          sort_by_doc_count: {
            bucket_sort: {
              sort: [
                {
                  doc_count: {
                    order: "desc"
                  }
                }
              ]
            }
          }
        }
      }
    }

    const esResult = await elasticService.searchWithAggregate('learn-content', elasticQuery, { size: 0, aggs: aggs });
    return esResult;

  }

}

