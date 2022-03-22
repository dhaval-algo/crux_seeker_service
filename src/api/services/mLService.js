const elasticService = require("./elasticService");
const axios = require("axios");
const defaults = require('../../services/v1/defaults/defaults');
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();

const whetherShowMLCourses = (recommendationType) => {
    switch (recommendationType) {

        case "get-similar-courses":
            if (Math.floor(Math.random() * 100) <= parseInt(defaults.getValue('ml_related_courses'))) {
                return true;
            }
            return false;
    }

}


const getSimilarCoursesDataML = async (courseId) => {
    try {

        if (!courseId) {
            return;
        }

        const count = process.env.ML_SIMILAR_COURSE_COUNT || 20;
        const cacheName = `ml-similar-course-${count}`;
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