const elasticService = require("./elasticService");
const axios = require("axios");
const defaults = require('../../services/v1/defaults/defaults');
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();
const fetch = require("node-fetch");
const apiBackendUrl = process.env.API_BACKEND_URL;


const whetherShowMLCourses = (recommendationType) => {
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
                    user_percentage={ml_counter:0, logic_counter:1}
                    RedisConnection.set(cacheKey, user_percentage);
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

            const url = `${process.env.ML_SERVICE_PUBLIC_V1}/get-similar-courses?course_id=${courseId}&count=${count}`;
            const response = await axios.get(url);
            if (response.status == 200) {

                let scores = {};
                const course_ids = [];
                response.data["data"].forEach((course) => {

                    scores[`LRN_CNT_PUB_${course.course_id}`] = course.similarity;
                    course_ids.push(`LRN_CNT_PUB_${course.course_id}`);

                });

                let esQuery = {
                    "from": 0,
                    "size": count,
                    "sort": [
                        {
                            "_script": {
                                "order": "desc",
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

                    const data = { result: result.hits.hits, courseIdSimilarityMap: scores };
                    RedisConnection.set(cacheName, data);
                    RedisConnection.expire(cacheName, process.env.CACHE_EXPIRE_ML_SIMILAR_COURSE || 86400);
                    return data;

                }
            }
        }

        return { result: [], courseIdSimilarityMap: {} };

    } catch (error) {
        console.log("Error occured while fetching data from ML Server: ");
        if (error.response) {
            console.log(error.response.data);
        }
        else {
            console.log(error);
        }
        return { result: [], courseIdSimilarityMap: {} };

    }

}

module.exports = {
    getSimilarCoursesDataML,
    whetherShowMLCourses
}