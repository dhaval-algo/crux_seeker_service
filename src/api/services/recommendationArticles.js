'use strict';

const elasticService = require("./elasticService");
const RecommendationService = require("../services/recommendationService");
const RedisConnection = require('../../services/v1/redis');
const redisConnection = new RedisConnection();
const recommendationService = new RecommendationService();


const articleFields = ["id","author_first_name","author_last_name","created_by_role","cover_image",
            "slug","author_id","short_description","title","premium","author_slug","co_authors",
            "partners","activity_count","section_name","section_slug", "listing_image", "card_image",
            "card_image_mobile"]



module.exports = class recommendationArticles{

        //get all kinds of articles cg,lg,la,article(general)
    async getRelatedArticles(req) {
        try {
            if(!req.query['newsId'])
                return { success: false, message: "newsId is must", data:{list:[]} };

            const newsId = req.query.newsId.toString();
            const { page = 1, limit = 6 , section} = req.query;
            const offset = (page - 1) * limit;
            let articles = [], cacheKey = `Recommendation-Article-For-${newsId}-${section}`;
            let cachedData = await redisConnection.getValuesSync(cacheKey);

            if (cachedData.noCacheData != true)
                return { success: true, message: "list fetched successfully", data:{ list:cachedData, mlList:[], show:'logic'} };

            //priority 1 category list; a => field name in article index; b => field name in news index
            let priorityList1 = [{a:'skills.keyword', b:'skills.keyword'}, {a:'topics.keyword', b:'topics.keyword'},
                        {a:'sub_categories.keyword', b:'sub_categories.keyword'}, {a:'categories.keyword',b:'categories.keyword'}];
            let priorityList2 = [{ a:'author_id', b:'authors'}, { a:'partners', b:'partners'}, {a:'regions.keyword', b:'regions.keyword'}];

            const relationData = {
                index: "news",
                id: newsId
            }

            let esQuery = {
                "bool": { "filter": [ { "term": { "status.keyword": "published" } } ] }
            }
            if (section) {
                esQuery.bool.filter.push(
                    { "term": { "section_name.keyword": section } }
                );

            }

            function buildQueryTerms(key, i) {
                let termQuery = { "terms": {} };
                termQuery.terms[key.a] = { ...relationData, "path": key.b };
                termQuery.terms.boost = 5 - (i * 0.1);
                return termQuery;
            }

            esQuery.bool.should = [{
                bool: {
                    boost: 1000,
                    should: priorityList1.map(buildQueryTerms)
                }
            }];

            esQuery.bool.should.push({
                bool: {
                    boost: 10,
                    should: priorityList2.map(buildQueryTerms)
                }
            })

            let result = await elasticService.search("article", esQuery, { from: offset, size: limit ,_source: articleFields});

            if (result && result.hits.length > 0) {
                for (let hit of result.hits) {
                    let article = await recommendationService.generateArticleFinalResponse(hit._source);
                    articles.push(article);
                }
            }
            await redisConnection.set(cacheKey, articles, process.env.CACHE_EXPIRE_ARTICLE_RECOMMENDATION || 360)

           
            return { success: true, message: "list fetched successfully", data:{ list:articles, mlList:[], show:'logic'} };
            
 
        } catch (error) {

            console.log("Error while processing data for related article", error);
            return { success: false, message: "list fetched successfully", data:{list:[]} };
        }
    }

}