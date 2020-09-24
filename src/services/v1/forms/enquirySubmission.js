const models = require("../../../../models");
const {FORM_TYPE_SOURCE, USER_DEFAULTS, DEFAULT_CODES} = require('../../../utils/defaultCode')
const {getLoginToken} = require('../users/user')
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const handleEnquirySubmission = async (resBody,req) => {
    const { formTypeSource } = resBody;

    switch (formTypeSource) {
        case FORM_TYPE_SOURCE.CALLBACK:
            return await handleCallBack(resBody,req);
        break;
    
        default:
            break;
    }
    return {
        ok:"ok"
    }
}


const handleCallBack = (resBody,req) => {
    return new Promise(async (resolve, reject) => {
        const {user, targetEntityType, targetEntityId,otherInfo={},formData, formType, formTypeSource } = resBody;
        let userObj = {...user};
        if(!targetEntityType || !targetEntityType) {
            res.status(500).json({success:false, code:DEFAULT_CODES.FAILED_ENQUIRY.code,message:DEFAULT_CODES.FAILED_ENQUIRY.message})
        }
        
        console.log(user);
        try {
            
            //check if request is from logged in user or non
            // if logged in fetch user record from users table
            if(user.userId) {
                const resUser = await models.user.findOne({ where: { id: user.userId } });
                userObj = {...userObj,...resUser};
            } else {
                const data = {
                    verified:false,
                    status:USER_DEFAULTS.ACTIVE,
                    userType:USER_DEFAULTS.GUEST
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

const fetchFormValues =  (reqBody) => {
    return new Promise(async (resolve,reject) => {

        const { requestFieldMetaType="", requestFields = [], user } = reqBody;
        console.log(reqBody);
        if(requestFields.length) {
            let fieldsRes = await models.user_meta.findAll({
                where: {
                    userId:user.userId,
                    key: {[Op.in]:requestFields},
                    metaType: requestFieldMetaType || null
                }
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
            console.log("here");
            resolve({
                success:false,
                data:{
    
                }
            })
        }
    })
}

module.exports = {
    handleEnquirySubmission,
    fetchFormValues
}