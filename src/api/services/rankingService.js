const elasticService = require("./elasticService");
const articleService = require('./articleService');

const ArticleService = new articleService();

const formatHomepageData = async(data) => {    
    if(data.top_articles.length){
        data.top_articles = await ArticleService.getArticleByIds(data.top_articles);
    }
    if(data.trending_articles.length){
        data.trending_articles = await ArticleService.getArticleByIds(data.trending_articles);
    }
    if(data.featured_articles.length){
        data.featured_articles = await ArticleService.getArticleByIds(data.featured_articles, false);
    }
    if(data.online_tech_articles.length){
        data.online_tech_articles = await ArticleService.getArticleByIds(data.online_tech_articles);
    }
    if(data.online_non_tech_articles.length){
        data.online_non_tech_articles = await ArticleService.getArticleByIds(data.online_non_tech_articles);
    }
    if(data.executive_education.length){
        data.executive_education = await ArticleService.getArticleByIds(data.executive_education);
    }
    if(data.mba_rankings.length){
        data.mba_rankings = await ArticleService.getArticleByIds(data.mba_rankings);
    }
    if(data.engineering_rankings.length){
        data.engineering_rankings = await ArticleService.getArticleByIds(data.engineering_rankings);
    }
    return data;
};

module.exports = class rankingService {  

  async getHomePageContent(req, callback) {
    let data = {};
    let loggedIn = false;
    if(req.query['loggedIn']){
        loggedIn = (req.query['loggedIn'] == 'true');
    }
    try {
      const query = {
        "match_all": {}
      };
      const result = await elasticService.search('ranking-home-page', query);
      if (result.hits && result.hits.length) {
        data = await formatHomepageData(result.hits[0]._source)
        return callback(null, { success: true, data })
      }
      return callback(null, { success: true, data:data })

    } catch (error) {
      return callback(null, { success: true, data: data })
    }
  }
}