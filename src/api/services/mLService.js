const elasticService = require("./elasticService");
const axios = require("axios");
const defaults = require('../../services/v1/defaults/defaults');
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();
const fetch = require("node-fetch");
const apiBackendUrl = process.env.API_BACKEND_URL;


const whetherShowMLCourses = async (recommendationType) => {
    switch (recommendationType) {

        case "get-similar-courses":
            if (Math.floor(Math.random() * 100) <= parseInt(defaults.getValue('ml_related_courses'))) {
                return true;
            }
            return false;
        case "courses-recommendation":
            let ml_counter=0;
            let logic_counter=0;
            let response = await fetch(`${apiBackendUrl}/learn-content-weight?_limit=-1`)
            if (response.ok) {
                let json = await response.json();
                if(json){
                    ml_counter = json.user_weights.ml_based_user
                    logic_counter = json.user_weights.logic_based_user
                }
            }
            let cacheKey = 'user-percentage';
            let cachedData = await RedisConnection.getValuesSync(cacheKey, customKey=true);
            
            let user_percentage={ml_counter:0, logic_counter:1}
            
            if (cachedData.noCacheData != true) {
                user_percentage=cachedData
                if(user_percentage.logic_counter < logic_counter){
                    user_percentage.logic_counter = user_percentage.logic_counter+1
                    RedisConnection.set(cacheKey, user_percentage);
                    return false
                }else if(user_percentage.ml_counter < ml_counter){
                    user_percentage.ml_counter = user_percentage.ml_counter + 1
                    RedisConnection.set(cacheKey, user_percentage);
                    return true
                }else{
                    // user_percentage={ml_counter:0, logic_counter:1}
                    // RedisConnection.set(cacheKey, user_percentage);

                    /**
                     * This case can also make cohorts in AB Testing. Now If you want to start sampling again flush the cache and start again.
                     * For cohorts we can just send False if rest is LOGIC or True if rest is ML to send.
                     */
                    return false
                }
            }else{
                RedisConnection.set(cacheKey, user_percentage);
                return false
            }

    }

}


const getSimilarCoursesDataML = async (courseId) => {
    try {

        if (!courseId) {
            return;
        }

        const count = process.env.ML_SIMILAR_COURSE_COUNT || 20;
        const cacheName = `ml-similar-course-${courseId}-${count}`;
        const cacheData = await RedisConnection.getValuesSync(cacheName);
        if (!cacheData.noCacheData) {

            return cacheData;
        }

        else {

            const url = `${process.env.ML_SERVICE_PUBLIC_V1}/similar-course/${courseId}?count=${count}`;
            const response = await axios.get(url);
            if (response.status == 200) {

                let scores = {};
                const course_ids = [];
                let courses_data = [];

                if (response.data.courses) {

                    response.data.courses.forEach((course_id, i) => {

                        scores[`LRN_CNT_PUB_${course_id}`] = i;
                        course_ids.push(`LRN_CNT_PUB_${course_id}`);

                    });

                    let esQuery = {
                        "from": 0,
                        "size": count,
                        "sort": [
                            {
                                "_script": {
                                    "order": "asc",
                                    "type": "number",
                                    "script": {
                                        "lang": "painless",
                                        "inline": "return params.scores[doc['_id'].value];",
                                        "params": {
                                            "scores": scores
                                        }
                                    }
                                }
                            }
                        ],
                        "query": {
                            "bool": {
                                "must_not": {
                                    "term": {
                                        "_id": `LRN_CNT_PUB_${courseId}`
                                    }
                                },
                                "must": [
                                    {
                                        "term": {
                                            "status.keyword": "published"
                                        }
                                    },
                                    {
                                        "ids": {
                                            "values": course_ids
                                        }
                                    }
                                ]
                            }
                        }
                    }
                    const result = await elasticService.plainSearch("learn-content", esQuery);
                    if (result && result.hits && result.hits.hits && result.hits.hits.length) {
                        courses_data = result.hits.hits;
                    }

                }

                RedisConnection.set(cacheName, courses_data);
                RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_ML_SIMILAR_COURSE || 86400);
                return courses_data;
            }
        }

        return [];

    } catch (error) {
        console.log("Error occured while fetching data from ML Server: ");
        if (error.response) {
            console.log(error.response.data);
        }
        else {
            console.log(error);
        }
        return [];

    }

}


const getUserCourseRecommendations = async (userId, recommendationType, count = 20) => {

    try {

        const cacheName = `ml-user-course-recommendation-${userId}-${recommendationType}`;
        const cacheData = await RedisConnection.getValuesSync(cacheName);
        if (!cacheData.noCacheData) {

            return cacheData;
        }

        const url = `${process.env.ML_SERVICE_PUBLIC_V1}/user-course-recommendation/${userId}?recommendation_type=${recommendationType}&count=${count}`;
        console.log(url);
        const response = await axios.get(url);
        if (response.status == 200) {

            let scores = {};
            const course_ids = [];
            let courses_data = [];

            if (response.data.courses) {

                response.data.courses.forEach((course_id, i) => {

                    scores[`LRN_CNT_PUB_${course_id}`] = i;
                    course_ids.push(`LRN_CNT_PUB_${course_id}`);

                });

                let esQuery = {
                    "from": 0,
                    "size": count,
                    "sort": [
                        {
                            "_script": {
                                "order": "asc",
                                "type": "number",
                                "script": {
                                    "lang": "painless",
                                    "inline": "return params.scores[doc['_id'].value];",
                                    "params": {
                                        "scores": scores
                                    }
                                }
                            }
                        }
                    ],
                    "query": {
                        "bool": {
                            "must": [
                                {
                                    "term": {
                                        "status.keyword": "published"
                                    }
                                },
                                {
                                    "ids": {
                                        "values": course_ids
                                    }
                                }
                            ]
                        }
                    }
                }
                const result = await elasticService.plainSearch("learn-content", esQuery);
                if (result && result.hits && result.hits.hits && result.hits.hits.length) {
                    courses_data = result.hits.hits;
                }

            }

            RedisConnection.set(cacheName, courses_data);
            RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_ML_USER_COURSE || 120);
            return courses_data;

        }

        return [];

    } catch (error) {
        console.log("Error occured while fetching user course recommendations from ML Server: ");
        if (error.response) {
            console.log(error.response.data);
        }
        else {
            console.log(error);
        }
        return [];
    }

}

module.exports = {
    getSimilarCoursesDataML,
    getUserCourseRecommendations,
    whetherShowMLCourses
}