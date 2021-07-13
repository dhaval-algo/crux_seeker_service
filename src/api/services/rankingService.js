const elasticService = require("./elasticService");
const articleService = require('./articleService');
const redisConnection = require('../../services/v1/redis');

const ArticleService = new articleService();
const RedisConnection = new redisConnection();

const formatHomepageData = async(data) => {
    let articles = [];
    if(data.top_articles.length){
        let top_articles = await ArticleService.getArticleByIds(data.top_articles, false, true);
        data.top_articles = top_articles.articles;
        articles = articles.concat(top_articles.articleSlugs);
    }
    if(data.trending_articles.length){
        let trending_articles = await ArticleService.getArticleByIds(data.trending_articles, true, true);
        data.trending_articles = trending_articles.articles;
        articles = articles.concat(trending_articles.articleSlugs);
    }
    if(data.featured_articles.length){
        let featured_articles = await ArticleService.getArticleByIds(data.featured_articles, false, true);
        data.featured_articles = featured_articles.articles;
        articles = articles.concat(featured_articles.articleSlugs);
    }
    if(data.online_tech_articles.length){
        let online_tech_articles = await ArticleService.getArticleByIds(data.online_tech_articles, true, true);
        data.online_tech_articles = online_tech_articles.articles;
        articles = articles.concat(online_tech_articles.articleSlugs);
    }
    if(data.online_non_tech_articles.length){
        let online_non_tech_articles = await ArticleService.getArticleByIds(data.online_non_tech_articles, true, true);
        data.online_non_tech_articles = online_non_tech_articles.articles;
        articles = articles.concat(online_non_tech_articles.articleSlugs);
    }
    if(data.executive_education.length){
        let executive_education = await ArticleService.getArticleByIds(data.executive_education, true, true);
        data.executive_education = executive_education.articles;
        articles = articles.concat(executive_education.articleSlugs);
    }
    if(data.mba_rankings.length){
        let mba_rankings = await ArticleService.getArticleByIds(data.mba_rankings, true, true);
        data.mba_rankings = mba_rankings.articles;
        articles = articles.concat(mba_rankings.articleSlugs);
    }
    if(data.engineering_rankings.length){
        let engineering_rankings = await ArticleService.getArticleByIds(data.engineering_rankings, true, true);
        data.engineering_rankings = engineering_rankings.articles;
        articles = articles.concat(engineering_rankings.articleSlugs);
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
            let cacheData = await RedisConnection.getValuesSync('ranking-page');
            if(cacheData.noCacheData != true) {
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