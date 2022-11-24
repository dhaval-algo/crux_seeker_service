const elasticService = require("../../../api/services/elasticService");
const learnContentService = require("../../../api/services/learnContentService");
let LearnContentService = new learnContentService();
const learnPathService = require("../../../api/services/learnPathService");
let LearnPathService = new learnPathService();
const axios = require("axios");

const AES = require("crypto-js/aes");
const encUtf8 = require("crypto-js/enc-utf8");
const modeEcb = require("crypto-js/mode-ecb");

const encryptUserId = async (userId) => {
    let key = process.env.ECOM_USER_ENCRYPTION_KEY
    let plaintext = encUtf8.parse(userId);
    let secSpec = encUtf8.parse(key);
    var encrypted = AES.encrypt(plaintext, secSpec, { mode: modeEcb });
    return encrypted.toString();
}


const oderDetails = async (req, res, next) => {
    try {
        let errorResponse = {
            'success': false,
            'message': 'something went wrong, Please try again',
            'data': {}
        }
        let order_id = req.query.orderId
        let user_id = await encryptUserId(req.user.userId)
        let request_url = `${process.env.ECOM_API_URL}/ecommerce/user/order_details/${user_id}/${order_id}`
        let finalData = {}
        axios.get(request_url).then(async (response) => {

            if (response.data.status == 'OK' && response.data.data) {
                finalData.orderData = response.data.data[0]
                switch (finalData.orderData.orderItems[0].itemType) {
                    case 'course':
                        try {
                            let courses = await LearnContentService.getCourseByIds({ query: { ids: finalData.orderData.orderItems[0].itemId.toString() } });
                            if (courses && courses.length > 0) {
                                finalData.coursesData = {
                                    title: courses[0].title,
                                    slug: courses[0].slug,
                                    id: courses[0].id,
                                    partner: courses[0].partner,
                                    cover_image: courses[0].cover_image,
                                    card_image: courses[0].card_image,
                                    card_image_mobile: courses[0].card_image_mobile,
                                    description: courses[0].description,
                                    faq: courses[0].faq,
                                    course_start_date:courses[0].course_start_date,
                                    course_end_date:courses[0].course_end_date,
                                    features: {
                                        accessibilities: courses[0].course_details.accessibilities,
                                        level: courses[0].course_details.level,
                                        course_enrollment_start_date: courses[0].course_details.course_enrollment_start_date,
                                        course_enrollment_end_date: courses[0].course_details.course_enrollment_end_date,                                        
                                        instruction_type: courses[0].course_details.instruction_type,                                        
                                        medium: courses[0].course_details.medium,
                                        availabilities: courses[0].course_details.availabilities,
                                        availabilities: courses[0].course_details.availabilities,
                                        duration : courses[0].course_details.duration,
                                        total_duration_unit:  courses[0].course_details.total_duration_unit, 
                                        total_video_content : courses[0].course_details.total_video_content,
                                        total_video_content_unit : courses[0].course_details.total_video_content_unit,                                        
                                        effort: courses[0].course_details.effort,
                                        course_batch: courses[0].course_details.course_batch,
                                        subtitles: courses[0].course_details.subtitles,
                                        language: courses[0].course_details.language,                                         
                                    }
                                }
                               // finalData.coursesdata = courses[0]
                            }
                        } catch (error) {
                            console.log("No course for id", error)
                            finalData.coursesdata = null
                        }
                        break;
                    case 'lp':
                        try {
                            let courses = await LearnPathService.getLearnpathByIds({ query: { ids: finalData.orderData.orderItems[0].itemId.toString() } });
                            if (courses && courses.length > 0) {
                                finalData.learnPathData = {
                                    title: courses[0].title,
                                    slug: courses[0].slug,
                                    id: courses[0].id,
                                    cover_image: courses[0].cover_image,
                                    card_image: courses[0].card_image,
                                    card_image_mobile: courses[0].card_image_mobile,
                                    description: courses[0].description,
                                    faq: courses[0].faq,
                                    courses: courses[0].courses
                                }
                            }
                        } catch (error) {
                            console.log("No course for id", error)
                            finalData.coursesdata = null
                        }
                        break;
                    default:
                        finalData.coursesdata = null
                        break;
                }



                return res.status(200).json({
                    'success': true,
                    'message': 'Fetch successfully!',
                    'data': finalData
                });

            } else {
                return res.status(200).json(errorResponse);
            }

        }).catch(error => {
            console.log(error);
            return res.status(200).json(errorResponse);
        })


    } catch (error) {
        console.log(error);
        return res.status(200).json(errorResponse);
    }
}

module.exports = {
    oderDetails
}