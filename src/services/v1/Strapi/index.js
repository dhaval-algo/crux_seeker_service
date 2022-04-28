const axios = require("axios");
const { truncate } = require("fs");
const moment = require("moment");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const elasticService = require("../../../api/services/elasticService");
const {sendDataForStrapi} =  require('../../../utils/helper')
const models = require("../../../../models");
const eventEmitter2 = require('../../../utils/subscriber');
const communication = require('../../../communication/v1/communication');

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
   
const cleanObject = (obj) => {
    for (var propName in obj) { 
      if (obj[propName] === null || obj[propName] === undefined || obj[propName] == "") {
        delete obj[propName];
      }
    }
    return obj
}

const fetchUserMeta = (ids) => {
    return new Promise(async (resolve, reject) => {


        let where = {
            id: { [Op.in]: ids },
        }
        let fieldsRes = await models.user_meta.findAll({
            where
        })
        const formValues = fieldsRes.map((t) => { return { [t.key]: t.value } }).reduce(function (acc, x) {
            for (var key in x) acc[key] = x[key];
            return acc;
        }, {});
        resolve(formValues)
    })
}

const createLoggedUserMeta = async (userId) => {
    return new Promise( async (resolve) => {

        let request_url = `${process.env.API_BACKEND_URL}/enquiry-users`
        const where = {
            userId: userId,
            metaType: 'primary',
            key: {
                [Op.in]: [
                    "phone",
                    "firstName",
                    "lastName",
                    "email",
                    "zipcode",
                    "dob",
                    "country",
                    "city",
                    "gender",
                    "education",
                    "workExp"
                ]
            },
        }
    
        let fieldsRes = await models.user_meta.findAll({
            where
        })
        const metaObjVal = fieldsRes.map((t) => { return { [t.key]: t.value } }).reduce(function (acc, x) {
            for (var key in x) acc[key] = x[key];
            return acc;
        }, {});
    
        let strapiObj = {
            first_name: "",
            last_name: "",
            email: "",
            gender: "",
            phone: "",
            job_title: '',
            company: '',
            company_name: '',
            industry: '',
            experience: '',
            degree: '',
            grade: '',
            grade_type: '',
            institute: '',
            specialization: '',
            year_of_graduation: '',
            location: '',
            current_company: false,
            date_of_birth: '',
        }
    
        strapiObj.phone =   metaObjVal.phone? `+${metaObjVal.phone}`: "";
        strapiObj.first_name = metaObjVal.firstName || "";
        strapiObj.last_name = metaObjVal.lastName || "Not given";
        strapiObj.gender = metaObjVal.gender || "";
        strapiObj.email = metaObjVal.email || "";
        strapiObj.date_of_birth = metaObjVal.dob || "";        
        if (metaObjVal.city) {
            strapiObj.location = JSON.parse(metaObjVal.city).city
        }

        let educationArr = (metaObjVal.education)? JSON.parse(metaObjVal.education) :null
        let workExpArr = (metaObjVal.workExp) ? JSON.parse(metaObjVal.workExp):null
        let education = (educationArr && educationArr.length > 0)? educationArr[0] : null
        let workExp = (workExpArr && workExpArr.length > 0)? workExpArr[0] : null
        strapiObj.grade = (education && education.grade)? education.grade.replace(/"/g,"").replace(/\\/g, '') :  "";     /*Remove unwanted slash and double quotes*/
        strapiObj.grade_type = (education && education.gradeType)? education.gradeType.replace(/"/g,"").replace(/\\/g, '') :  ""; /*Remove unwanted slash and double quotes*/

        if(education && education.specialization) {
            strapiObj.specialization = education.specialization.label
        }

        if(education && education.degree) {
            strapiObj.degree = education.degree.label
        }

        if(education && education.instituteName) {
            strapiObj.institute = education.instituteName.label
        }  
        
        if(education && education.graduationYear) {
            strapiObj.year_of_graduation = education.graduationYear
        }

        if(workExp && workExp.jobTitle) {
            strapiObj.job_title = workExp.jobTitle.label
        }

        if(workExp && workExp.industry) {
            strapiObj.industry = workExp.industry.label
        }

        if(workExp && workExp.company) {
            strapiObj.company = workExp.company.label
            strapiObj.company_name = workExp.company.label
        }

        if(workExp && workExp.currentCompany) {
            strapiObj.current_company = Boolean(workExp.currentCompany)
        }  

        if(workExp && workExp.experience) {
            strapiObj.experience =  workExp.experience
        }

        strapiObj = cleanObject(strapiObj)
        resolve(strapiObj)
      
    })
}

const prepareStrapiData = (enquiry_id) => {
    return new Promise(async (resolve) => {
        let strapiObj = {
            // enquiry_id:"",
            first_name:"",
            last_name:"",
            email:"",
            gender:"",
            phone:"",
            enquiry_submitted_on:moment().format(),
            job_title:'',
            company_name:'',
            industry:'',
            experience:'',
            degree:'',
            grade:'',
            grade_type:'',
            institute:'',
            specialization:'',
            year_of_graduation:'',
            location:'',
            current_company:false,
            source_url:'',
            course_name:"",
            course_category:"",
            date_of_birth:'',
            userId:'',
            enquiry_type:"",
            enquiry_on:"",
            entity_id:"",
            learn_content:null,
            categories_list:null,
            partner_id:null,
            user_id:null,
            image:null,
            send_communication_emails:null,
            correspondence_email:null,
            provider:null,
            partner_status:null

        }
        try {
            // strapiObj.enquiry_id = 'LRN_CNT_ENQ_' + enquiry_id
            formSubRec = await  models.form_submission.findOne({where: {id: enquiry_id}})
            if(formSubRec.otherInfo) {
                // const otherObj = JSON.parse(formSubRec.otherInfo)
                strapiObj.source_url = formSubRec.otherInfo.sourceUrl
            }
            strapiObj.userId = strapiObj.user_id = formSubRec.userId;
            strapiObj.enquiry_type = formSubRec.formTypeSource;
            strapiObj.entity_id = formSubRec.targetEntityId.replace(/[^0-9]+/, '');
            if(formSubRec.targetEntityType == "course") {
                strapiObj.learn_content = formSubRec.targetEntityId.replace(/[^0-9]+/, '');
                strapiObj.enquiry_on = "learn_content";
            } else if(formSubRec.targetEntityType == "provider") {
                strapiObj.enquiry_on = "provider";
            }
            formSubValRec = await models.form_submission_values.findAll({where: {formSubmissionId: enquiry_id}})
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
                strapiObj.phone = (metaObjVal.phone)? `+${metaObjVal.phone}` : "";
                strapiObj.first_name = metaObjVal.firstName || "";
                strapiObj.last_name = metaObjVal.lastName || "";
                strapiObj.gender = metaObjVal.gender || ""; 
                strapiObj.email = metaObjVal.email || "";
                strapiObj.date_of_birth = metaObjVal.dob || "";                
                if(metaObjVal.city) {
                    strapiObj.location = JSON.parse(metaObjVal.city).city
                }

                let educationArr = JSON.parse(metaObjVal.education)
                let workExpArr = JSON.parse(metaObjVal.workExp)
                let education = educationArr[0]
                let workExp = (workExpArr && workExpArr.length > 0)? workExpArr[0] : null
                strapiObj.grade = (education.grade)? education.grade.replace(/"/g,"").replace(/\\/g, '') :  "";     /*Remove unwanted slash and double quotes*/
                strapiObj.grade_type = (education.gradeType)? education.gradeType.replace(/"/g,"").replace(/\\/g, '') :  ""; /*Remove unwanted slash and double quotes*/

                if(education.specialization) {
                    strapiObj.specialization = education.specialization.label
                }

                if(education.degree) {
                    strapiObj.degree = education.degree.label
                }

                if(education.instituteName) {
                    strapiObj.institute = education.instituteName.label
                }               

                if(workExp.jobTitle) {
                    strapiObj.job_title = workExp.jobTitle.label
                }

                if(workExp.industry) {
                    strapiObj.industry = workExp.industry.label
                }

                if(workExp.company) {
                    strapiObj.company_name = workExp.company.label
                }

                if(workExp.currentCompany) {
                    strapiObj.current_company = Boolean(workExp.currentCompany)
                }  

                strapiObj.year_of_graduation = education.graduationYear || "";
                strapiObj.experience = workExp.experience || "";
                
                let queryBody = {
                    "query": {
                      "ids": {
                          "values": [formSubRec.targetEntityId]
                      },
                    }
                };

                const result = await elasticService.plainSearch('learn-content', queryBody);
                if(result.hits){
                    if(result.hits.hits && result.hits.hits.length > 0){
                        for(const hit of result.hits.hits){
                            strapiObj.course_name = hit._source.title
                            strapiObj.course_category = hit._source.categories? hit._source.categories.toString():""
                            strapiObj.categories_list = hit._source.categories_list? hit._source.categories_list:null
                            strapiObj.partner_id = hit._source.partner_id? hit._source.partner_id:""
                            strapiObj.image = hit._source.images? hit._source.images.small:""
                            strapiObj.provider = hit._source.provider_name? hit._source.provider_name :""
                        }
                    }
                }

                let partnerQueryBody = {
                    "query": {
                      "ids": {
                          "values": [ `PTNR_${strapiObj.partner_id}`]
                      },
                    }
                };
                const partner = await elasticService.plainSearch('partner', partnerQueryBody);
                if(partner.hits){
                    if(partner.hits.hits && partner.hits.hits.length > 0){
                        for(const hit of partner.hits.hits){                            
                            strapiObj.send_communication_emails = hit._source.send_communication_emails? hit._source.send_communication_emails:false
                            strapiObj.correspondence_email = hit._source.correspondence_email? hit._source.correspondence_email:""
                            strapiObj.partner_status = hit._source.status? hit._source.status:"Active"
                        }
                    }
                }               

            }
            strapiObj = cleanObject(strapiObj)
            return resolve(strapiObj)
        } catch (error) {
            console.log(error);
        }
    })
}

const prepareStrapiDataforLearnPath = (enquiry_id) => {
    return new Promise(async (resolve) => {
        let strapiObj = {
            // enquiry_id:"",
            first_name:"",
            last_name:"",
            email:"",
            gender:"",
            phone:"",
            enquiry_submitted_on:moment().format(),
            job_title:'',
            company_name:'',
            industry:'',
            experience:'',
            degree:'',
            grade:'',
            grade_type:'',
            institute:'',
            specialization:'',
            year_of_graduation:'',
            location:'',
            current_company:false,
            learn_path_url:'',
            learn_path_name:"",
            learn_path_category:"",
            date_of_birth:'',
            enquiry_type:"",
            enquiry_on:"",
            learn_path_id:"",
            learning_path:null,
            categories_list:null,
            user_id:null,
            userId:null
        }
        try {
            // strapiObj.enquiry_id = 'LRN_PTH_ENQ_'+enquiry_id
            formSubRec = await  models.form_submission.findOne({where: {id: enquiry_id}})
            if(formSubRec.otherInfo) {
                // const otherObj = JSON.parse(formSubRec.otherInfo)
                strapiObj.learn_path_url = formSubRec.otherInfo.learnpathUrl
            }
            strapiObj.userId = strapiObj.user_id = formSubRec.userId;
            strapiObj.enquiry_type = formSubRec.formTypeSource;
            strapiObj.learn_path_id = formSubRec.targetEntityId.replace(/[^0-9]+/, '');
            if(formSubRec.targetEntityType == "learnpath") {
                strapiObj.learning_path = formSubRec.targetEntityId.replace(/[^0-9]+/, '');
                strapiObj.enquiry_on = "learn_path";
            }
            formSubValRec = await models.form_submission_values.findAll({where: {formSubmissionId: enquiry_id}})
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
                strapiObj.phone = `+${metaObjVal.phone}` || "";
                strapiObj.first_name = metaObjVal.firstName || "";
                strapiObj.last_name = metaObjVal.lastName || "";
                strapiObj.gender = metaObjVal.gender || "";
                strapiObj.email = metaObjVal.email || "";
                strapiObj.date_of_birth = metaObjVal.dob || "";

                let educationArr = JSON.parse(metaObjVal.education)
                let workExpArr = JSON.parse(metaObjVal.workExp)
                let education = educationArr[0]
                let workExp = (workExpArr && workExpArr.length > 0)? workExpArr[0] : null
                strapiObj.grade = (education.grade)? education.grade.replace(/"/g,"").replace(/\\/g, '') :  "";     /*Remove unwanted slash and double quotes*/
                strapiObj.grade_type = (education.gradeType)? education.gradeType.replace(/"/g,"").replace(/\\/g, '') :  ""; /*Remove unwanted slash and double quotes*/

                if(education.specialization) {
                    strapiObj.specialization = education.specialization.label
                }

                if(education.degree) {
                    strapiObj.degree = education.degree.label
                }

                if(education.instituteName) {
                    strapiObj.institute = education.instituteName.label
                }               

                if(workExp.jobTitle) {
                    strapiObj.job_title = workExp.jobTitle.label
                }

                if(workExp.industry) {
                    strapiObj.industry = workExp.industry.label
                }

                if(workExp.company) {
                    strapiObj.company_name = workExp.company.label
                }

                if(workExp.currentCompany) {
                    strapiObj.current_company = Boolean(workExp.currentCompany)
                }  

                strapiObj.year_of_graduation = education.graduationYear || "";
                strapiObj.experience = workExp.experience || "";
                
                if(metaObjVal.city) {
                    strapiObj.location = JSON.parse(metaObjVal.city).city
                }

                
                let queryBody = {
                    "query": {
                      "ids": {
                          "values": [formSubRec.targetEntityId]
                      },
                    }
                };

                const result = await elasticService.plainSearch('learn-path', queryBody);
                if(result.hits){
                    if(result.hits.hits && result.hits.hits.length > 0){
                        for(const hit of result.hits.hits){
                            strapiObj.learn_path_name = hit._source.title
                            strapiObj.learn_path_category = hit._source.categories? hit._source.categories.toString():""
                            strapiObj.categories_list = hit._source.categories_list? hit._source.categories_list:null
                        }
                    }
                }

            }
            strapiObj = cleanObject(strapiObj)
            return resolve(strapiObj)
        } catch (error) {
            console.log(error);
        }
    })
}

const createRecordInStrapi = async (enquiryId) => {
    let request_url = `${process.env.API_BACKEND_URL}/enquiries`
    const data = await prepareStrapiData(enquiryId)
    let userRes ={}
    if(data.userId){
        userRes = await createLoggedUserMeta(data.userId)
        delete data.userId;
        data.enquiry_owner = userRes
    }

    sendDataForStrapi(data, "update-profile-enquiries");
    /*Send email for partner*/
    if(data.send_communication_emails && data.partner_status =="Active")
    {
        let emailPayload = {
            fromemail: process.env.FROM_EMAIL_ENQUIRY_EMAIL,
            toemail: data.correspondence_email,
            email_type: "enquiry_email_to_partner",
            email_data: {
                courseImgUrl:  data.image,
                course_name: data.course_name,
                provider:data.provider,
                full_name: data.first_name + ' ' + data.last_name,
                email: data.email,
                phone:data.phone,
                city:data.location
            }
        }
        
        communication.sendEmail(emailPayload, false)
    }

    /* Create recorde in strapi enquiry collection*/
    axios.post(request_url, data).then((response) => {        
       // console.log(response.data);
        return
    }).catch(e => {
        console.log(e);
        return
    })
}

const createRecordInStrapiforLearnPath = async (enquiryId) => {
    let request_url = `${process.env.API_BACKEND_URL}/learn-path-enquiries`
    const data = await prepareStrapiDataforLearnPath(enquiryId)
    let userRes ={}
    if(data.userId){
        userRes = await createLoggedUserMeta(data.userId)
        delete data.userId;
        data.enquiry_owner = userRes
    }

    sendDataForStrapi(data, "update-learnpath-profile-enquiries");
    axios.post(request_url, data).then((response) => {        
        console.log(response.data);
        return
    }).catch(e => {
        console.log(e);
        return
    })
}

module.exports = {
    createRecordInStrapi,
    createRecordInStrapiforLearnPath
}