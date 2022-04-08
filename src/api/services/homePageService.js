const elasticService = require("./elasticService");
const articleService = require('./articleService');
const sectionService = require('./sectionService');
const models = require("../../../models");
const {generateMetaInfo} = require('../utils/general');

const learnContentService = require("./learnContentService");
let LearnContentService = new learnContentService();
const ArticleService = new articleService();
const SectionService = new sectionService();

const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();

const USER_RECOMMENDED_SECTIONS = ['jobTitle', 'wishlist', 'enquiries'];
const MAX_ENTRY_PER_RECOMMENDED_SECTION = 3;


const searchCourseIdsByQueryString = async(queryString) => {
  let query = { 
    "bool": {
        "must": [
            {term: { "status.keyword": 'published' }}                
        ],
        "filter": []
    }
  };
  query.bool.must.push( 
    {
      "query_string" : {
          "query" : `*${queryString}*`,
          "fields" : ['title','categories','sub_categories','topics'],
          "analyze_wildcard" : true,
          "allow_leading_wildcard": true
      }
    }
  );
  const result = await elasticService.search('learn-content', query, {from: 0, size: MAX_ENTRY_PER_RECOMMENDED_SECTION});
  if(result.total && result.total.value > 0){
      return result.hits.map(o => o['_id']);
  }else{
      return [];
  }
};

const getAggregatedCategoriesByCourseIds = async(courseIds) => {
  let categories = [];
  const query = {
    "query": {
      "ids": {
        "values": courseIds
      }
    },
    "size": 0,
    "aggs": {
      "categories": {
        "terms": {
          "field": "categories.keyword",
          "size": 100
        }
      }
    }
  };
  const result = await elasticService.plainSearch('learn-content', query);
  if(result.aggregations){
    let categoriesData = result.aggregations.categories.buckets;
    categories = categoriesData.map(o => o['key']);
  }
  return categories;
};


const getCourseIdsByCategories = async(categories, excludeIds) => {
  let query = { 
    "bool": {
        "must": [
            {term: { "status.keyword": 'published' }}                
        ],
        "must_not": [
          {
            "ids": {
              "values": excludeIds
            }
          }
        ],
        "filter": [
          {                              
            "terms": {
                "categories.keyword": categories
            }
          }
        ]
    }
  };
  const result = await elasticService.search('learn-content', query, {from: 0, size: MAX_ENTRY_PER_RECOMMENDED_SECTION});
  if(result.total && result.total.value > 0){
      return result.hits.map(o => o['_id']);
  }else{
      return [];
  }
};

const getJobTitle = async(user) => {
  let jobTitle = null;
  let where = {
    userId: user.userId,
    key: 'jobTitle',
    metaType: 'primary'
  };
  let jobTitleRecord = await models.user_meta.findOne({where});
  if(jobTitleRecord){
    let jsonValue = JSON.parse(jobTitleRecord.value);
    if(jsonValue && jsonValue.label)
    {
      jobTitle = jsonValue.label;
    }    
  }
  return jobTitle;
};

const fetchWishListCourseIds = async (user) => {
  let wishlistIds = [];
  let where = {
      userId: user.userId,
      key: 'course_wishlist',
  }

  let wishlistRecords = await models.user_meta.findAll({
      attributes:['value'],
      where
  });
  if(wishlistRecords){
    wishlistIds = wishlistRecords.map((rec) => rec.value);
  }
  wishlistIds = wishlistIds.filter(function (el) {
    return el != null;
  });
  return wishlistIds;
}

const fetchEnquiryCourseIds = async (user) => {
  let enquiryCourseIds = [];
  let where = {
      userId: user.userId,
      targetEntityType: 'course',
      formType: 'enquiry'
  };

  let enquiryRecords = await models.form_submission.findAll({
      attributes:['targetEntityId'],
      where
  });
  if(enquiryRecords){
    enquiryCourseIds = enquiryRecords.map((rec) => rec.targetEntityId);
  }
  enquiryCourseIds = enquiryCourseIds.filter(function (el) {
    return el != null;
  });
  return enquiryCourseIds;
}


const getBlogHomeContent = async() => {
    let data = {}
    try {
      const query = {
        "match_all": {}
      };
      const result = await elasticService.search('blog_home_page', query)
      if (result.hits && result.hits.length) {
        let blogHomedata = result.hits[0]._source;
        
        if (blogHomedata.featured_articles && blogHomedata.featured_articles.length) {
            data.featured_articles = await ArticleService.getArticleByIds(blogHomedata.featured_articles, false);
          }
          
          if (blogHomedata.recent_articles && blogHomedata.recent_articles.length) {
            data.recent_articles = await ArticleService.getArticleByIds(blogHomedata.recent_articles);
          }
      }
    } catch (error) {
      console.log("Error fetching blog home page content from elastic <> ", error);
    }
    return data;
  }


  const getShuffledArr = (arr) => {
    return [...arr].map( (_, i, arrCopy) => {
        var rand = i + ( Math.floor( Math.random() * (arrCopy.length - i) ) );
        [arrCopy[rand], arrCopy[i]] = [arrCopy[i], arrCopy[rand]]
        return arrCopy[i]
    })
  }

const formatHomepageData = async(data) => {

    const blogHomeData = await getBlogHomeContent();
    if(blogHomeData['featured_articles']){
        data.featured_articles = blogHomeData.featured_articles.filter(function (el) {
            return el != null;
        });
    }
    if(blogHomeData['recent_articles']){
        data.recent_articles = blogHomeData.recent_articles.filter(function (el) {
            return el != null;
        });
    }

    try{
    data.advice_sections = await SectionService.getCategoryTree();
    }catch(err){
        console.log("err <> ", err);
    }

    if(data.top_partners.length || data.top_institutes.length){
      let combined = [].concat(data.top_partners, data.top_institutes);
      data.top_partner_institutes = getShuffledArr(combined);
    }

    return data;
};

module.exports = class homePageService {  

  async getHomePageContent(req, callback) {
   
    let data = {};
    try {
      const query = {
        "match_all": {}
      };
      const payload = {
        "size":100
      };
           
      let cacheData = await RedisConnection.getValuesSync('home-page'); 
      let  result = cacheData;             

      if(cacheData.noCacheData) 
      {
        result = await elasticService.search('home-page', query,payload);
        await RedisConnection.set('home-page', result);
        RedisConnection.expire('home-page', process.env.CACHE_EXPIRE_HOME_PAGE);
      }
     
      if (result.hits && result.hits.length) {
        data = await formatHomepageData(result.hits[0]._source);
        return callback(null, { success: true, data })
      }
      return callback(null, { success: true, data:data })

    } catch (error) {
      console.log(error);
      return callback(null, { success: true, data: data })
    }
  }
}