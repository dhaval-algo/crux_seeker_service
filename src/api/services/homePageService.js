const elasticService = require("./elasticService");
const articleService = require('./articleService');
const sectionService = require('./sectionService');

const learnContentService = require("./learnContentService");
let LearnContentService = new learnContentService();
const ArticleService = new articleService();
const SectionService = new sectionService();


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


const formatHomepageData = async(data, loggedIn = false, currency) => {
    
    if(data.recommended_courses.length > 0 && loggedIn){
        let courses = await LearnContentService.getCourseByIds({query: {currency: currency, ids: data.recommended_courses.join(",")}});
        data.recommended_courses = courses.filter(function (el) {
            return el != null;
        });
    }else{
        data.recommended_courses = [];
    }

    if(!loggedIn){
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
    let loggedIn = false;
    if(req.query['loggedIn']){
        loggedIn = (req.query['loggedIn'] == 'true');
    }
    try {
      const query = {
        "match_all": {}
      };
      const result = await elasticService.search('home-page', query);
      if (result.hits && result.hits.length) {
        data = await formatHomepageData(result.hits[0]._source, loggedIn, req.query['currency'])
        return callback(null, { success: true, data })
      }
      return callback(null, { success: true, data:data })

    } catch (error) {
      return callback(null, { success: true, data: data })
    }
  }
}