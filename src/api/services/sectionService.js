const elasticService = require("./elasticService");
const articleService = require('./articleService');
const redisConnection = require('../../services/v1/redis');
const helperService = require("../../utils/helper");
const recommendationService = require("./recommendationService");
let RecommendationService = new recommendationService();
const ArticleService = new articleService()
const RedisConnection = new redisConnection();
const {formatImageResponse} = require('../utils/general');
const {generateMetaInfo} = require('../utils/metaInfo');
const buildSectionView = (section) => {
  return new Promise(async (resolve) => {
    try{
        let articles = [];
       
        // if (!!section.location_display_labels && !!section.location_display_labels.length) {
        //   let location_display_labels = await ArticleService.getArticleByIds(section.location_display_labels, true, true)
        //   section.location_display_labels =  location_display_labels.articles.filter(art => !!art)
        //   articles = [...new Set([...articles,...location_display_labels.articleSlugs])]
        // }
        let similar_articles = []
        for(const [key, value] of Object.entries(section.similar_articles)) {
          
            let similar = await ArticleService.getArticleByIds(value, true, true)
            articles = similar.articleSlugs
              
            similar_articles.push({title: key, articles: similar.articles, articleSlugs: articles})
        }
        section.similar_articles = similar_articles

        return resolve({data:section, articles});
    } catch (error) {
      return resolve({data:[], articles:[]});
    }
  })
  
}

const getActiveArticles =  (articles,returnSlugs) => {
  return new Promise(async(resolve) => {
    const query = {
      "query": {
        /* "ids": {
            "values": ids
        }, */
        "bool": {
          "must": [
            {term: { "status.keyword": 'published' }},
            {terms: { "id": articles }}
          ]
       }
      }
    
    }
  
    const resultT = await elasticService.plainSearch('article',query)
    let dataArray = []
    let articleSlugs = [];
    if(resultT.hits.hits){
      if(resultT.hits.hits && resultT.hits.hits.length > 0){
          let articles = resultT.hits.hits;
          for (let index = 0; index < articles.length; index++) {
            const element = articles[index];
            let artcl = await ArticleService.generateSingleViewData(element._source)
            if(typeof artcl !='undefined')
            {
                articleSlugs.push(artcl.slug);
                dataArray.push(artcl);
            }
             
          }
      }
    }
    if(returnSlugs) {
        return resolve({articles:dataArray, articleSlugs:articleSlugs})
    }
    return resolve(dataArray)
  })
}
module.exports = class sectionService {
  async getCategoryTree(req, callback) {
    try {
      // label": "Development",
      // "slug": "development",
      // "type": "category",
      // "count": 56,
      // "child": []
      const aggregateQ = {
        "query": {
          "bool": {
            "must": [
              {
                "term": {
                  "status.keyword": "published"
                }
              }
            ]
          }
        },
        "size": 0,
        "aggs": {
          "distinct_title": {
            "terms": {
              "field": "section_slug.keyword",
              "size": 1000
            }
          }
        }
      }
      const query = {
        "query": {
          "bool": {
            "must": [
              {
                "term": {
                  "featured": true
                }
              }
            ]
          }
        },
        "_source": ["default_display_label", "slug", "location_display_labels", "cover_image", "banner_image","short_description","position"]
      }
      
      const result = await elasticService.plainSearch('section', query);
      

      const { hits } = result.hits

      if (!hits.length) {
        if(callback){
          return callback(null, { success: true, data: [] })
        }else{
          return [];
        }
        
      }
      
      const aggrResult = await elasticService.plainSearch('article', aggregateQ);
      

      const { buckets } = aggrResult.aggregations.distinct_title;
      let data = []
      if (buckets.length) {
        for (let index = 0; index < hits.length; index++) {
          const hit = hits[index];
          let section = buckets.find(bucket => bucket.key == hit._source.slug);
          if (section && section.doc_count) {
            let secR = {
              label: hit._source.default_display_label,
              slug: hit._source.slug,
              position: hit._source.position,
              type: "category",
              count: section.doc_count,
              short_description: hit._source.short_description,
              cover_image: (hit._source.cover_image) ?((hit._source.cover_image['large']) ?hit._source.cover_image['large'] : hit._source.cover_image['thumbnail']) : null,
              banner_image: (hit._source.banner_image) ?((hit._source.banner_image['large']) ?hit._banner.cover_image['large'] : hit._source.banner_image['thumbnail']) : null,
              child: []
            }
            data[ hit._source.position -1] = secR
          }
        }
        //return callback(null, { success: true, data })
        if(callback){
          return callback(null, { success: true, data: data })
        }else{
          return data;
        }
      } else {
        //return callback(null, { success: true, data: [] })
        if(callback){
          return callback(null, { success: true, data: [] })
        }else{
          return [];
        }
      }
    } catch (error) {
      console.log(error, "errror");
      //return callback(null, { success: true, data: [] })
      if(callback){
        return callback(null, { success: true, data: [] })
      }else{
        return [];
      }
    }
  }

  async countPage(req, callback,useCache = true) {
    const cacheKey = "count-page";
    if(useCache){
      try {
          let cacheData = await RedisConnection.getValuesSync(cacheKey);
          if(cacheData.noCacheData != true) {
              //console.log("cache found for footer: returning data");
              return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
          }
      }catch(error){
          console.warn("Redis cache failed for count page: "+cacheKey,error);
      }
    }

    let result = {
      course:null,
      partner:null,
      institute:null
    };
    try{
      const query_courses = await elasticService.count('learn-content')
      const query_partner = await elasticService.count('partner')
      const query_institute = await elasticService.count('provider')
      if(query_courses.count){
        if(query_courses.count < 100){
          query_courses.count = Math.floor(query_courses.count/10)*10;
        }else if(query_courses.count < 1000){
          query_courses.count = Math.floor(query_courses.count/100)*100;
        }else if(query_courses.count > 1000){
          query_courses.count = Math.floor(query_courses.count/1000)+'k';
        }
        result['course'] = query_courses['count']+''
      }
      if(query_partner.count){
        if(query_partner.count < 100){
          query_partner.count = Math.floor(query_partner.count/10)*10;
        }else if(query_partner.count < 1000){
          query_partner.count = Math.floor(query_partner.count/100)*100;
        }else if(query_partner.count > 1000){
          query_partner.count = Math.floor(query_partner.count/1000)+'k';
        }
        result['partner'] = query_partner['count']+''
      }
      if(query_institute.count){
        if(query_institute.count < 100){
          query_institute.count = Math.floor(query_institute.count/10)*10;
        }else if(query_institute.count < 1000){
          query_institute.count = Math.floor(query_institute.count/100)*100;
        }else if(query_institute.count > 1000){
          query_institute.count = Math.floor(query_institute.count/1000)+'k';
        }
        result['institute'] = query_institute['count']+''
      }
        
      RedisConnection.set('count-page', result);
      RedisConnection.expire('count-page', process.env.CACHE_EXPIRE_COUNT_PAGE);

      return callback(null, { success: true, data:result })
    }catch(e){
        return callback(null, { success: true, data:{} })
        console.log('Error while retriving about us data',e);
    }
  }

  async getSectionContent(req, callback,skipCache) {
    const slug = req.params.slug;
    let data = {}
    try {
      if(skipCache != true) {
          let cacheData = await RedisConnection.getValuesSync('section-page-'+slug);
          if(cacheData.noCacheData != true) {
              return callback(null, { success: true, data:cacheData });
          }
      }

      const query = {
        "bool": {
          "must": [
            { term: { "slug.keyword": slug } },
          ]
        }
      };
      
      const result = await elasticService.search('section', query, {},  {excludes: ["all_featured_articles"] })
      if (result.hits && result.hits.length) {
        let response = await buildSectionView(result.hits[0]._source)
        response.data.cover_image = formatImageResponse(response.data.cover_image)
        response.data.banner_image = formatImageResponse(response.data.banner_image)
        response.data.meta_information = await generateMetaInfo('SECTION_PAGE', result.hits[0]._source)

         // check if most popular article skills have minimum 6 articles
         if (result.hits[0]._source.popular_article_skills && result.hits[0]._source.popular_article_skills) {
          result.hits[0]._source.popular_article_skills = await Promise.all(
            result.hits[0]._source.popular_article_skills.map(async (skill) => {
              let reqObj = {
                query: {
                  skill: skill.name
                }
              }
              let recommendation = await RecommendationService.getPopularArticles(reqObj)

              if (recommendation.success && recommendation.data && recommendation.data.list && recommendation.data.list.length > 5) {
                return skill

              } else {
                return null
              }

            })
          )
          response.data.popular_article_skills = result.hits[0]._source.popular_article_skills.filter(skill => skill != null)
        }

        // check if most trending article skills have minimum 6 articles
        if (result.hits[0]._source.trending_article_skills && result.hits[0]._source.trending_article_skills) {
          result.hits[0]._source.trending_article_skills = await Promise.all(
            result.hits[0]._source.trending_article_skills.map(async (skill) => {
              let reqObj = {
                query: {
                  skill: skill.name,
                  subType:'Trending'
                }
              }
              let recommendation = await RecommendationService.getPopularArticles(reqObj)

              if (recommendation.success && recommendation.data && recommendation.data.list && recommendation.data.list.length > 5) {
                return skill

              } else {
                return null
              }

            })
          )
          response.data.trending_article_skills = result.hits[0]._source.trending_article_skills.filter(skill => skill != null)
        }       
  

        RedisConnection.set('section-article-'+slug, response.articles);
        RedisConnection.expire('section-article-'+slug, process.env.CACHE_EXPIRE_SECTION_ARTCLE);
        RedisConnection.set('section-page-'+slug, response.data);
        RedisConnection.expire('section-page-'+slug, process.env.CACHE_EXPIRE_SECTION_PAGE);

        return callback(null, { success: true, data:response.data })
      }
      let redirectUrl = await helperService.getRedirectUrl(req);
      if (redirectUrl) {
          return callback(null, { success: false, redirectUrl: redirectUrl, message: 'Redirect' });
      }
      return callback(null, { success: false, message: 'Not found!' });

    } catch (error) {
      console.log("ERROR:",error)
      return callback(null, { success: true, data:data })
    }
  }

  async getBlogHomePageContent(req, callback,skipCache) {
    let data = {}
    try {

      if (skipCache != true) {
        let cacheData = await RedisConnection.getValuesSync('blog-home-page');
        if (cacheData.noCacheData != true) {
          return callback(null, { success: true, data: cacheData });
        }
      }

      const query = {
        "bool": {
          "filter": [
              { "term": { "id": 1 } }
          ]
      }
      };

      const result = await elasticService.search('blog_home_page', query, { from: 0, size: 1000 }, ["meta_information", "most_popular_article_categories", "trending_article_categories"])
      
      if (result.hits && result.hits.length) {
        let data = result.hits[0]._source
        // check if most popular article categories have minimum 6 articles
        if (data.most_popular_article_categories && data.most_popular_article_categories) {
          data.most_popular_article_categories = await Promise.all(
            data.most_popular_article_categories.map(async (category) => {
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
          data.most_popular_article_categories = data.most_popular_article_categories.filter(category => category != null)
        }

        // check if most trending article categories have minimum 6 articles
        if (data.trending_article_categories && data.trending_article_categories) {
          data.trending_article_categories = await Promise.all(
            data.trending_article_categories.map(async (category) => {
              let reqObj = {
                query: {
                  category: category.name,
                  subType: 'Trending'
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
          data.trending_article_categories = data.trending_article_categories.filter(category => category != null)

          data.meta_information = await generateMetaInfo('ADVICE_PAGE', data)     
       
        }  
        RedisConnection.set('blog-home-page', data);
        RedisConnection.expire('blog-home-page', process.env.CACHE_EXPIRE_BLOG_HOME_PAGE);
        
        return callback(null, { success: true, data: data })
      }
      return callback(null, { success: true, data: data })

    } catch (error) {
      return callback(null, { success: true, data: data })
    }
  }
}