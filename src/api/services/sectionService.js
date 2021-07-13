const elasticService = require("./elasticService");
const articleService = require('./articleService');
const redisConnection = require('../../services/v1/redis');

const ArticleService = new articleService()
const RedisConnection = new redisConnection();

const buildSectionView = (section) => {
  return new Promise(async (resolve) => {
    let articles = [];
    if (!!section.featured_articles && !!section.featured_articles.length) {
      let featured_articles = await getActiveArticles(section.featured_articles, true)
      section.featured_articles =  featured_articles.articles.filter(art => !!art)
      articles = articles.concat(featured_articles.articleSlugs);
    }
    if (!!section.trending_articles && !!section.trending_articles.length) {
      let trending_articles = await ArticleService.getArticleByIds(section.trending_articles, true, true)
      section.trending_articles =  trending_articles.articles.filter(art => !!art)
      articles = articles.concat(trending_articles.articleSlugs);
    }

    if (!!section.recent_articles && !!section.recent_articles.length) {
      let recent_articles = await ArticleService.getArticleByIds(section.recent_articles, false, true)
      section.recent_articles =  recent_articles.articles.filter(art => !!art)
      articles = articles.concat(recent_articles.articleSlugs);

    }
    if (!!section.recommended_articles && !!section.recommended_articles.length) {
      let recommended_articles = await ArticleService.getArticleByIds(section.recommended_articles, true, true)
      section.recommended_articles =  recommended_articles.articles.filter(art => !!art)
      articles = articles.concat(recommended_articles.articleSlugs);
    }
    if (!!section.location_display_labels && !!section.location_display_labels.length) {
      let location_display_labels = await ArticleService.getArticleByIds(section.location_display_labels, true, true)
      section.location_display_labels =  location_display_labels.articles.filter(art => !!art)
      articles = articles.concat(location_display_labels.articleSlugs);
    }
  
    if (!!section.career_guidance && !!section.career_guidance.length) {
      let career_guidance = await ArticleService.getArticleByIds(section.career_guidance, true, true)
      section.career_guidance =  career_guidance.articles.filter(art => !!art)
      articles = articles.concat(career_guidance.articleSlugs);
    }
    if (!!section.expert_interview_advice && !!section.expert_interview_advice.length) {
      let expert_interview_advice = await ArticleService.getArticleByIds(section.expert_interview_advice, true, true)
      section.expert_interview_advice =  expert_interview_advice.articles.filter(art => !!art)
      articles = articles.concat(expert_interview_advice.articleSlugs);
    }
    if (!!section.improve_your_resume && !!section.improve_your_resume.length) {
      let improve_your_resume = await ArticleService.getArticleByIds(section.improve_your_resume, true, true)
      section.improve_your_resume =  improve_your_resume.articles.filter(art => !!art)
      articles = articles.concat(improve_your_resume.articleSlugs);
    }
  
    if (!!section.all_about_linkedin && !!section.all_about_linkedin.length) {
      let all_about_linkedin = await ArticleService.getArticleByIds(section.all_about_linkedin, true, true)
      section.all_about_linkedin =  all_about_linkedin.articles.filter(art => !!art)
      articles = articles.concat(all_about_linkedin.articleSlugs);
    }
    if (!!section.best_ways_to_learn && !!section.best_ways_to_learn.length) {
      let best_ways_to_learn = await ArticleService.getArticleByIds(section.best_ways_to_learn, true, true)
      section.best_ways_to_learn =  best_ways_to_learn.articles.filter(art => !!art)
      articles = articles.concat(best_ways_to_learn.articleSlugs);
    }
    if (!!section.top_skills_of_the_future && !!section.top_skills_of_the_future.length) {
      let top_skills_of_the_future = await ArticleService.getArticleByIds(section.top_skills_of_the_future, true, true)
      section.top_skills_of_the_future =  top_skills_of_the_future.articles.filter(art => !!art)
      articles = articles.concat(top_skills_of_the_future.articleSlugs);
    }
    if (!!section.important_skills_of_the_future && !!section.important_skills_of_the_future.length) {
      let important_skills_of_the_future = await ArticleService.getArticleByIds(section.important_skills_of_the_future, true, true)
      section.important_skills_of_the_future =  important_skills_of_the_future.articles.filter(art => !!art)
      articles = articles.concat(important_skills_of_the_future.articleSlugs);
    }
  
    if (!!section.tips_for_learners && !!section.tips_for_learners.length) {
      let tips_for_learners = await ArticleService.getArticleByIds(section.tips_for_learners, true, true)
      section.tips_for_learners =  tips_for_learners.articles.filter(art => !!art)
      articles = articles.concat(tips_for_learners.articleSlugs);
    }

    if (!!section.best_certifications && !!section.best_certifications.length) {
      let best_certifications = await ArticleService.getArticleByIds(section.best_certifications, true, true)
      section.best_certifications =  best_certifications.articles.filter(art => !!art)
      articles = articles.concat(best_certifications.articleSlugs);
    }

    if (!!section.top_stories && !!section.top_stories.length) {
      let top_stories = await ArticleService.getArticleByIds(section.top_stories, true, true)
      section.top_stories =  top_stories.articles.filter(art => !!art)
      articles = articles.concat(top_stories.articleSlugs);
    }

    if (!!section.latest_stories && !!section.latest_stories.length) {
      let latest_stories = await ArticleService.getArticleByIds(section.latest_stories, true, true)
      section.latest_stories =  latest_stories.articles.filter(art => !!art)
      articles = articles.concat(latest_stories.articleSlugs);
    }
    return {data:section, articles:articles};
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
    if(resultT.hits.hits){
      if(resultT.hits.hits && resultT.hits.hits.length > 0){
          //console.log("result.hits.hits <> ", result.hits.hits);
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
          "match_all": {}
        },
        "_source": ["default_display_label", "slug", "location_display_labels", "cover_image", "short_description"]
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
              type: "category",
              count: section.doc_count,
              short_description: hit._source.short_description,
              cover_image: (hit._source.cover_image) ?((hit._source.cover_image['large']) ?hit._source.cover_image['large'] : hit._source.cover_image['thumbnail']) : null,
              child: []
            }
            data.push(secR)
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

  async getSectionContent(slug, callback,skipCache) {
    console.log("api/public/v1/section/learning-path")
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
      
      const result = await elasticService.search('section', query)
      if (result.hits && result.hits.length) {
        let response = await buildSectionView(result.hits[0]._source)
        RedisConnection.set('section-article-'+slug, response.articles);
        RedisConnection.set('section-page-'+slug, response.data);

        return callback(null, { success: true, data:response.data })
      }
      return callback(null, { success: true, data:data })

    } catch (error) {
      return callback(null, { success: true, data:data })
    }
  }

  async getBlogHomePageContent(req, callback) {
    let data = {}
    try {
      const query = {
        "match_all": {}
      };
      
      const result = await elasticService.search('blog_home_page', query, {from: 0, size: 1000})
      if (result.hits && result.hits.length) {
        data = await buildSectionView(result.hits[0]._source)
        return callback(null, { success: true, data })
      }
      return callback(null, { success: true, data:[] })

    } catch (error) {
      return callback(null, { success: true, data: [] })
    }
  }
}