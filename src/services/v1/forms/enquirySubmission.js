const models = require("../../../../models");
const { FORM_TYPE_SOURCE, DEFAULT_CODES, USER_STATUS, USER_TYPE } = require('../../../utils/defaultCode')
const { getLoginToken, calculateProfileCompletion, sendDataForStrapi,logActvity } = require('../../../utils/helper')
const Sequelize = require('sequelize');
const eventEmitter = require("../../../utils/subscriber");
const Op = Sequelize.Op;
const moment = require("moment");
const handleEnquirySubmission = async (resBody, req) => {
    const { formTypeSource } = resBody;

    switch (formTypeSource) {
        case FORM_TYPE_SOURCE.CALLBACK:
            return await handleCallBackEnquiry(resBody, req);
            break;
        case FORM_TYPE_SOURCE.GENERAL_ENQUIRY:
            return await handleGeneralEnquiry(resBody, req);
            break;
        default:
            break;
    }

}


const handleCallBackEnquiry = (resBody, req) => {
    return new Promise(async (resolve, reject) => {
        let { user, targetEntityType, targetEntityId, otherInfo, formData, formType, formTypeSource } = resBody;
        let userObj = { ...user };
        otherInfo = {...otherInfo, ...req.useragent, userIp: req.ip }
        if (!targetEntityType || !targetEntityId) {
            return resolve({ success: false, code: DEFAULT_CODES.FAILED_ENQUIRY.code, message: DEFAULT_CODES.FAILED_ENQUIRY.message })
        }

        try {

            //check if request is from logged in user or non
            // if logged in fetch user record from users table
            if (user.userId) {
                const resUser = await models.user.findOne({ where: { id: user.userId } });
                userObj = { ...userObj, ...resUser };
            } else {
                const data = {
                    verified: false,
                    status: USER_STATUS.ACTIVE,
                    userType: USER_TYPE.GUEST
                }
                const resUser = await models.user.create(data)
                userObj = { ...userObj, userId: resUser.id, ...data };
            }
            //user meta {key:"", value:"", metaType:""}
            // prepare entries in for user_meta and make entries
            formData.map((f) => { return f['userId'] = userObj.userId })
            const resMeta = await models.user_meta.bulkCreate(formData)

            // entries in form_submission
            const form_submission = {
                userId: userObj.userId,
                formType,
                formTypeSource,
                targetEntityType,
                targetEntityId,
                otherInfo,
                status:"submitted"
            }

            const formSub = await models.form_submission.create(form_submission)
            
            let form_submission_values = []
            form_submission_values = resMeta.map((meta) => { return { objectId: meta.id, objectType: 'user_meta', userId: userObj.userId, formSubmissionId: formSub.id } })
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
                success: true,
                code: DEFAULT_CODES.CALLBACK_INQUIRY_SUCCESS.code,
                message: DEFAULT_CODES.CALLBACK_INQUIRY_SUCCESS.message,
                data: {
                }
            })
            // if(user.id) {
            //     resolve({resBody})
            // }
        } catch (error) {
            console.log(error);
            resolve({
                success: false,
                data: {
                }
            })
        }
    })
}

const handleGeneralEnquiry = (resBody, req) => {
    return new Promise(async (resolve, reject) => {
        let {user, targetEntityType, targetEntityId,otherInfo,formData, formType, formTypeSource, actionType, lastStep, updateProfile } = resBody;
        lastStep = true // this is set true coz we have now only one step in form
        let { formSubmissionId } = resBody;
        otherInfo = {...otherInfo,...req.useragent, userIp:req.ip}
        insertInCRM = !!lastStep
        let userObj = {...user};
        if(!targetEntityType || !targetEntityId) {
           return resolve({success:false, code:DEFAULT_CODES.FAILED_ENQUIRY.code,message:DEFAULT_CODES.FAILED_ENQUIRY.message})
        }       
        try {
            if (formType == "enquiry" && typeof userObj.userId == 'undefined'){
                return resolve({success:false, code:DEFAULT_CODES.INVALID_TOKEN.code,message: DEFAULT_CODES.INVALID_TOKEN.message})
            }
            if (formType == "enquiry" && !updateProfile) {
                let validationResopnse = await validateEnquiryForm(formData);
                if(validationResopnse.error)
                {
                     return resolve({success:false, code:DEFAULT_CODES.VALIDATION_FAILED.code,message:validationResopnse.errormsg})
                }
            }
            else if( formType == "enquiry" && updateProfile) {
                if (!formSubmissionId)
                {
                    return resolve({success:false, code:DEFAULT_CODES.FAILED_ENQUIRY.code,message:DEFAULT_CODES.FAILED_ENQUIRY.message})
                }
                formSubRec = await  models.form_submission.findOne({where: {id: formSubmissionId}})
                formSubValRec = await models.form_submission_values.findAll({where: {formSubmissionId: formSubmissionId}})
                if(formSubValRec != null) {
                    let metaObj = {} 
                    formSubValRec.map((rec) => {
                        if(metaObj[rec.objectType]) {
                            metaObj[rec.objectType].push(rec.objectId)
                        } else {
                            metaObj[rec.objectType] = [];
                            metaObj[rec.objectType].push(rec.objectId)
                        }
                    })
                    let metaObjVal = await getObjectData(metaObj)
                    let temp = [];
                    for (key in metaObjVal) {
                        if (metaObjVal.hasOwnProperty(key)) temp.push(metaObjVal[key]);
                    }
                    temp = temp.filter( t => {return t.key !="email"})
                    
                    updateProfileMeta(temp, userObj)

                    return resolve({
                        success: true,
                        code: DEFAULT_CODES.ENQUIRY_PROFILE_SUCCESS.code,
                        message: DEFAULT_CODES.ENQUIRY_PROFILE_SUCCESS.message,
                        data: {
                            formSubmissionId
                        }
                    })
                }
            }
            //user meta {key:"", value:"", metaType:""}
            // prepare entries in for user_meta and make entries
            formData.map((f) => {
                f['userId'] = userObj.userId
                if (actionType == "signup" ) {
                    f['metaType'] = "primary"
                }
                return
            })

            const resMeta = await models.user_meta.bulkCreate(formData)
            if (formType != "signup") {                
                if (!formSubmissionId) {
                    // entries in form_submission
                    const form_submission = {
                        userId: userObj.userId,
                        formType,
                        formTypeSource,
                        targetEntityType,
                        targetEntityId,
                        otherInfo,
                        status:!!lastStep? 'submitted':'draft'
                    }

                    const formSub = await models.form_submission.create(form_submission)
                    formSubmissionId = formSub.id
                } else {
                    await models.form_submission.update({status:!!lastStep? 'submitted':'draft'},{
                        where: {
                            id:formSubmissionId
                        }
                    })
                }
                
                let form_submission_values = []
                form_submission_values = resMeta.map((meta) => { return { objectId: meta.id, objectType: 'user_meta', userId: userObj.userId, formSubmissionId: formSubmissionId } })
                //entries in form_submission_values
                const formSubValues = await models.form_submission_values.bulkCreate(form_submission_values)
                // if(updateProfile) {
                //     let temp = formData.filter( t => {return t.key !="email"})
                //     updateProfileMeta(temp, userObj)
                // }
                if(insertInCRM) {
                    eventEmitter.emit('enquiry_placed',formSubmissionId)
                }
                const activity_log =  await logActvity("COURSE_ENQUIRED",userObj.userId, targetEntityId);
                return resolve({
                    success: true,
                    code: DEFAULT_CODES.CALLBACK_INQUIRY_SUCCESS.code,
                    message: DEFAULT_CODES.CALLBACK_INQUIRY_SUCCESS.message,
                    data: {
                        formSubmissionId
                    }
                })
            } else {
                //calculate profile
                const progress = await calculateProfileCompletion(userObj)
                return resolve({
                    success: true,
                    message: "Data save succesfully",
                    data: {
                        profileProgress: progress
                    }
                })
            }

            // if(user.id) {
            //     resolve({resBody})
            // }
        } catch (error) {
            console.log(error);
            resolve({
                success: false,
                data: {
                }
            })
        }
    })
}

const handleUserProfileSubmission = (resBody, req) => {
    return new Promise(async (resolve, reject) => {
        const { user, formData } = resBody;
        let { formSubmissionId } = resBody;
        let userObj = { ...user };

        try {         
            const meta = await updateProfileMeta(formData, userObj)
            if(!meta.success && !meta){
                return resolve(meta)
            }
            const userinfo = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'email'}})
            formData.push({key:"email",value: userinfo.value})
            sendDataForStrapi(formData, "update-user-profile")
            const progress = await calculateProfileCompletion(userObj)
            return resolve({
                success: true,
                data: {
                    profileProgress: progress
                }
            })


            // if(user.id) {
            //     resolve({resBody})
            // }
        } catch (error) {
            console.log(error);
            resolve({
                success: false,
                data: {
                }
            })
        }
    })
}

const updateProfileMeta = (formData, userObj) => {
    return new Promise(async (resolve) => {
        try {
              //user meta {key:"", value:"", metaType:""}
            // prepare entries in for user_meta and make entries
            for(let key in formData ) {
                
                if(formData[key]['key'] == "education" || formData[key]['key'] == "workExp"){
                    let data = JSON.parse(formData[key]['value'])
                    if(data.length > 20){
                        return resolve(
                            { 
                                success: false, 
                                data:{
                                    code: "EXCEEDED_LENGTH",
                                    message: "Length should be less than 20"
                                }
                            }
                        )
                    }
                }

                formData[key]['userId'] = userObj.userId
                formData[key]['metaType'] = "primary"
                const where = {
                    metaType: 'primary',
                    userId: userObj.userId,
                    key: formData[key]['key'],
                }
                const foundItem = await models.user_meta.findOne({
                    where,
                    order: [
                        ['createdAt', 'DESC']
                    ],
                    limit: 1
                });
                if (!foundItem) {
                    // Item not found, create a new one
                    const item = await models.user_meta.create(formData[key])
                }else {
                    // Found an item, update it
                    const item = await models.user_meta.update(formData[key], { where });

                }
                const userinfo = await models.user_meta.findOne({where:{userId:userObj.userId, metaType:'primary', key:'email'}})
                formData.push({key:"email",value: userinfo.value})
                sendDataForStrapi(formData, "update-user-profile")
            }
            resolve(true)
        } catch (error) {
            resolve(true)
        }
    })
}

const fetchFormValues = (reqBody) => {
    return new Promise(async (resolve, reject) => {

        const { requestFieldMetaType="", requestFields = [], user } = reqBody;
        if(requestFields.length) {
            let where = {
                userId: user.userId,
                key: { [Op.in]: requestFields },
            }
            if (requestFieldMetaType) {
                where["metaType"] = requestFieldMetaType
            }
            let fieldsRes = await models.user_meta.findAll({
                where
            })
            const formValues = fieldsRes.map((t) => { return { [t.key]: t.value } }).reduce(function (acc, x) {
                for (var key in x) acc[key] = x[key];
                return acc;
            }, {});
            resolve({
                success: true,
                data: {
                    requestFieldValues: {
                        ...formValues
                    }

                }
            })
        } else {
            resolve({
                success: false,
                data: {

                }
            })
        }
    })
}


const getDefaultValues = async (key, searchString) => {
    let where = {
        optionType: key,
        key: { [Op.in]: requestFields },
    }
    let fieldsRes = await models.user_meta.findAll({
        where
    })
}

const validateEnquiryForm = async (formData) => {
    let formObj = formData.map((t) => { return { [t.key]: t.value } }).reduce(function (acc, x) {
            for (var key in x) acc[key] = x[key];
            return acc;
        }, {});
     let errormsg = {};
     let error = false;

    if(formObj.dob == "")
    {
        errormsg.dob = DEFAULT_CODES.ENQUIRY_VALIDATION_MESSAGES.DOB_REQUIRED
        error = true
    }
    if(!error && !moment(formObj.dob, "DD/MM/YYYY", true).isValid())
    {
        errormsg.dob = DEFAULT_CODES.ENQUIRY_VALIDATION_MESSAGES.DOB_FORMAT
        error = true
    }
    if(!error)
    {
        let age  = moment().diff(moment(formObj.dob,"DD/MM/YYYY"), 'years');
        if(age < 18)
        {
            errormsg.dob = DEFAULT_CODES.ENQUIRY_VALIDATION_MESSAGES.DOB_AGE
            error = true
        }
    }

    if(formObj.grade !="")
    {
        if(formObj.gradeType =='Grade')
        {
            const regex = /^[a-zA-Z+-]+$/g;
            let  res = regex.exec(formObj.grade)
            res =!!res
            if(!res)
            {
                errormsg.grade = DEFAULT_CODES.ENQUIRY_VALIDATION_MESSAGES.GRADE
                error = true
            }            
        }

        if(formObj.gradeType =='Percentage')
        {
            const regex = /^[0-9.%]+$/g;
            let  res = regex.exec(formObj.grade)
            res =!!res
            if(!res)
            {
                errormsg.grade = DEFAULT_CODES.ENQUIRY_VALIDATION_MESSAGES.GRADE
                error = true
            }
        }

        if(formObj.gradeType =='CGPA')
        {
            const regex = /^[0-9.]+$/g;
            let  res = regex.exec(formObj.grade)
            res =!!res
            if(!res || formObj.grade.length >3 || parseInt(formObj.grade) > 10 )
            {
                errormsg.grade = DEFAULT_CODES.ENQUIRY_VALIDATION_MESSAGES.GRADE
                error = true
            }            
        }
    }
    if(formObj.graduationYear !="")
    {
        if(!moment(formObj.graduationYear, "YYYY", true).isValid())
        {
            errormsg.graduationYear = DEFAULT_CODES.ENQUIRY_VALIDATION_MESSAGES.GRADUATION
            error = true
        }
    }        
    if(formObj.degree =="")
    {
        errormsg.degree = DEFAULT_CODES.ENQUIRY_VALIDATION_MESSAGES.DEGREE
        error = true
    }
    if(formObj.specialization =="")
    {
        errormsg.specialization = DEFAULT_CODES.ENQUIRY_VALIDATION_MESSAGES.SPECIALIZATION
        error = true
    }
    if(formObj.instituteName =="")
    {
        errormsg.instituteName = DEFAULT_CODES.ENQUIRY_VALIDATION_MESSAGES.INSTITUTE
        error = true
    }
    if(formObj.hasExperience)
    {
        if(formObj.jobTitle =="")
        {
            errormsg.jobTitle = DEFAULT_CODES.ENQUIRY_VALIDATION_MESSAGES.JOBTITLE
            error = true
        }
        
        if(formObj.company =="")
        {
            errormsg.company = DEFAULT_CODES.ENQUIRY_VALIDATION_MESSAGES.COMPANY
            error = true  
        }
        
        if(formObj.industry =="")
        {
            errormsg.industry = DEFAULT_CODES.ENQUIRY_VALIDATION_MESSAGES.INDUSTRY
            error = true     
        }
        const regex = /^[0-9]+$/g;
        let  res = regex.exec(formObj.experience)
        res =!!res
        if(formObj.experience =="")
        {
            errormsg.experience = DEFAULT_CODES.ENQUIRY_VALIDATION_MESSAGES.EXP_REQUIRED
            error = true         
        }
        else if(!res)
        {
            errormsg.experience = DEFAULT_CODES.ENQUIRY_VALIDATION_MESSAGES.EXP_NUMERIC
            error = true
        }
    }

    let finalData = {error,errormsg}
    
    return finalData;
        
}

const getObjectData = (metaObj) => {
    let data = {}
    return new Promise(async (resolve) => {

        for(let objectType in metaObj) {
            switch (objectType) {
                case 'user_meta':
                    const userMeta = await fetchUserMeta(metaObj[objectType])
                    data = {...data,...userMeta}
                break;
            
                default:
                    break;
            }
        }
        return resolve(data)
    }) 
}

const fetchUserMeta = (ids) => {
    return new Promise(async (resolve, reject) => {


        let where = {
            id: { [Op.in]: ids },
        }
        let fieldsRes = await models.user_meta.findAll({
            where
        })
        const formValues = fieldsRes.map((t) => { return { key:t.key, value:t.value } })
        resolve(formValues)
    })
}

module.exports = {
    handleEnquirySubmission,
    fetchFormValues,
    handleUserProfileSubmission
}