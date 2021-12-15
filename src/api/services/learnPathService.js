const elasticService = require("./elasticService");
const learnContentService = require("./learnContentService");
let LearnContentService = new learnContentService();

const reviewService = require("./reviewService");
const ReviewService = new reviewService();

const { getCurrencies, getCurrencyAmount } = require('../utils/general');
const round = (value, step) => {
    step || (step = 1.0);
    var inv = 1.0 / step;
    return Math.round(value * inv) / inv;
};
module.exports = class learnPathService {
    async getLearnPathList(req, callback) {
        let data = await this.generateListViewData();
        callback(null, { status: 'success', message: 'Fetched successfully!', data: data });
    }

    async getLearnPath(req, callback) {
        const slug = req.params.slug;
        const learnPath = await this.fetchLearnPathBySlug(slug);
        if (learnPath) {
            const data = await this.generateSingleViewData(learnPath, false, req.query.currency);
            callback(null, { status: 'success', message: 'Fetched successfully!', data: data });
        } else {
            callback({ status: 'failed', message: 'Not found!' }, null);
        }
    }

    async fetchLearnPathBySlug(slug) {
        const query = {
            "bool": {
                "must": [
                    { term: { "slug.keyword": slug } },
                    { term: { "status.keyword": 'published' } }
                ]
            }
        };

        let result = await elasticService.search('learn-path', query);
        if (result.hits && result.hits.length > 0) {
            return result.hits[0]._source;
        } else {
            return null;
        }
    }

    async generateSingleViewData(result, isList = false, currency = process.env.DEFAULT_CURRENCY) {
        let currencies = await getCurrencies();
        let data = {
            id: `LRN_PTH_${result.id}`,
            title: result.title,
            slug: result.slug,
            description: result.description,
            cover_images: result.images,
            levels: result.levels,
            medium: result.medium,
            reviews_extended: [],
            life_stages: result.life_stages,
            topics: result.topics,
            pricing: { 
                regular_price: getCurrencyAmount(result.regular_price, currencies, result.currency, currency),
                sale_price: getCurrencyAmount(result.sale_price, currencies, result.currency, currency),
                display_price: result.display_price,
                pricing_type :result.pricing_type,
                currency: currency
            },
            ratings: {
                total_review_count: result.reviews ? result.reviews.length : 0,
                average_rating: 0,
                average_rating_actual: 0,
                rating_distribution: []
            },
            meta_information: {
                meta_keywords: result.meta_keywords,
                meta_description: result.meta_description,
                meta_title: `${result.title} | Learn Path | ${process.env.SITE_URL_FOR_META_DATA || 'Careervira.com'}`
            },
            duration: {
                total_duration: result.total_duration,
                total_duration_unit: result.total_duration_unit,
            },
            courses: []
        }

        if(!isList) {
            let reviews = await this.getReviews({params:{learnPathId: data.id}, query: {}});
            if(reviews)
                data.reviews_extended = reviews;
            
            let courses = await LearnContentService.getCourseByIds({query: { ids: result.courses.map(item => item.id).join(), currency: currency }});
            if(courses) { 
                    data.courses = courses;   
            }   
        }


        //TODO this logic is copied from course service
        //but this aggreation logic should be put in elastic search add added in the reviews_extended object for both course and learn-path.
        if(result.reviews && result.reviews.length > 0){
            let totalRating = 0;
            let ratings = {};
            for(let review of result.reviews){
                totalRating += review.rating;
                let rating_round = Math.floor(review.rating);
                if(ratings[rating_round]){
                    ratings[rating_round] += 1; 
                }else{
                    ratings[rating_round] = 1; 
                }
            }

            const average_rating = totalRating/result.reviews.length;            
            data.ratings.average_rating = round(average_rating, 0.5);
            data.ratings.average_rating_actual = average_rating.toFixed(1);            
            let rating_distribution = [];

            //add missing ratings
            for(let i=0; i<5; i++){
                if(!ratings[i+1]){
                    ratings[i+1] = 0;
                }                
            }
            Object.keys(ratings)
            .sort()
            .forEach(function(v, i) {
                rating_distribution.push({
                    rating: v,
                    percent: Math.round((ratings[v] * 100) / result.reviews.length)
                });
            });
            data.ratings.rating_distribution = rating_distribution.reverse();
        }


        return data;
    }

    async generateListViewData(rows, currency, isCaching = false) {
        let datas = [];
        rows = [1, 2, 3, 4, 5, 6];
        for (let row of rows) {
            const data = await this.generateSingleViewData(row._source, true, currency, isCaching);
            datas.push(data);
        }
        return datas;
    }

    async getReviews(req, callback) {
        try {
            let reviews = await ReviewService.getReviews("learn-path", req.params.learnPathId, req);
            if(callback) callback(null, { status: "success", message: "all good", data: reviews }); else return reviews;
        } catch (e) {
            if(callback) callback({ status: "failed", message: e.message }, null); else return false;
        }
    }
}