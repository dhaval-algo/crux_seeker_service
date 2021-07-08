const elasticService = require("./elasticService");
const articleService = require('./articleService');
const redisConnection = require('../../services/v1/redis');

const ArticleService = new articleService();
const RedisConnection = new redisConnection();

const formatHomepageData = async(data) => {
    let articles = [];
    if(data.top_articles.length){
        data.top_articles = await ArticleService.getArticleByIds(data.top_articles, false);
        data.top_articles.forEach(obj => {
            articles.push(obj.slug);
        });
    }
    if(data.trending_articles.length){
        data.trending_articles = await ArticleService.getArticleByIds(data.trending_articles);
        data.trending_articles.forEach(obj => {
            articles.push(obj.slug);
        });
    }
    if(data.featured_articles.length){
        data.featured_articles = await ArticleService.getArticleByIds(data.featured_articles, false);
        data.featured_articles.forEach(obj => {
            articles.push(obj.slug);
        });
    }
    if(data.online_tech_articles.length){
        data.online_tech_articles = await ArticleService.getArticleByIds(data.online_tech_articles);
        data.online_tech_articles.forEach(obj => {
            articles.push(obj.slug);
        });
    }
    if(data.online_non_tech_articles.length){
        data.online_non_tech_articles = await ArticleService.getArticleByIds(data.online_non_tech_articles);
        data.online_non_tech_articles.forEach(obj => {
            articles.push(obj.slug);
        });
    }
    if(data.executive_education.length){
        data.executive_education = await ArticleService.getArticleByIds(data.executive_education);
        data.executive_education.forEach(obj => {
            articles.push(obj.slug);
        });
    }
    if(data.mba_rankings.length){
        data.mba_rankings = await ArticleService.getArticleByIds(data.mba_rankings);
        data.mba_rankings.forEach(obj => {
            articles.push(obj.slug);
        });
    }
    if(data.engineering_rankings.length){
        data.engineering_rankings = await ArticleService.getArticleByIds(data.engineering_rankings);
        data.engineering_rankings.forEach(obj => {
            articles.push(obj.slug);
        });
    }
    return {data:data, articles:articles};
};

module.exports = class rankingService {  

  async getHomePageContent(req, callback, skipCache) {
    let data = {};
    let loggedIn = false;
    if(req.query['loggedIn']){
        loggedIn = (req.query['loggedIn'] == 'true');
    }
    try {
        if(skipCache != true) {
            let cacheData = RedisConnection.getValuesSync('ranking-page');
            if(cacheData.noCacheData) {
                return callback(null, { success: true, data:cacheData });
            }
        }
        const query = {
            "match_all": {}
        };
        const result = await elasticService.search('ranking-home-page', query);
        if (result.hits && result.hits.length) {
            let response = await formatHomepageData(result.hits[0]._source);
            RedisConnection.set('ranking-article-slug', response.articles);
            RedisConnection.set('ranking-page', response.data);
            return callback(null, { success: true, data:response.data });
        }
        return callback(null, { success: true, data:data })
    } catch (error) {
      return callback(null, { success: true, data: data })
    }
  }
}