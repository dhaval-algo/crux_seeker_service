const models = require("../../../../models");
const {FORM_TYPE_SOURCE,  DEFAULT_CODES, USER_STATUS, USER_TYPE} = require('../../../utils/defaultCode')
const {getLoginToken} = require('../../../utils/helper')
const Sequelize = require('sequelize');
const eventEmitter = require("../../../utils/subscriber");
const Op = Sequelize.Op;
const handleEnquirySubmission = async (resBody,req) => {
    const { formTypeSource } = resBody;

    switch (formTypeSource) {
        case FORM_TYPE_SOURCE.CALLBACK:
            return await handleCallBackEnquiry(resBody,req);
        break;
        case FORM_TYPE_SOURCE.GENERAL_ENQUIRY:
            return await handleGeneralEnquiry(resBody,req);
        break;
        default:
            break;
    }

}


const handleCallBackEnquiry = (resBody,req) => {
    return new Promise(async (resolve, reject) => {
        const {user, targetEntityType, targetEntityId,otherInfo={...req.useragent},formData, formType, formTypeSource } = resBody;
        let userObj = {...user};
        if(!targetEntityType || !targetEntityId) {
           return resolve({success:false, code:DEFAULT_CODES.FAILED_ENQUIRY.code,message:DEFAULT_CODES.FAILED_ENQUIRY.message})
        }
        
        try {
            
            //check if request is from logged in user or non
            // if logged in fetch user record from users table
            if(user.userId) {
                const resUser = await models.user.findOne({ where: { id: user.userId } });
                userObj = {...userObj,...resUser};
            } else {
                const data = {
                    verified:false,
                    status:USER_STATUS.ACTIVE,
                    userType:USER_TYPE.GUEST
                }
                const resUser = await models.user.create(data)
                userObj = {...userObj,userId:resUser.id, ...data};
            }
            //user meta {key:"", value:"", metaType:""}
            // prepare entries in for user_meta and make entries
            formData.map((f) => { return f['userId'] = userObj.userId})
            const resMeta = await models.user_meta.bulkCreate(formData)
      
            // entries in form_submission
            const form_submission = {
                userId:userObj.userId,
                formType,
                formTypeSource,
                targetEntityType,
                targetEntityId,
                otherInfo
            }

            const formSub = await models.form_submission.create(form_submission)

            let form_submission_values = []
            form_submission_values = resMeta.map((meta) => {  return {objectId:meta.id, objectType:'user_meta', userId:userObj.userId, formSubmissionId:formSub.id }})
            //entries in form_submission_values
            const formSubValues = await models.form_submission_values.bulkCreate(form_submission_values)
            eventEmitter.emit('enquiry_placed',formSub.id)
            if(!user.userId) {
                const tokenRes = await getLoginToken({ ...userObj, audience: req.headers.origin ||"" });
                tokenRes.code =DEFAULT_CODES.CALLBACK_INQUIRY_SUCCESS.code;
                tokenRes.message = DEFAULT_CODES.CALLBACK_INQUIRY_SUCCESS.message
                return resolve(tokenRes)
            }
            return resolve({
                success:true,
                code:DEFAULT_CODES.CALLBACK_INQUIRY_SUCCESS.code,
                message:DEFAULT_CODES.CALLBACK_INQUIRY_SUCCESS.message,
                data :{
                }
            })
            // if(user.id) {
            //     resolve({resBody})
            // }
        } catch (error) {
            console.log(error);
            resolve({
                success:false,
                data :{
                }
            })
        }
    })
}

const handleGeneralEnquiry = (resBody,req) => {
    return new Promise(async (resolve, reject) => {
        const {user, targetEntityType, targetEntityId,otherInfo={...req.useragent},formData, formType, formTypeSource, actionType,updateProfile } = resBody;
        let { formSubmissionId } = resBody;
        insertInCRM = !!lastStep
        let userObj = {...user};
        if(!targetEntityType || !targetEntityId) {
           return resolve({success:false, code:DEFAULT_CODES.FAILED_ENQUIRY.code,message:DEFAULT_CODES.FAILED_ENQUIRY.message})
        }
        
        try {
            
            //user meta {key:"", value:"", metaType:""}
            // prepare entries in for user_meta and make entries
            formData.map((f) => { 
                f['userId'] = userObj.userId
                if((actionType == "signup" || updateProfile) && f['key']!='email' ) {
                    f['metaType'] = "primary"
                }
                return 
            })
            const resMeta = await models.user_meta.bulkCreate(formData)
            if(formType !="signup") {
                if(!formSubmissionId) {
                    // entries in form_submission
                    const form_submission = {
                        userId:userObj.userId,
                        formType,
                        formTypeSource,
                        targetEntityType,
                        targetEntityId,
                        otherInfo
                    }
        
                    const formSub = await models.form_submission.create(form_submission)
                    formSubmissionId = formSub.id
                }
    
                let form_submission_values = []
                form_submission_values = resMeta.map((meta) => {  return {objectId:meta.id, objectType:'user_meta', userId:userObj.userId, formSubmissionId:formSubmissionId }})
                //entries in form_submission_values
                const formSubValues = await models.form_submission_values.bulkCreate(form_submission_values)
                if(insertInCRM) {
                    eventEmitter.emit('enquiry_placed',formSubmissionId)
                }
                return resolve({
                    success:true,
                    code:DEFAULT_CODES.CALLBACK_INQUIRY_SUCCESS.code,
                    message:DEFAULT_CODES.CALLBACK_INQUIRY_SUCCESS.message,
                    data :{
                        formSubmissionId
                    }
                })
            } else {
                return resolve({
                    success:true,
                    message:"Data save succesfully",
                    data :{
                    }
                })
            }
          
            // if(user.id) {
            //     resolve({resBody})
            // }
        } catch (error) {
            console.log(error);
            resolve({
                success:false,
                data :{
                }
            })
        }
    })
}

const handleUserProfileSubmission = (resBody,req) => {
    return new Promise(async (resolve, reject) => {
        const {user,formData  } = resBody;
        let { formSubmissionId } = resBody;
        let userObj = {...user};

        try {
            
            //user meta {key:"", value:"", metaType:""}
            // prepare entries in for user_meta and make entries
            formData.map((f) => { 
                f['userId'] = userObj.userId
                f['metaType'] = "primary"
                return 
            })
            const resMeta = await models.user_meta.bulkCreate(formData)

                return resolve({
                    success:true,
                    data :{
                    }
                })
           
          
            // if(user.id) {
            //     resolve({resBody})
            // }
        } catch (error) {
            console.log(error);
            resolve({
                success:false,
                data :{
                }
            })
        }
    })
}

const fetchFormValues =  (reqBody) => {
    return new Promise(async (resolve,reject) => {

        const { requestFieldMetaType="", requestFields = [], user } = reqBody;
        if(requestFields.length) {
            let where = {
                userId:user.userId,
                key: {[Op.in]:requestFields},
            }
            if(requestFieldMetaType) {
                where["metaType"] = requestFieldMetaType 
            }
            let fieldsRes = await models.user_meta.findAll({
                where
            })
            const formValues = fieldsRes.map((t) => {return {[t.key]:t.value}}).reduce(function(acc, x) {
                for (var key in x) acc[key] = x[key];
                return acc;
            }, {});
            resolve({
                success:true,
                data:{
                    requestFieldValues: {
                        ...formValues
                    }
            
                }
            })
        } else {
            resolve({
                success:false,
                data:{
    
                }
            })
        }
    })
}


const getDefaultValues = async (key, searchString) => {
    let where = {
        optionType:key,
        key: {[Op.in]:requestFields},
    }
    let fieldsRes = await models.user_meta.findAll({
        where
    })
}
module.exports = {
    handleEnquirySubmission,
    fetchFormValues,
    handleUserProfileSubmission
}