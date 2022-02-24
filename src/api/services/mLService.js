const elasticService = require("./elasticService");
const axios = require("axios");
const defaults = require('../../services/v1/defaults/defaults');

const whetherShowMLCourses = (recommendationType) => {
    switch (recommendationType) {

        case "get-similar-courses":
            if (Math.floor(Math.random() * 100) <= parseInt(defaults.getValue('ml_related_courses'))) {
                return true;
            }
            return false;
    }

}


const getSimilarCoursesDataML = async (courseId, page=1,limit=6) => {
    try {

        if (!courseId) {
            return;
        }
       
        const url = `${process.env.ML_SERVICE_PUBLIC_V1}/get-similar-courses?course_id=${courseId}&page=${page}&limit=${limit}`;
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
                "size": limit,
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
            return { result: result, courseIdSimilarityMap: scores };
        }

        return { result: {}, courseIdSimilarityMap: {} };

    } catch (error) {
        console.log("Error occured while fetching data from ML Server: ");
        if (error.response) {
            console.log(error.response.data);
        }
        else {
            console.log(error);
        }
        return { result: {}, courseIdSimilarityMap: {} };

    }

}

module.exports = {
    getSimilarCoursesDataML,
    whetherShowMLCourses
}