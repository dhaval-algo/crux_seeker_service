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

const cleanObject = (obj) => {
    for (var propName in obj) { 
      if (obj[propName] === null || obj[propName] === undefined || obj[propName] === "") {
        delete obj[propName];
      }
    }
    return obj
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
            partner_status:null,
            course_id:'',
            full_name:'',
            highest_degree:'',
            student: null,
            enquiry_message:"",
            enquiry_id:"LRN_CNT_ENQ_"


        }
        try {
            let enquiry = await  models.enquiry.findOne({where: {id: enquiry_id}})
            
            strapiObj.enquiry_id += enquiry.dataValues.id;
            strapiObj.course_name = enquiry.dataValues.courseName;
            strapiObj.course_id = enquiry.dataValues.courseId;
            strapiObj.partner_id = enquiry.dataValues.partnerId
            strapiObj.phone = enquiry.dataValues.phone || "";

            strapiObj.full_name = enquiry.dataValues.fullName || ""
            strapiObj.first_name = enquiry.dataValues.fullName.split(" ")[0] || ""
            strapiObj.last_name = enquiry.dataValues.fullName.split(strapiObj.first_name)[1] || "-"
            strapiObj.email = enquiry.dataValues.email || "";
            strapiObj.student = Boolean(enquiry.dataValues.student);
            strapiObj.enquiry_message = enquiry.dataValues.enquiryMessage || "";
            strapiObj.experience = enquiry.dataValues.experience || "";
            strapiObj.highest_degree = enquiry.dataValues.highestDegree || "";
            strapiObj.enquiry_on = "learn_content";
            strapiObj.enquiry_submitted_on = enquiry.dataValues.createdAt;
            strapiObj.fromSeekerService = true
            
            const query = { "bool": {
                "must": [{ term: { "_id": enquiry.courseId }}]
            }};
            
            const learnContent = await elasticService.search('learn-content', query)

            if( learnContent.hits && learnContent.hits.length > 0 ){
                strapiObj.source_url =  process.env.FRONTEND_URL+ "course/" + learnContent.hits[0]._source.slug
                if(learnContent.hits[0]._source.categories)
                    strapiObj.course_category = learnContent.hits[0]._source.categories.join()
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
            userId:null,
            full_name:'',
            highest_degree:'',
            student: null,
            enquiry_message:"",
            enquiry_id:"LRN_PTH_ENQ_",
        }
        try {
            let enquiry = await  models.learnpath_enquiry.findOne({where: {id: enquiry_id}})
            
            strapiObj.enquiry_id += enquiry.dataValues.id;
            strapiObj.learn_path_name = enquiry.dataValues.learnpathName;
            strapiObj.learn_path_id = enquiry.dataValues.learnpathId;
            strapiObj.phone = enquiry.dataValues.phone || "";

            strapiObj.full_name = enquiry.dataValues.fullName || ""
            strapiObj.first_name = enquiry.dataValues.fullName.split(" ")[0] || ""
            strapiObj.last_name = enquiry.dataValues.fullName.split(strapiObj.first_name)[1] || "-"
            strapiObj.email = enquiry.dataValues.email || "";
            strapiObj.student = Boolean(enquiry.dataValues.student);
            strapiObj.enquiry_message = enquiry.dataValues.enquiryMessage || "";
            strapiObj.experience = enquiry.dataValues.experience || "";
            strapiObj.highest_degree = enquiry.dataValues.highestDegree || "";
            strapiObj.enquiry_on = "learn_path";
            strapiObj.enquiry_submitted_on = enquiry.dataValues.createdAt;
            strapiObj.fromSeekerService = true

            const query = { "bool": {
                "must": [{ term: { "_id": enquiry.learnpathId }}]
            }};
            const learnPath = await elasticService.search('learn-path', query)
                
            if( learnPath.hits && learnPath.hits.length > 0 ){
                if(learnPath.hits[0]._source.categories)
                    strapiObj.learn_path_category = learnPath.hits[0]._source.categories.join()
                strapiObj.learn_path_url =  process.env.FRONTEND_URL+ "learnpath/" + learnPath.hits[0]._source.slug
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

    //sendDataForStrapi(data, "update-profile-enquiries");

    /* Create recorde in strapi enquiry collection*/
    axios.post(request_url, data).then((response) => {        
        return
    }).catch(e => {
        console.log(e);
        return
    })
}

const createRecordInStrapiforLearnPath = async (enquiryId) => {
    let request_url = `${process.env.API_BACKEND_URL}/learn-path-enquiries`
    const data = await prepareStrapiDataforLearnPath(enquiryId)

    axios.post(request_url, data).then((response) => {        
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