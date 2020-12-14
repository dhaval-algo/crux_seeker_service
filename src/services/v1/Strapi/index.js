const axios = require("axios");
const { truncate } = require("fs");
const moment = require("moment");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const elasticService = require("../../../api/services/elasticService");

const models = require("../../../../models");
const eventEmitter2 = require('../../../utils/subscriber');

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
                    "instituteName",
                    "degree",
                    "graduationYear",
                    "specialization",
                    "grade",
                    "jobTitle",
                    "industry",
                    "company",
                    "currentCompany",
                    "experience",
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
            company_name: '',
            industry: '',
            experience: '',
            degree: '',
            grade: '',
            institute: '',
            specialization: '',
            year_of_graduation: '',
            location: '',
            current_company: false,
            date_of_birth: '',
        }
    
        strapiObj.phone = `+${metaObjVal.phone}` || "";
        strapiObj.first_name = metaObjVal.firstName || "";
        strapiObj.last_name = metaObjVal.lastName || "Not given";
        strapiObj.gender = metaObjVal.gender || "";
        strapiObj.grade = metaObjVal.grade || "";
        strapiObj.email = metaObjVal.email || "";
        strapiObj.date_of_birth = metaObjVal.dob || "";
        strapiObj.year_of_graduation = metaObjVal.graduationYear || "";
    
        if (metaObjVal.specialization) {
            strapiObj.specialization = JSON.parse(metaObjVal.specialization).label
        }
    
        if (metaObjVal.degree) {
            strapiObj.degree = JSON.parse(metaObjVal.degree).label
        }
    
        if (metaObjVal.instituteName) {
            strapiObj.institute = JSON.parse(metaObjVal.instituteName).label
        }
    
        if (metaObjVal.experience) {
            strapiObj.experience = JSON.parse(metaObjVal.experience).label
        }
    
        if (metaObjVal.jobTitle) {
            strapiObj.job_title = JSON.parse(metaObjVal.jobTitle).label
        }
    
        if (metaObjVal.industry) {
            strapiObj.industry = JSON.parse(metaObjVal.industry).label
        }
    
        if (metaObjVal.company) {
            strapiObj.company = JSON.parse(metaObjVal.company).label
        }
    
        if (metaObjVal.currentCompany) {
            strapiObj.current_company = Boolean(metaObjVal.currentCompany)
        }
    
        if (metaObjVal.city) {
            strapiObj.location = JSON.parse(metaObjVal.city).city
            // strapiObj.location = JSON.parse(metaObjVal.city).country
        }
        strapiObj = cleanObject(strapiObj)
        resolve(strapiObj)
      
    })
}

const prepareStrapiData = (enquiry_id) => {
    return new Promise(async (resolve) => {
        let strapiObj = {
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
            partner_id:null
        }
        try {

           formSubRec = await  models.form_submission.findOne({where: {id: enquiry_id}})
            if(formSubRec.otherInfo) {
                // const otherObj = JSON.parse(formSubRec.otherInfo)
                strapiObj.source_url = formSubRec.otherInfo.sourceUrl
                strapiObj.userId = formSubRec.userId
            }
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
                    console.log(rec.objectType);
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
                strapiObj.grade = metaObjVal.grade || "";
                strapiObj.email = metaObjVal.email || "";
                strapiObj.date_of_birth = metaObjVal.dob || "";
                strapiObj.year_of_graduation = metaObjVal.graduationYear || "";

                if(metaObjVal.specialization) {
                    strapiObj.specialization = JSON.parse(metaObjVal.specialization).label
                }

                if(metaObjVal.degree) {
                    strapiObj.degree = JSON.parse(metaObjVal.degree).label
                }

                if(metaObjVal.instituteName) {
                    strapiObj.institute = JSON.parse(metaObjVal.instituteName).label
                }

                if(metaObjVal.experience) {
                    strapiObj.experience = JSON.parse(metaObjVal.experience).label
                }

                if(metaObjVal.jobTitle) {
                    strapiObj.job_title = JSON.parse(metaObjVal.jobTitle).label
                }

                if(metaObjVal.industry) {
                    strapiObj.industry = JSON.parse(metaObjVal.industry).label
                }

                if(metaObjVal.company) {
                    strapiObj.company_name = JSON.parse(metaObjVal.company).label
                }

                if(metaObjVal.currentCompany) {
                    strapiObj.current_company = Boolean(metaObjVal.currentCompany)
                }
                
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
                const result = await elasticService.plainSearch('learn-content', queryBody);
                if(result.hits){
                    console.log(result.hits.hits.length,'-------------------------------');
                    if(result.hits.hits && result.hits.hits.length > 0){
                        for(const hit of result.hits.hits){
                            strapiObj.course_name = hit._source.title
                            strapiObj.course_category = hit._source.categories? hit._source.categories.toString():""
                            strapiObj.categories_list = hit._source.categories_list? hit._source.categories_list:null
                            strapiObj.partner_id = hit._source.partner_id? hit._source.partner_id:""
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

    axios.post(request_url, data).then((response) => {
        console.log(response.data);
        return
    }).catch(e => {
        console.log(e.response.data, "error in srapo", JSON.stringify(data));
        return
    })
}

module.exports = {
    createRecordInStrapi
}