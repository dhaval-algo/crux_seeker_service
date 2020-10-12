const elasticService = require("./elasticService");

const round = (value, step) => {
    step || (step = 1.0);
    var inv = 1.0 / step;
    return Math.round(value * inv) / inv;
}

module.exports = class learnContentService {

    async getLearnContent(slug, callback){
        const query = { "bool": {
            "must": [
              {term: { "slug.keyword": slug }},
              {term: { "status.keyword": 'published' }}
            ]
        }};
        const result = await elasticService.search('learn-content', query);
        if(result && result.length > 0){
            const data = await this.generateSingleViewData(result[0]._source);
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data});
        }else{
            callback({status: 'failed', message: 'Not found!'}, null);
        }        
    }


    async generateSingleViewData(result){
        let duration_divider;
        let duration_unit = 'weeks';
        let effort_unit = 'hours per week';
        if(duration_unit == 'weeks'){
            duration_divider = 7;
        }

        let data = {
            title: result.title,
            provider: {
                name: result.provider_name,
                currency: result.provider_currency
            },
            instructors: [],
            cover_video: (result.video) ? process.env.ASSET_URL+result.video : null,
            cover_image: (result.images) ? process.env.ASSET_URL+result.images.small : null,
            description: result.description,
            skills: result.skills_gained,
            what_will_learn: result.what_will_learn,
            target_students: result.target_students,
            prerequisites: result.prerequisites,
            content: result.content,
            course_details: {
                duration: (result.total_duration_in_hrs) ? Math.floor(result.total_duration_in_hrs/duration_divider)+" "+duration_unit : null, 
                effort: (result.recommended_effort_per_week) ? result.recommended_effort_per_week+" "+effort_unit  : null,
                total_video_content: result.total_video_content_in_hrs,
                language: result.languages.join(", "),
                subtitles: (result.subtitles && result.subtitles.length > 0) ? result.subtitles.join(", ") : null,
                level: (result.level) ? result.level : null,
                medium: (result.medium) ? result.medium : null,
                instruction_type: (result.instruction_type) ? result.instruction_type : null,
                accessibilities: (result.accessibilities && result.accessibilities.length > 0) ? result.accessibilities.join(", ") : null,
                availabilities: (result.availabilities && result.availabilities.length > 0) ? result.availabilities.join(", ") : null,
                learn_type: (result.learn_type) ? result.learn_type : null,
                tags: [],
                pricing: {
                    pricing_type: result.pricing_type,
                    currency: result.pricing_currency,
                    regular_price: result.regular_price,
                    sale_price: result.sale_price,
                    offer_percent: (result.sale_price) ? (Math.round(((result.regular_price-result.sale_price) * 100) / result.regular_price)) : null,
                    schedule_of_sale_price: result.schedule_of_sale_price,
                    free_condition_description: result.free_condition_description,
                    conditional_price: result.conditional_price
                }                
            },
            provider_course_url: result.provider_course_url,
            reviews: [],
            ratings: {
                average_rating: 0,
                average_rating_actual: 0,
                rating_distribution: []
            }
        };
        if(result.instructors && result.instructors.length > 0){
            for(let instructor of result.instructors){
                if(instructor.instructor_image){
                    instructor.instructor_image = process.env.ASSET_URL+instructor.instructor_image.thumbnail;
                    data.instructors.push(instructor);
                }
            }
        }
        if(result.instruction_type){
            data.course_details.tags.push(result.instruction_type);
        }
        if(result.medium){
            data.course_details.tags.push(result.medium);
        }

        
        if(result.reviews && result.reviews.length > 0){
            let totalRating = 0;
            let ratings = {};
            for(let review of result.reviews){
                totalRating += review.rating;
                if(review.photo){
                    review.photo = process.env.ASSET_URL+review.photo.thumbnail;
                    data.reviews.push(review);
                }
                if(ratings[review.rating]){
                    ratings[review.rating] += 1; 
                }else{
                    ratings[review.rating] = 1; 
                }
            }

            const average_rating = totalRating/result.reviews.length;            
            data.ratings.average_rating = round(average_rating, 0.5);
            data.ratings.average_rating_actual = average_rating.toFixed(1);            
            let rating_distribution = [];
            Object.keys(ratings)
            .sort()
            .forEach(function(v, i) {
                console.log(v, ratings[v]);
                rating_distribution.push({
                    rating: v,
                    percent: Math.round((ratings[v] * 100) / result.reviews.length)
                });
            });
            data.ratings.rating_distribution = rating_distribution.reverse();
        }
        
        return data;
    }

}