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


  const getUserRecommendedCourses = async(user, static_recommended_course_ids, currency) => {
      let recommended_courses = [];
      let recommended_course_ids = [];
      const ideal_recommended_count = USER_RECOMMENDED_SECTIONS.length * MAX_ENTRY_PER_RECOMMENDED_SECTION;
      
      try{
        const jobTitle = await getJobTitle(user);
        if(jobTitle){
          try{
          const courseIdsByJobTitle = await searchCourseIdsByQueryString(jobTitle);
          if(courseIdsByJobTitle.length){
            recommended_course_ids = [...recommended_course_ids, ...courseIdsByJobTitle];
          }        
          }catch (ex){
            console.log("Job title Error <> ", ex);
          }
        }
      }catch (ex){
        console.log("Job title recommended course Error <> ", ex);
      }

      try{
        const wishlistIds = await fetchWishListCourseIds(user);
        if(wishlistIds.length > 0){
          const categories = await getAggregatedCategoriesByCourseIds(wishlistIds);
          if(categories.length){
            try{
              const wishListCourseIds = await getCourseIdsByCategories(categories, wishlistIds);
              if(wishListCourseIds.length){
                recommended_course_ids = [...recommended_course_ids, ...wishListCourseIds];
              }
            }catch (ex){
              console.log("Wish course ids by category Error <> ", ex);
            }
          }
        }
      }catch (ex){
        console.log("wishlist recommended course Error <> ", ex);
      }


      try{
        const enquiryIds = await fetchEnquiryCourseIds(user);
        if(enquiryIds.length > 0){
          const enquiryCategories = await getAggregatedCategoriesByCourseIds(enquiryIds);
          if(enquiryCategories.length){
            try{
              const enquiryCourseIds = await getCourseIdsByCategories(enquiryCategories, enquiryIds);
              if(enquiryCourseIds.length){
                recommended_course_ids = [...recommended_course_ids, ...enquiryCourseIds];
              }
            }catch (ex){
              console.log("Enquiry course ids by category Error <> ", ex);
            }
          }
        }
      }catch (ex){
        console.log("Enquiry recommended course Error <> ", ex);
      }

      try{
        if(recommended_course_ids.length < ideal_recommended_count){
          const remaining_count = (ideal_recommended_count - recommended_course_ids.length);
          if(static_recommended_course_ids.length > 0){
            const remainingIds = static_recommended_course_ids.slice(0, remaining_count);
            recommended_course_ids = [...recommended_course_ids, ...remainingIds];
          }
        }
      }catch (ex){
        console.log("Merging default Error <> ", ex);
      }

      try{
      if(recommended_course_ids.length > 0){
        let courses = await LearnContentService.getCourseByIds({query: {currency: currency, ids: recommended_course_ids.join(",")}});
        recommended_courses = courses.filter(function (el) {
            return el != null;
        });
        
      }
    }catch(ex){
      console.log("Error <> ", ex);
    }
    try{
      if(recommended_courses.length<3){
        try{
          const randCourses = await searchCourseIdsByQueryString('marketing');
          if(randCourses.length>0){
            recommended_course_ids = [...recommended_course_ids, ...randCourses];
          }
           
        }catch (ex){
          console.log("Rand courses Error <> ", ex);
        }
      }
    }catch (ex){
      console.log("Rand courses recommended course Error <> ", ex);
    }

    try{
      if(recommended_course_ids.length > 0){
        let courses = await LearnContentService.getCourseByIds({query: {currency: currency, ids: recommended_course_ids.join(",")}});
        recommended_courses = courses.filter(function (el) {
            return el != null;
        });
        
      }
    }catch(ex){
      console.log("Error <> ", ex);
    }

      return recommended_courses;
  };


const formatHomepageData = async(data, user = null, currency) => {

    if(user){
      try{
        data.recommended_courses = await getUserRecommendedCourses(user, data.recommended_courses, currency);  
      }catch (ex){
        data.recommended_courses = [];
        console.log("Error getting recommended courses <> ", ex);
      } 
    }else{
      data.recommended_courses = [];
    }
    
    /* if(data.recommended_courses.length > 0 && user){
        let courses = await LearnContentService.getCourseByIds({query: {currency: currency, ids: data.recommended_courses.join(",")}});
        data.recommended_courses = courses.filter(function (el) {
            return el != null;
        });
    }else{
        data.recommended_courses = [];
    } */
    let i = 0;
    for(trending_now of data.trending_now)
    {
      let meta_information = await generateMetaInfo  ('trending-now', trending_now);
      data.trending_now[i].meta_information = meta_information;
      i++;
    }

     if(!user){
         data.trending_now = [];
     }

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
        data = await formatHomepageData(result.hits[0]._source, req.user, req.query['currency'])
        return callback(null, { success: true, data })
      }
      return callback(null, { success: true, data:data })

    } catch (error) {
      return callback(null, { success: true, data: data })
    }
  }
}