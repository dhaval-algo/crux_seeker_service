const elasticService = require("./elasticService");


const buildSectionView = (section) => {
  return new Promise(async (resolve) => {
    console.log(section);
    if (!!section.featured_articles && section.featured_articles.length) {
      section.featured_articles = await getActiveArticles(section.featured_articles)
    }
  
    if (!!section.trending_articles && section.trending_articles.length) {
      section.trending_articles = await getActiveArticles(section.trending_articles)
    }
    if (!!section.recent_articles && section.recent_articles.length) {
      section.recent_articles = await getActiveArticles(section.recent_articles)
    }
    if (!!section.recommended_articles && section.recommended_articles.length) {
      section.recommended_articles = await getActiveArticles(section.recommended_articles)
    }
    if (!!section.location_display_labels && section.location_display_labels.length) {
      section.location_display_labels = await getActiveArticles(section.location_display_labels)
    }
  
    if (!!section.career_guidance && section.career_guidance.length) {
      section.career_guidance = await getActiveArticles(section.career_guidance)
    }
    if (!!section.expert_interview_advice && section.expert_interview_advice.length) {
      section.expert_interview_advice = await getActiveArticles(section.expert_interview_advice)
    }
    if (!!section.improve_your_resume && section.improve_your_resume.length) {
      section.improve_your_resume = await getActiveArticles(section.improve_your_resume)
    }
  
    if (!!section.all_about_linkedin && section.all_about_linkedin.length) {
      section.all_about_linkedin = await getActiveArticles(section.all_about_linkedin)
    }
    if (!!section.best_ways_to_learn && section.best_ways_to_learn.length) {
      section.best_ways_to_learn = await getActiveArticles(section.best_ways_to_learn)
    }
    if (!!section.top_skills_of_the_future && section.top_skills_of_the_future.length) {
      section.top_skills_of_the_future = await getActiveArticles(section.top_skills_of_the_future)
    }
    if (!!section.important_skills_of_the_future && section.important_skills_of_the_future.length) {
      section.important_skills_of_the_future = await getActiveArticles(section.important_skills_of_the_future)
    }
  
    if (!!section.tips_for_learners && section.tips_for_learners.length) {
      section.tips_for_learners = await getActiveArticles(section.tips_for_learners)
    }

    return resolve(section)
  })
  
}

const getActiveArticles =  (articles) => {
  return new Promise(async(resolve) => {
    articles = articles.map((art) => { return `ARTCL_PUB_${art}`})
    const query = {
      "bool": {
        "must": [
          {
            "term": {
              "status.keyword": "published"
            }
            
          }
        ],
        "filter": [
          {
            "ids": {
              "values": [
                  articles           
              ]
            }
          }
        ]        
      }     
    
    }
  
    const resultT = await elasticService.search('section',query)
    let dataArray = []
    if(result.hits){
      if(result.hits.hits && result.hits.hits.length > 0){
          //console.log("result.hits.hits <> ", result.hits.hits);
          resultT.hits.hits.map(function(obj) {
            dataArray.push(obj._source)
            return
          });
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
                  "status.keyword": "approved"
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
        "_source": ["default_display_label", "slug", "location_display_labels"]
      }
      console.log('here1');
      const result = await elasticService.plainSearch('section', query);
      console.log('here2');

      const { hits } = result.hits

      if (!hits.length) {
        return callback(null, { success: true, data: [] })
      }
      console.log('here3');
      const aggrResult = await elasticService.plainSearch('article', aggregateQ);
      console.log('here4');

      const { buckets } = aggrResult.aggregations.distinct_title;
      let data = []
      if (buckets.length) {
        for (let index = 0; index < hits.length; index++) {
          const hit = hits[index];
          console.log(hit);
          let section = buckets.find(bucket => bucket.key == hit._source.slug);
          if (section && section.doc_count) {
            let secR = {
              label: hit._source.default_display_label,
              slug: hit._source.slug,
              type: "category",
              count: section.doc_count,
              child: []
            }
            data.push(secR)
          }
        }
        return callback(null, { success: true, data })
      } else {
        return callback(null, { success: true, data: [] })
      }
    } catch (error) {
      console.log(error, "errror");
      return callback(null, { success: true, data: [] })
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
}