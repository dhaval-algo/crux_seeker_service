const elasticService = require("./elasticService");
const articleService = require('./articleService');

const ArticleService = new articleService()
const buildSectionView = (section) => {
  return new Promise(async (resolve) => {
    if (!!section.featured_articles && !!section.featured_articles.length) {
      section.featured_articles = await getActiveArticles(section.featured_articles)
      section.featured_articles =  section.featured_articles.filter(art => !!art)
    }
    if (!!section.trending_articles && !!section.trending_articles.length) {
      section.trending_articles = await ArticleService.getArticleByIds(section.trending_articles)
      section.trending_articles =  section.trending_articles.filter(art => !!art)
    }

    if (!!section.recent_articles && !!section.recent_articles.length) {
      section.recent_articles = await ArticleService.getArticleByIds(section.recent_articles, false)
      section.recent_articles =  section.recent_articles.filter(art => !!art)

    }
    if (!!section.recommended_articles && !!section.recommended_articles.length) {
      section.recommended_articles = await ArticleService.getArticleByIds(section.recommended_articles)
      section.recommended_articles =  section.recommended_articles.filter(art => !!art)
    }
    if (!!section.location_display_labels && !!section.location_display_labels.length) {
      section.location_display_labels = await ArticleService.getArticleByIds(section.location_display_labels)
      section.location_display_labels =  section.location_display_labels.filter(art => !!art)
    }
  
    if (!!section.career_guidance && !!section.career_guidance.length) {
      section.career_guidance = await ArticleService.getArticleByIds(section.career_guidance)
      section.career_guidance =  section.career_guidance.filter(art => !!art)
    }
    if (!!section.expert_interview_advice && !!section.expert_interview_advice.length) {
      section.expert_interview_advice = await ArticleService.getArticleByIds(section.expert_interview_advice)
      section.expert_interview_advice =  section.expert_interview_advice.filter(art => !!art)
    }
    if (!!section.improve_your_resume && !!section.improve_your_resume.length) {
      section.improve_your_resume = await ArticleService.getArticleByIds(section.improve_your_resume)
      section.improve_your_resume =  section.improve_your_resume.filter(art => !!art)
    }
  
    if (!!section.all_about_linkedin && !!section.all_about_linkedin.length) {
      section.all_about_linkedin = await ArticleService.getArticleByIds(section.all_about_linkedin)
      section.all_about_linkedin =  section.all_about_linkedin.filter(art => !!art)
    }
    if (!!section.best_ways_to_learn && !!section.best_ways_to_learn.length) {
      section.best_ways_to_learn = await ArticleService.getArticleByIds(section.best_ways_to_learn)
      section.best_ways_to_learn =  section.best_ways_to_learn.filter(art => !!art)
    }
    if (!!section.top_skills_of_the_future && !!section.top_skills_of_the_future.length) {
      section.top_skills_of_the_future = await ArticleService.getArticleByIds(section.top_skills_of_the_future)
      section.top_skills_of_the_future =  section.top_skills_of_the_future.filter(art => !!art)
    }
    if (!!section.important_skills_of_the_future && !!section.important_skills_of_the_future.length) {
      section.important_skills_of_the_future = await ArticleService.getArticleByIds(section.important_skills_of_the_future)
      section.important_skills_of_the_future =  section.important_skills_of_the_future.filter(art => !!art)
    }
  
    if (!!section.tips_for_learners && !!section.tips_for_learners.length) {
      section.tips_for_learners = await ArticleService.getArticleByIds(section.tips_for_learners)
      section.tips_for_learners =  section.tips_for_learners.filter(art => !!art)
    }

    if (!!section.best_certifications && !!section.best_certifications.length) {
      section.best_certifications = await ArticleService.getArticleByIds(section.best_certifications)
      section.best_certifications =  section.best_certifications.filter(art => !!art)
    }

    if (!!section.top_stories && !!section.top_stories.length) {
      section.top_stories = await ArticleService.getArticleByIds(section.top_stories)
      section.top_stories =  section.top_stories.filter(art => !!art)
    }

    if (!!section.latest_stories && !!section.latest_stories.length) {
      section.latest_stories = await ArticleService.getArticleByIds(section.latest_stories)
      section.latest_stories =  section.latest_stories.filter(art => !!art)
    }
    return resolve(section)
  })
  
}

const getActiveArticles =  (articles) => {
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
    console.log(resultT.hits.hits.length);
    let dataArray = []
    if(resultT.hits.hits){
      if(resultT.hits.hits && resultT.hits.hits.length > 0){
          //console.log("result.hits.hits <> ", result.hits.hits);
          let articles = resultT.hits.hits;
          for (let index = 0; index < articles.length; index++) {
            const element = articles[index];
            let artcl = await ArticleService.generateSingleViewData(element._source)
             dataArray.push(artcl)
          }
      }
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
      console.log('here1');
      const result = await elasticService.plainSearch('section', query);
      console.log('here2');

      const { hits } = result.hits

      if (!hits.length) {
        if(callback){
          return callback(null, { success: true, data: [] })
        }else{
          return [];
        }
        
      }
      console.log('here3');
      const aggrResult = await elasticService.plainSearch('article', aggregateQ);
      console.log('here4');

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

  async getSectionContent(slug, callback) {
    let data = {}
    try {
      const query = {
        "bool": {
          "must": [
            { term: { "slug.keyword": slug } },
          ]
        }
      };
      console.log(query);
      const result = await elasticService.search('section', query)
      if (result.hits && result.hits.length) {
        data = await buildSectionView(result.hits[0]._source)
        return callback(null, { success: true, data })
      }
      return callback(null, { success: true, data:[] })

    } catch (error) {
      return callback(null, { success: true, data: [] })
    }
  }

  async getBlogHomePageContent(req, callback) {
    let data = {}
    try {
      const query = {
        "match_all": {}
      };
      console.log(query);
      const result = await elasticService.search('blog_home_page', query)
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