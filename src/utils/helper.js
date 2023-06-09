const OAuth2Client = require('google-auth-library').OAuth2Client;
const Cryptr = require('cryptr');
const { resolve } = require('path');
const { DEFAULT_CODES, LOGIN_TYPES, USER_STATUS, USER_TYPE, TOKEN_TYPES } = require('./defaultCode');
const { default: Axios } = require('axios');
const Linkedin = require('node-linkedin');
const { stringify } = require('querystring');
const models = require("../../models");
const defaults = require('../services/v1/defaults/defaults');
const communication = require('../communication/v1/communication');
const { signToken } = require('../services/v1/auth/auth');
crypt = new Cryptr(process.env.CRYPT_SALT);
const moment = require("moment");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const { Buffer } = require('buffer');
const { publishToSNS } = require('../services/v1/sns');
const elasticService = require("../api/services/elasticService");
const categoryService = require("../api/services/categoryService");
let CategoryService = new categoryService();
const fetch = require("node-fetch");
const apiBackendUrl = process.env.API_BACKEND_URL;
const AES = require("crypto-js/aes");
const encUtf8 = require("crypto-js/enc-utf8");
const modeEcb = require("crypto-js/mode-ecb");

const encryptStr = (str) => {
    return crypt.encrypt(str);
};

const decryptStr = (str) => {
    return crypt.decrypt(str);
};

const isEmail = (email) => {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

const getOtp = (n) => {
    var add = 1, max = 12 - add;
    max = Math.pow(10, n + add);
    var min = max / 10;
    var number = Math.floor(Math.random() * (max - min + 1)) + min;
    return ("" + number).substring(add);
}


const verifySocialToken = (resData) => {
    return new Promise(async (resolve, reject) => {

        try {
            switch (resData.provider) {
                case LOGIN_TYPES.GOOGLE:
                    const varification = await verifyGoogleToken(resData.tokenId);
                    return resolve(varification)
                    break;
                case LOGIN_TYPES.LINKEDIN:
                    const verificationLink = await verifyLinkedInToken(resData)
                    return resolve(verificationLink)
                    break;
                default:
                    break;
            }

        } catch (error) {
            console.log(error)
            resolve({
                code: DEFAULT_CODES.SYSTEM_ERROR.code,
                message: DEFAULT_CODES.SYSTEM_ERROR.message,
                success: false,
                data: { provider: resData.provider }
            })
        }
    })

}

const verifyLinkedInToken = async (resData) => {
    return new Promise(async (resolve, reject) => {
        try {

            const resp = await Axios.post('https://www.linkedin.com/oauth/v2/accessToken', stringify({
                grant_type: "authorization_code",
                code: resData.tokenId,
                redirect_uri: resData.redirectUri,
                client_id: process.env.LINKED_IN_CLIENT_ID,
                client_secret: process.env.LINKED_IN_CLIENT_SECRET
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            })

            // get user profile
            const userProfileRes = await Axios.get('https://api.linkedin.com/v2/me', {
                headers: {
                    'Authorization': 'Bearer ' + resp.data.access_token
                }
            })
            //email address
            const userEmailRes = await Axios.get('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
                headers: {
                    'Authorization': 'Bearer ' + resp.data.access_token
                }
            })
            
            if (!userProfileRes.data.localizedLastName) {
                
                return resolve({
                    code: DEFAULT_CODES.SYSTEM_ERROR.code,
                    message: DEFAULT_CODES.SYSTEM_ERROR.message,
                    success: false,
                    data: { provider: resData.provider }
                })
            }
            if (!userEmailRes.data.elements.length) {
                return resolve({
                    code: DEFAULT_CODES.LINKEDIN_EMAIL_ERROR.code,
                    message: DEFAULT_CODES.LINKEDIN_EMAIL_ERROR.message,
                    success: false,
                    data: { provider: resData.provider }
                })
            }

            return resolve({
                code: DEFAULT_CODES.VALID_TOKEN.code,
                message: DEFAULT_CODES.VALID_TOKEN.message,
                success: true,
                data: {
                    email: userEmailRes.data.elements[0]['handle~'].emailAddress || "",
                    username: userEmailRes.data.elements[0]['handle~'].emailAddress,
                    firstName: userProfileRes.data.localizedFirstName,
                    lastName:userProfileRes.data.localizedLastName,
                    phone: '',
                    provider: LOGIN_TYPES.LINKEDIN
                }
            })
        } catch (error) {
            console.log(error);
            return resolve({
                code: DEFAULT_CODES.SYSTEM_ERROR.code,
                message: DEFAULT_CODES.SYSTEM_ERROR.message,
                success: false,
                data: { provider: resData.provider }
            })
        }

    })

}

const verifyGoogleToken = async (tokenId) => {
    const client = new OAuth2Client(process.env.GOOGLE_APP_ID);
    const ticket = await client.verifyIdToken({
        idToken: tokenId,
        audience: process.env.GOOGLE_APP_ID,
    });
    const payload = ticket.getPayload();
    const userid = payload['sub'];
    let lastName ="", firstName="";
    if(payload.name) {
        let temp = payload.name.split(" ");
        firstName = temp[0];
        if(temp.length>1) {
            lastName = temp[1]
        }
    }
    return {
        code: DEFAULT_CODES.VALID_TOKEN.code,
        message: DEFAULT_CODES.VALID_TOKEN.message,
        success: true,
        data: {
            email: payload.email || "",
            username: payload.email,
            phone: "",
            firstName: firstName,
            lastName:lastName,
            provider: LOGIN_TYPES.GOOGLE
        }
    }
}

const createToken = async (userObj, tokenType) => {
    try {
        let tokenExpiry = 86400
        switch (tokenType) {
            case TOKEN_TYPES.VERIFICATION:
                tokenExpiry = parseInt(defaults.getValue('verificaitonTokenExpiry'))
                break;
            case TOKEN_TYPES.RESETPASSWORD:
                tokenExpiry = parseInt(defaults.getValue('resetPasswordTokenExpiry'))
                break;
            default:
                tokenExpiry = 86400
                break;
        }
        
        const signOptions = {
            audience: (typeof userObj.audience == "undefined")?process.env.FRONTEND_URL : userObj.audience,
            issuer: process.env.HOST,
            expiresIn: tokenExpiry
        }
        const payload = {
            user: {
                /**
                 * This information is disabled because of Information Disclosure vulnerability. 
                 * To sign a JWT token only userId is enough, other information is included to share information.
                 * Ref : https://auth0.com/learn/json-web-tokens/
                 */
                // email: userObj.email || "",
                userId: userObj.userId
            },
            tokenType
        }


        const token = signToken(payload, signOptions);
        //
        let validTill = moment().format("YYYY/MM/DD HH:mm:ss");
        validTill = moment().add(tokenExpiry, "seconds").format("YYYY/MM/DD HH:mm:ss");

        let userAuthToken = {
            tokenId: token,
            userId: userObj.userId,
            tokenType: tokenType || TOKEN_TYPES.VERIFICATION,
            inValid: false,
            validTill: validTill
        };
        await models.auth_token.create(userAuthToken);

        return {
            code: DEFAULT_CODES.LOGIN_SUCCESS.code,
            message: DEFAULT_CODES.LOGIN_SUCCESS.message,
            success: true,
            data: {
                x_token: token
            }
        }
    } catch (error) {
        console.log(error);
    }
}

const sendVerifcationLink = (userObj, useQueue = false) => {
    return new Promise(async (resolve, reject) => {
        try {
            let tokenRes = await createToken(userObj, TOKEN_TYPES.VERIFICATION)
            let params = {
                redirect_url: '/',
                verification_token: tokenRes.data.x_token
            }
            let link = `${defaults.getValue('verificationUrl')}?${stringify(params)}`
            let emailPayload = {
                fromemail: process.env.FROM_EMAIL_VERIFICATION_EMAIL,
                toemail: userObj.email,
                email_type: "activiation_mail",
                email_data: {
                    verification_link: link,
                    account_email: userObj.email,
                    full_name: userObj.fullName,
                }
            }
            await communication.sendEmail(emailPayload, useQueue)
            resolve(true)
        } catch (error) {
            console.log(error);
        }
    })

}


/* 
    * Generate Token for login session
    input => audience- origin(client), provider-> (google facebook or linked in or local)    
    {
        code:'',
        success:true/false,
        message:'',
        data:{
            x_token:""
        }
    }
*/

const getLoginToken = async (userObj) => {
    try {
        const signOptions = {
            audience: userObj.audience,
            issuer: process.env.HOST,
            expiresIn: parseInt(defaults.getValue('tokenExpiry'))
           // expiresIn: 100
        }
        const response_obj = {
            email: userObj.email || "",
            name:  userObj.name || userObj.firstName || "",
            userId: userObj.userId,
            provider: userObj.provider || "",
            userType: userObj.userType,
            isVerified: userObj.isVerified || userObj.verified || false,
            profilePicture: userObj.profilePicture
        }
        const payload = {
            user: {
                /**
                 * This information is disabled because of Information Disclosure vulnerability. 
                 * To sign a JWT token only userId is enough, other information is included to share information.
                 * Ref : https://auth0.com/learn/json-web-tokens/
                 */
                // email: userObj.email || "",
                // name:  userObj.name || userObj.firstName || "",
                userId: userObj.userId
                // provider: userObj.provider || "",
                // userType: userObj.userType,
                // isVerified: userObj.isVerified || userObj.verified || false,
                // profilePicture: userObj.profilePicture
            },
            tokenType:TOKEN_TYPES.SIGNIN
        }
        const token = signToken(payload, signOptions);
        let validTill = moment().format("YYYY/MM/DD HH:mm:ss");
        validTill = moment().add(defaults.getValue('tokenExpiry'), "seconds").format("YYYY/MM/DD HH:mm:ss");
        let userAuthToken = {
            tokenId: token,
            userId: userObj.userId,
            tokenType: TOKEN_TYPES.SIGNIN,
            inValid: false,
            validTill: validTill
        };
        await models.auth_token.create(userAuthToken);
        await models.user.update({
            lastLogin: new Date(),
        }, {
            where: {
                id: userObj.userId
            }
        });

        return {
            code: DEFAULT_CODES.LOGIN_SUCCESS.code,
            message: DEFAULT_CODES.LOGIN_SUCCESS.message,
            success: true,
            data: {
                x_token: token,
                user:response_obj
            }
        }

    } catch (error) {
        console.log(error);
        return {
            code: DEFAULT_CODES.SYSTEM_ERROR.code,
            message: DEFAULT_CODES.SYSTEM_ERROR.message,
            success: false,
            data: {}
        }
    }
}

const invalidateTokens = (userObj, tokenType= null) => {
    return new Promise(async (resolve,reject) => {
        let where = {
            userId:userObj.userId
        }
        if(tokenType)
        {
            where = {
                userId:userObj.userId,
                tokenType:tokenType
            }
        }
        await models.auth_token.destroy({
            where: where
        });
        resolve(true)
    })
}

const sendWelcomeEmail  = (userObj) => {
    return new Promise(async(resolve,reject) => {
        try {
            
            let emailPayload = {
                fromemail: process.env.FROM_EMAIL_WELCOME_EMAIL,
                toemail: userObj.email,
                email_type: "welcome_mail",
            }
            await communication.sendEmail(emailPayload)
            resolve(true)
        } catch (error) {
            console.log(error);
            resolve(true)
        }
    })
}

const sendSuspendedEmail  = (userObj) => {
    return new Promise(async(resolve,reject) => {
        try {
            
            let emailPayload = {
                fromemail: process.env.FROM_EMAIL_SUSPENDED_EMAIL,
                toemail: userObj.email,
                email_type: "suspended_mail",
            }
            await communication.sendEmail(emailPayload)
            resolve(true)
        } catch (error) {
            console.log(error);
            resolve(true)
        }
    })
}

const sendActivatedEmail  = (userObj) => {
    return new Promise(async(resolve,reject) => {
        try {
            
            let emailPayload = {
                fromemail: process.env.FROM_EMAIL_ACTIVATED_EMAIL,
                toemail: userObj.email,
                email_type: "reactivated_mail",
            }
            await communication.sendEmail(emailPayload)
            resolve(true)
        } catch (error) {
            console.log(error);
            resolve(true)
        }
    })
}

const sendResetPasswordLink = (userObj, useQueue) => {
    return new Promise(async (resolve, reject) => {
        try {
            let tokenRes = await createToken(userObj, TOKEN_TYPES.RESETPASSWORD)
            
            let params = {
                redirect_url: '/',
                reset_token: tokenRes.data.x_token
            }
            let link = `${defaults.getValue('resetPasswordUrl')}?${stringify(params)}`
            let emailPayload = {
                fromemail: process.env.FROM_EMAIL_RESET_PASSWORD_EMAIL,
                toemail: userObj.email,
                email_type: "resetpassword_mail",
                email_data: {
                    reset_link: link,
                    account_email: userObj.email,
                    full_name: userObj.fullName,
                }
            }
            await communication.sendEmail(emailPayload, useQueue)
            resolve(true)
        } catch (error) {
            console.log(error);
        }
    })
}

// const calculateProfileCompletion =  (userObj) => {
//     return new Promise(async (resolve) => {
//         try {
//             const sections = {
//                 "profile_picture": {
//                     weightage: 25,
//                     fieldCount: 1,
//                     fields: ["profilePicture"]
//                 },
//                 "basic_information":{
//                     weightage:25,
//                     fieldCount:7,
//                     fields: ["firstName","lastName", 'gender', "dob", "phone","city", "email"]
//                 }
//             }
//             let profileCompleted = 0
        
//             for (const key in sections) {
//                 console.log(sections[key].fields)
//                 const element = sections[key];
//                 const meta = await models.user_meta.findAll({
//                     where:{
//                         metaType:"primary",
//                         key:{[Op.in]:sections[key].fields},
//                         userId:userObj.userId || userObj.id
//                     },
//                     order: [
//                         ['createdAt', 'DESC']
//                     ]
//                 })
//                 if(meta.length) {
//                     const formValues = meta.map((t) => {return {[t.key]:t.value}}).reduce(function(acc, x) {
                        
//                         for (var key in x) {
//                             if(!acc[key])
//                                 acc[key] = x[key]
//                         };
//                         return acc;
//                     }, {});
//                     let fieldEntered = 0
//                     sections[key].fields.forEach( field => {
//                        if(formValues[field]) {
//                            fieldEntered++
//                        }
//                     });
//                     let fieldCount = sections[key].fieldCount
//                     if(key =="work_experience" && formValues['experience']){
//                         if (JSON.parse(formValues['experience']).value.toLowerCase() == 'college student') {
//                             fieldCount = 1
//                         }
//                     }
//                     const secComltd = (sections[key].weightage/fieldCount) * fieldEntered
//                     profileCompleted = profileCompleted + secComltd;
//                 } else {
//                     profileCompleted = profileCompleted + 0
//                 }
                    
//             }
//             let newKeys = [{name:"education",fieldcount:5},{name:"workExp",fieldCount:4}]
//             for(const key in newKeys){
//                 const meta = await models.user_meta.findAll({
//                     where:{
//                         metaType:"primary",
//                         key:{[Op.in]:key.name},
//                         userId:userObj.userId || userObj.id
//                     },
//                     order: [
//                         ['createdAt', 'DESC']
//                     ]
//                 })
//                 console.log('metaaa',meta);
//                 if(meta.length>0){
//                     let vals = Object.keys(meta[0]);
//                     console.log('valss',vals);
//                     for(let i=0;i<vals;i++){
//                         console.log(meta[0][vals[i]]);
//                         let currVal = meta[0][vals[i]];
//                         if(currVal!=""){
//                             const secComltd = (25/key.fieldCount);
//                             profileCompleted = profileCompleted + secComltd;
//                         }
//                     }
//                 }else{
//                     profileCompleted = profileCompleted + 0
//                 }
//             }

//             resolve(Math.ceil(profileCompleted))
            
//         } catch (error) {
//             console.log(error);
//             resolve(0)
//         }
//     })
// }



const calculateProfileCompletion = (userObj) => {
    return new Promise(async (resolve) => {
        try {
            const userId = userObj.userId
            let profileProgress = 0
            const fields = {
                education: {
                    weightage: 15,

                },
                profilePicture: {
                    weightage: 10,

                },
                firstName: {
                    weightage: 4,

                },
                dob: {
                    weightage: 2,

                },
                gender: {
                    weightage: 2,

                },
                city: {
                    weightage: 2,

                },
                resumeFile: {
                    weightage: 20,

                },
                skills: {
                    weightage: 20,

                },
                workExp: {
                    weightage: 15,

                }
                // phone: {
                //     weightage: 5,

                // }
            }

            const verificationFields = {

                verified: {
                    weightage: 5
                },
                phoneVerified: {
                    weightage: 5
                }
            }


            const userData = await models.user_meta.findAll({
                attributes: ["key", "value"],
                
                where: {
                    metaType:"primary",
                    key: { [Op.in]: Object.keys(fields) },
                    userId: userId
                },
                order: [
                    ['createdAt', 'DESC']
                ]
            })

            const userVerificationData = await models.user.findAll({
                attributes: Object.keys(verificationFields),
                where: {

                    id: userId
                }

            })

            const availableFields = userData.filter((field) => {
                if (field.value) {
                    try {
                        // verify whether field.value is an array
    
                        const obj = JSON.parse(field.value)
                        if (Array.isArray(obj)) return obj.length != 0
    
                        //check for empty object
                        if (JSON.stringify(obj) == "{}") return false
                        return true
    
                    } catch {
                        // it is a non empty string 
                        return true
                    }
                }
                else {
                    return false
                }
            })

            profileProgress = availableFields.reduce((accumulator, currField) => {

                return accumulator + fields[currField.key].weightage

                
            }, 0)

            if (userVerificationData.length && userVerificationData[0]["verified"]) {
                profileProgress += verificationFields.verified.weightage
            }
            
            if (userVerificationData.length && userVerificationData[0]['phoneVerified']) {
                profileProgress += verificationFields.phoneVerified.weightage
            }
            else {
                const phoneData = await models.user_meta.findAll({
                    attributes: ["key", "value"],
                    where: {
                        key: { [Op.in]: ["phone"] },
                        userId: userId
                    }

                })
                
                if (phoneData.length && phoneData[0].value) {
                    if (phoneData[0].value.slice(0, 2) != '91') {
                        profileProgress += verificationFields.phoneVerified.weightage
                    }
                }
            }
        
            resolve(profileProgress)
        } catch (error) {
            console.log("Profile progress err", error);
            resolve(null)
        }
    })
}

const getImgBuffer = (base64) => {
    const base64str = base64.replace(/^data:image\/\w+;base64,/,'');
    return Buffer.from(base64str, 'base64')
}




const getFileBuffer = (base64) => {
    const base64str = base64.split(';base64,');
    // return base64str[1];
    return Buffer.from(base64str[1], 'base64')
}


const getMediaurl = (mediaUrl) => {
    if(mediaUrl !== null && mediaUrl !== undefined){
        const isRelative = !mediaUrl.match(/(\:|\/\\*\/)/);
        if(isRelative){
            mediaUrl = process.env.ASSET_URL+mediaUrl;
        }
    }    
    return mediaUrl;
};

const round = (value, step) => {
    step || (step = 1.0);
    var inv = 1.0 / step;
    return Math.round(value * inv) / inv;
};

const generateSingleViewData = (result, isList = false) => {

    let effort = null;
    if(result.recommended_effort_per_week){
        let efforUnit = (result.recommended_effort_per_week > 1) ? 'hours per week' : 'hour per week';
        effort = `${result.recommended_effort_per_week} ${efforUnit}`
    }
    // let coverImageSize = 'small';
    // if(isList){
    //     coverImageSize = 'thumbnail';
    // }

    // let cover_image = null;
    // if(result.images){
    //     if(result.images[coverImageSize]){
    //         cover_image = getMediaurl(result.images[coverImageSize]);
    //     }else{
    //         cover_image = getMediaurl(result.images['thumbnail']);
    //     }
    // }
    for(let i=0; i<result.reviews.length; i++){
        if(result.reviews[i]['reviewer_name'] == 'Other'){
            result.reviews.splice(i, 1);
        }
    }

    let data = {
        title: result.title,
        slug: result.slug,
        id: `LRN_CNT_PUB_${result.id}`,
        subtitle: result.subtitle,
        provider: {
            name: result.provider_name,
            currency: result.provider_currency,
            slug: result.provider_slug
        },
        instructors: [],
        cover_video: (result.video) ? getMediaurl(result.video) : null,
        cover_image: (result.images)? result.images :null,
        embedded_video_url: (result.embedded_video_url) ? result.embedded_video_url : null,
        description: result.description,
        skills: (!isList) ? result.skills_gained : null,
        what_will_learn: (!isList) ? result.what_will_learn : null,
        target_students: (!isList) ? result.target_students : null,
        prerequisites: (!isList) ? result.prerequisites  : null,
        content: (!isList) ? result.content : null,
        categories: (result.categories) ? result.categories : [],
        sub_categories: (result.sub_categories) ? result.sub_categories : [],
        course_details: {
            //duration: (result.total_duration_in_hrs) ? Math.floor(result.total_duration_in_hrs/duration_divider)+" "+duration_unit : null,
            duration: calculateDuration(result.total_duration_in_hrs),
            total_duration_unit: result.total_duration_unit, 
            effort: effort,
            total_video_content: result.total_video_content_in_hrs,
            total_video_content_unit: result.total_video_content_unit,
            language: result.languages.join(", "),
            subtitles: (result.subtitles && result.subtitles.length > 0) ? result.subtitles.join(", ") : null,
            level: (result.level) ? result.level : null,
            medium: (result.medium) ? result.medium : null,
            instruction_type: (result.instruction_type) ? result.instruction_type : null,
            accessibilities: (result.accessibilities && result.accessibilities.length > 0) ? result.accessibilities.join(", ") : null,
            availabilities: (result.availabilities && result.availabilities.length > 0) ? result.availabilities.join(", ") : null,
            learn_type: (result.learn_type) ? result.learn_type : null,
            topics: (result.topics.length  > 0) ? result.topics.join(", ") : null,
            tags: [],
            pricing: {
                display_price: ( typeof result.display_price !='undefined' && result.display_price !=null)? result.display_price :true,
                pricing_type: result.pricing_type,
                currency: result.learn_content_pricing_currency? result.learn_content_pricing_currency.iso_code:null,
                regular_price: result.regular_price,
                sale_price: result.sale_price,
                offer_percent: (result.sale_price) ? (Math.round(((result.regular_price-result.sale_price) * 100) / result.regular_price)) : null,
                schedule_of_sale_price: result.schedule_of_sale_price,
                free_condition_description: result.free_condition_description,
                conditional_price: result.conditional_price,
                pricing_additional_details: result.pricing_additional_details,
                course_financing_options: result.course_financing_options,
                finance_option: result.finance_option,
                finance_details: result.finance_details
            }                
        },
        provider_course_url: result.provider_course_url,
        reviews: [],
        ratings: {
            total_review_count: result.reviews ? result.reviews.length : 0,
            average_rating: 0,
            average_rating_actual: 0,
            rating_distribution: []
        },
        live_class: result.live_class,
        human_interaction: result.human_interaction,
        personalized_teaching: result.personalized_teaching,
        post_course_interaction: result.post_course_interaction,
        international_faculty: result.international_faculty,
        batches: [],
        enrollment_start_date: result.enrollment_start_date,
        enrollment_end_date: result.enrollment_end_date,
        hands_on_training: {
            learning_mediums: result.learning_mediums,
            virtual_labs: result.virtual_labs,
            case_based_learning: result.case_based_learning,
            assessments: result.assessments,
            capstone_project: result.capstone_project
        },
        placement: {
            internship: result.internship,
            job_assistance: result.job_assistance,
            alumni_network: result.alumni_network,
            placements: (result.placements) ? result.placements : [],
            average_salary: result.average_salary,
            highest_salary: result.highest_salary
        },
        corporate_sponsors: (result.corporate_sponsors) ? result.corporate_sponsors : [],
        accreditations: (result.accreditations) ? result.accreditations : []
    };

    if(!isList){
        data.meta_information = {
            meta_title: result.meta_title,
            meta_description: result.meta_description,
            meta_keywords: result.meta_keywords,
            add_type: result.add_type,
            import_source: result.import_source,
            external_source_id: result.external_source_id,
            application_seat_ratio: result.application_seat_ratio,
            bounce_rate: result.bounce_rate,
            completion_ratio: result.completion_ratio,
            enrollment_ratio: result.enrollment_ratio,
            faculty_student_ratio: result.faculty_student_ratio,
            gender_diversity: result.gender_diversity,
            student_stream_diversity: result.student_stream_diversity,
            student_nationality_diversity: result.student_nationality_diversity,
            average_salary_hike: result.average_salary_hike,
            instructor_citations: result.instructor_citations
        }
    }

    if(!isList){
        if(result.instructors && result.instructors.length > 0){
            for(let instructor of result.instructors){
                if(instructor.name == 'Other'){
                    continue;
                }
                if(instructor.instructor_image){
                    instructor.instructor_image = process.env.ASSET_URL+instructor.instructor_image.thumbnail;                    
                }
                data.instructors.push(instructor);
            }
        }
        if(result.instruction_type){
            data.course_details.tags.push(result.instruction_type);
        }
        if(result.medium){
            data.course_details.tags.push(result.medium);
        }
    }
                          
    

    
    if(result.reviews && result.reviews.length > 0){
        let totalRating = 0;
        let ratings = {};
        for(let review of result.reviews){
            totalRating += review.rating;
            
            if(!isList){
                if(review.photo){
                    review.photo = process.env.ASSET_URL+review.photo.thumbnail;                    
                }
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

    //Ignore default values in ui
    if(data.course_details.learn_type == 'Others'){
        data.course_details.learn_type = null;
    }
    if(data.course_details.topics == 'Others'){
        data.course_details.topics = null;
    }
    if(data.course_details.medium == 'Others'){
        data.course_details.medium = null;
    }
    if(data.course_details.instruction_type == 'Others'){
        data.course_details.instruction_type = null;
    }
    if(data.course_details.language == 'Others'){
        data.course_details.language = null;
    }
    if(data.course_details.pricing.pricing_type == 'Others'){
        data.course_details.pricing.pricing_type = null;
    }
    if(data.content == "Dummy content."){
        data.content = null;
    }
    if(data.skills && data.skills.length > 0){
        for(let i=0; i<data.skills.length; i++){
            if(data.skills[i] == 'Others'){
                data.skills.splice(i, 1);
            }
        }
    }
    return data;
}

const calculateDuration = (total_duration_in_hrs) => {
    const hourse_in_day = 8;
    const days_in_week = 5;
    let duration = null;
        if(total_duration_in_hrs){
            let totalDuration = null;
            let durationUnit = null;
            if(total_duration_in_hrs < (hourse_in_day*days_in_week)){
                totalDuration = total_duration_in_hrs;
                durationUnit = (totalDuration > 1) ? 'hours': 'hour';
                return `${totalDuration} ${durationUnit}`;
            }

            const week = Math.floor((hourse_in_day*days_in_week)/7);
            if(week < 4){
                totalDuration = week;
                durationUnit = (week > 1) ? 'weeks': 'week';
                return `${totalDuration} ${durationUnit}`;
            }

            const month = Math.floor(week/4);
            if(month < 12){
                totalDuration = month;
                durationUnit = (month > 1) ? 'months': 'month';
                return `${totalDuration} ${durationUnit}`;
            }

            const year = Math.floor(month/12);
            totalDuration = year;
            durationUnit = (year > 1) ? 'years': 'year';
            return `${totalDuration} ${durationUnit}`;
        }
        return duration;
};

const generateReferenceId = () => {
    return Math.floor(Math.random() * 100)+''+new Date().getTime();
}

const roundOff = (number, precision) => {
    return Math.round((number + Number.EPSILON) * Math.pow(10, precision)) / Math.pow(10, precision);
}

const sendDataForStrapi = (userMeta, action) => {
    switch (action) {
        case "new-user":
            userData = userMeta.map((t) => {return {[t.key]:t.value}}).reduce(function(acc, x) {
                for (var key in x) acc[key] = x[key];
                return acc;
            }, {});
            break;
        
        case "update-user-profile":
            userData = userMeta.map((t) => {return {[t.key]:t.value}}).reduce(function(acc, x) {
                for (var key in x) acc[key] = x[key];
                return acc;
            }, {});
            let city = null;
            if(userData.city)
            {
                city = JSON.parse(userData.city)
                userData.city = city.label
            }            
            if(userData.dob)
            {
                userData.date_of_birth = moment(userData.dob.split("/").reverse().join("-"))
            }            
            
            if(userData.workExp)
            {
                userData.experience = []
                for (let workExp of JSON.parse(userData.workExp))
                {
                    userData.experience.push({
                        "job_title": workExp.jobTitle===null?undefined:workExp.jobTitle.label,
                        "industry": workExp.industry===null?undefined:workExp.industry.label,
                        "company_name": workExp.company===null?undefined:workExp.company.label,
                        "experience": workExp.experience,                    
                        "currentCompany": (workExp.currentCompany=="")? false : workExp.currentCompany               
                    })
                }
            }
            
            if(userData.education)
            {
                userData.educations = []
                for (let education of JSON.parse(userData.education))
                {
                    userData.educations.push({                    
                        "institute": education.instituteName===null?undefined:education.instituteName.label,
                        "degree": education.degree===null?undefined:education.degree.label,
                        "specialization":education.specialization===null?undefined:education.specialization.label,
                        "year_of_graduation": education.graduationYear,
                        "grade": education.grade,
                        "grade_type":education.gradeType           
                    })
                }
            }
            delete userData.instituteName
            delete userData.education
            delete userData.industry
            delete userData.company
            delete userData.workExp
            delete userData.grade
            delete userData.graduationYear
            delete userData.degree
            delete userData.specialization
            delete userData.jobTitle
            break;    
        case "update-profile-enquiries":
            userData = userMeta
            break;
        case "update-learnpath-profile-enquiries":
            userData = userMeta
            break;
        case "profile-add-wishlist":
            userData = userMeta
            break;
        case "profile-remove-wishlist":
            userData = userMeta
            break;
        case "profile-bookmark-article":
                userData = userMeta
                break;
        case "profile-remove-bookmark-article":
            userData = userMeta
            break;
        case "update-learn-profile":
            userData = userMeta
            break;
        case "update-profile-picture":
            userData = userMeta
            break;
        case "remove-profile-picture":
            userData = userMeta
            break;
        case "upload-resume":
            userData = userMeta
            break;
        case "remove-resume":
            userData = userMeta
            break;
        case "profile-add-learnpath-wishlist":
            userData = userMeta
            break;
        case "profile-remove-learnpath-wishlist":
            userData = userMeta
            break;                        
        case "update-email":
            userData = userMeta
            break;
        case "update-phone":
            userData = userMeta   
            break;                    
        default:
            break;
    }
   publishToSNS(process.env.USER_PROFILE_TOPIC_ARN, userData, action)
}

const logActvity = async (type, userId, resource) => {
    userId = (userId)? userId : 0
    const activity =  await models.activity.findOne({ where: {type:type} });
    if (type == "INSTITUTE_WISHLIST"){
        const dataToLog = resource.map((instituteId) => {

            return {
                userId,
                activityId:activity.id,
                resource: instituteId
            }
        })
        await models.activity_log.bulkCreate(dataToLog)
        return
    }
    if (type=="COURSE_WISHLIST"){
        const dataToLog=resource.map((courseId)=>{
            return {
            userId:userId,
            activityId:activity.id,
            resource:courseId
            }
        })
        await models.activity_log.bulkCreate(dataToLog)
        return
    }
    if (type=="LEARNPATH_WISHLIST"){
        const dataToLog=resource.map((learnpathId)=>{
            return {
            userId:userId,
            activityId:activity.id,
            resource:learnpathId
            }
        })
        await models.activity_log.bulkCreate(dataToLog)
        return
    }
    if (type=="ARTICLE_WISHLIST"){
        const dataToLog=resource.map((articleId)=>{
            return {
            userId:userId,
            activityId:activity.id,
            resource:articleId
            }
        })
        await models.activity_log.bulkCreate(dataToLog)
        return
    }
    if (type=="NEWS_WISHLIST"){
        const dataToLog = resource.map((newsId)=>{
            return {
                userId,
                activityId:activity.id,
                resource:newsId
            }
        })
        await models.activity_log.bulkCreate(dataToLog)
        return
    }
    if(userId > 0)
    {
        const activity_log = await models.activity_log.create({
            userId: userId,
            activityId:activity.id,
            resource: resource
        })
    }
    else
    {
        const activity_log = await models.activity_log_loggedout.create({
            activityId:activity.id,
            resource: resource
        })
    }
    
    return resource;
}

const logPopularEntities = async (type, resource) => {
    switch(type){
        case "skills":
            let existEntry = await models.popular_skills.findOne({where:{name:resource}})
            if(!existEntry){
                await models.popular_skills.create({ name:resource, count:1})
            }else{
                await models.popular_skills.update({count:existEntry.count+1},{where:{id: existEntry.id, name:resource}})
            }
        case "categories":
            let existEntryCategories = await models.popular_categories.findOne({where:{name:resource}})
            if(!existEntryCategories){
                await models.popular_categories.create({ name:resource, count:1})
            }else{
                await models.popular_categories.update({count:existEntryCategories.count+1},{where:{id: existEntryCategories.id, name:resource}})
            }
        case "topics":
            let existEntryTopics = await models.popular_topics.findOne({where:{name:resource}})
            if(!existEntryTopics){
                await models.popular_topics.create({ name:resource, count:1})
            }else{
                await models.popular_topics.update({count:existEntryTopics.count+1},{where:{id: existEntryTopics.id, name:resource}})
            }
        default:
            break
    }
    
    return resource;
}

        //check if provided Id is valid(exits) in its index (elastic search)
const validateIdsFromElastic = async (index, ids) => {

        let esQuery = {
            bool: {
                must: [{ terms: {"_id": ids} }]
            }
        }

        const result = await elasticService.search(index, esQuery, {}, ["_id"]);

        if (result.hits && result.hits.length) {
            existingIds = result.hits.filter(hit => ids.includes(hit._id) )
            return existingIds.map(hit => hit._id )
        }
        return [];
}

//get the redirect url for old url
const getRedirectUrl = async (req) => {    
    if(req.query.pageUrl)
    {
        let response = await fetch(`${apiBackendUrl}/url-redirections?old_url_eq=${req.query.pageUrl}`);
        if (response.ok) {
            let urls = await response.json();
            
            if(urls.length > 0){  
                return urls[0].new_url
               
            }else{
                return false
            }
        }
    }
    else{
        return false
    }
}

const getTreeUrl = async (type, label, onlySulg = false) => {
    let data = await CategoryService.getTreeV2();
    if(type =='category')
    {
        for(let category of data)
        {
            if(label == category.label)
            {
                return onlySulg? category.slug : `courses/${category.slug}`
            }
        }
    }
    else if(type =='sub-category')
    {
        for(let category of data)
        {
            if(category.child && category.child.length > 0){
                for(let sub_category of category.child){
                    if(label == sub_category.label)
                    {
                        return onlySulg? sub_category.slug : `courses/${category.slug}/${sub_category.slug}`
                    }
                }
                
            }            
        }
    }
    else if(type =='topic')
    {
        for(let category of data)
        {
            if(category.child && category.child.length > 0){
                for(let sub_category of category.child){
                    if(sub_category.child && sub_category.child.length > 0){
                        for(let topic of sub_category.child){
                            if(label == topic.label)
                            {
                                return onlySulg? topic.slug :`topic/${topic.slug}`
                            }
                        }
                        
                    }
                }
                
            }            
        }
    }
    else{
        return false
    }
   
}

const encryptUserId = async (userId) => {
    let key = process.env.ECOM_USER_ENCRYPTION_KEY
    let plaintext = encUtf8.parse(userId);
    let secSpec = encUtf8.parse(key);
    var encrypted = AES.encrypt(plaintext, secSpec, { mode: modeEcb });
    return Buffer.from(encrypted.toString(), 'utf8').toString('hex');
}

const formatCount = (count) => {
    if(count > 1000){
        count = Math.floor(count/1000).toLocaleString('en-US')+'k';
        }else 
        {
            count = count.toLocaleString('en-US')
        }
        return count
    }
   
module.exports = {
    validateIdsFromElastic,
    encryptStr,
    decryptStr,
    isEmail,
    getOtp,
    verifySocialToken,
    createToken,
    sendVerifcationLink,
    getLoginToken,
    invalidateTokens,
    sendWelcomeEmail,
    sendResetPasswordLink,
    calculateProfileCompletion,
    getImgBuffer,
    getFileBuffer,
    generateSingleViewData,
    generateReferenceId,
    roundOff,
    sendDataForStrapi,
    sendSuspendedEmail,
    sendActivatedEmail,
    logActvity,
    logPopularEntities,
    getRedirectUrl,
    getTreeUrl,
    encryptUserId,
    formatCount
}