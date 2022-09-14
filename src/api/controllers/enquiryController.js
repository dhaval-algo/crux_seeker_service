'use strict';

const models = require("../../../models")
const elasticService = require("../../api/services/elasticService");
const enquiryService = require("../../api/services/enquiryService");
const eventEmitter = require("../../utils/subscriber");
const validators = require("../../utils/validators")
const helperService = require("../../utils/helper");
const { sequelize } = require("../../../models");



const fetchEnquiry = async(req, res) => {

    try{

        const { userId } = req.user
        const { page, limit } = validators.validatePaginationParams({ page: req.query.page, limit: req.query.limit })
        const offset =  (page-1) * limit
        let options = { attributes: ['courseId'], where : {userId}, raw:true}

        //get all enquiries ids of this user, to obtain courseId eventually
        const enquiries = await models.enquiry.findAll(options)

        let courseIds = [];
        enquiries.forEach((enquiry, i) => {
            courseIds.push(enquiry.courseId.replace(/[^0-9]+/, ''))
        })

        let query = {
            "bool": {
              "must": [           
                {
                  "terms": {
                    "id": courseIds
                  }
                },
                {"term": { "status.keyword": 'published' }}
              ]
            }  
          }
        const totalResult = await elasticService.search('learn-content', query, {size: 1000}, ["_id"]);
        let existingIds = [];

        if(totalResult.hits){
            if(totalResult.hits && totalResult.hits.length > 0){
                 for(const hit of totalResult.hits){                
                    existingIds.push(hit._id)                
                }           
            }
            else
            {
                return res.status(200).send({
                    success:true,
                    data:{
                        enquiries:[],
                        count:0
                    }
                })
            }
        }

        courseIds = courseIds.map(id =>`LRN_CNT_PUB_${id}`)
        courseIds = courseIds.filter((id => existingIds.includes(id)))
        let totalCount = courseIds.length

            //fetch enquiries, details
        let enqConfig = { 
                attributes: ['courseId','createdAt'],
                where: { userId, courseId : courseIds},
                limit, raw: true, order: sequelize.literal('"createdAt" DESC')
        }
        
        if(page > 1) {
            enqConfig.offset = offset
        }
        let enquiryRecs = await models.enquiry.findAll(enqConfig)
          
            // no enquiries return
        if(!enquiryRecs.length) {
            return res.status(200).send({
                success:true,
                data:{
                    enquiries:[],
                    count:0
                }
            })
        }
        let enquiriesDone = []

        for (let key = 0; key < enquiryRecs.length ; key++) {
            let enquiry = {
                sourceUrl: "",
                courseName:'',
                categoryName:'',
                createdAt:enquiryRecs[key].createdAt,
                instituteName:"" ,
                images:{},
                partnerName:""
            }
            let queryBody = {
                "_source":["title","categories","provider_name","images","partner_name", "slug"],
                "query": {
                  "terms": {
                      "id": [enquiryRecs[key].courseId.replace(/[^0-9]+/, '')]
                  },
                }
            };
            
            const result = await elasticService.plainSearch('learn-content', queryBody);
            if(result.hits){
                if(result.hits.hits && result.hits.hits.length > 0){
                        let hit =  result.hits.hits[0]
                        enquiry.courseName = hit._source.title
                        enquiry.sourceUrl = process.env.FRONTEND_URL + "course/"+ hit._source.slug
                        enquiry.categoryName = hit._source.categories? hit._source.categories.toString():""
                        enquiry.instituteName = hit._source.provider_name
                        enquiry.images = hit._source.images
                        enquiry.partnerName = hit._source.partner_name                        
                }
            }
            enquiriesDone.push(enquiry);
        }

        //fetch course fron esatic
        enquiriesDone = enquiriesDone.filter(enquiry => enquiry.courseName ||  enquiry.instituteName);
        return res.status(200).send({
            success:true,
            data:{
                enquiries:enquiriesDone,
                count:totalCount
            }
        })
    }
    catch(err){
        return res.status(500).send({error:true, message: err.message})
    }
}

const createEnquiry = async (req, res) => {
    const { user = null } = req.user
    let { courseId = "" } = req.body
    courseId = courseId.trim()

    if(courseId == "")
        return res.status(500).send({error:true, message:"course id cannot be empty"})

    try {

        let query = { "bool": {
            "must": [{ term: { "_id": courseId }}]
        }};
        let provider, courseImgUrl, partnerId;

        //fetch partnerId  frm learn-content index
        const learncontent = await elasticService.search('learn-content', query);
        if( learncontent.hits && learncontent.hits.length > 0 ){
            partnerId = learncontent.hits[0]._source.partner_id
            provider = learncontent.hits[0]._source.provider_name
            courseImgUrl = learncontent.hits[0]._source.images.thumbnail
        }
        else{
            return res.status(500).send({error:true, message:
                " couldnt able to find course, invalid courseId"})
        }

        enquiryService.buildEnquiry(req).then( async (enquiry) => {
            enquiry.partnerId = partnerId
            const enq = await models.enquiry.create(enquiry)
                        
                // emit event to createLead in zoho
            if(enq.id != undefined)
                eventEmitter.emit('enquiry_placed',enq.id)

            query = { "bool": {
                "must": [{ term: { "_id": "PTNR_" + enquiry.partnerId }}]
            }};
            
            //fetch partner's email  frm partner index 
            const partner = await elasticService.search('partner', query);
            if( partner.hits && partner.hits.length > 0 ){
                let {  correspondence_email, correspondence_email1, correspondence_email2,
                    correspondence_email3, correspondence_email4, send_enquiry_updates, status } = partner.hits[0]._source
        
        
            if(send_enquiry_updates && status == "Active")
            {
                let data = {
                    courseImgUrl: courseImgUrl,
                    course_name: enquiry.courseName,
                    provider: provider,
                    full_name: enquiry.fullName,
                    email: enquiry.email,
                    phone: enquiry.phone,
                    student: enquiry.student,
                    highestDegree: enquiry.highestDegree,
                    experience: enquiry.experience,
                    enquiryMessage: enquiry.enquiryMessage,
                }
                if(correspondence_email !=  null)
                    await enquiryService.sendEnquiryEmail(correspondence_email, data)
                if(correspondence_email1 !=  null)
                    await enquiryService.sendEnquiryEmail(correspondence_email1, data)
                if(correspondence_email2 !=  null)
                    await enquiryService.sendEnquiryEmail(correspondence_email2, data)
                if(correspondence_email3 !=  null)
                    await enquiryService.sendEnquiryEmail(correspondence_email3, data)
                if(correspondence_email4 !=  null)
                    await enquiryService.sendEnquiryEmail(correspondence_email4, data)

            }}
            const activity_log =  await helperService.logActvity("COURSE_ENQUIRED",(user)? user.userId : null, courseId);
            res.status(200).send({success:true,  message: "enquiry submitted"})
        })
        .catch(err => {
            return res.status(500).send({error:true, message: err.message}) 
        })

     
    }
    catch(err){
        return res.status(500).send({error:true, message: err.message})    }

}

const createLearnpathEnquiry = async (req, res) => {

    try {
        const { user = null } = req.user
        let { learnpathId = "" } = req.body
        learnpathId = learnpathId.trim()
    
        if(learnpathId == "")
            return res.status(500).send({error:true, message:"learnpath id cannot be empty"})

        let query = { "bool": {
            "must": [{ term: { "_id": learnpathId }}]
        }};

        //fetch partnerId  frm learn-content index
        const learncontent = await elasticService.search('learn-path', query);
        if( learncontent.hits.length == 0 )        
            return res.status(500).send({error:true, message:
                " couldnt able to find learnpath, invalid learnpath id"})

        enquiryService.buildLearnpathEnquiry(req).then( async (enquiry) => {
            const enq = await models.learnpath_enquiry.create(enquiry)
            // emit event to createLead in zoho
            if(enq.id != undefined )
                eventEmitter.emit('learnpathenquiry',enq.id)
            const activity_log =  await helperService.logActvity("LEARNPATH_ENQUIRED",(user)? user.userId : null, learnpathId);
            return res.status(200).send({success:true, message:"learnpath enquiry submitted"})
        })
        .catch(err => {
            return res.status(500).send({error:true, message: err.message}) 
        })

    }
    catch(err){
        return res.status(500).send({error:true, message: err.message})
    }

}

const fetchLearnpathEnquiry = async(req, res) => {
    try{

        const { userId } = req.user
        const { page, limit } = validators.validatePaginationParams({ page: req.query.page, limit: req.query.limit })
        const offset =  (page-1) * limit
        let options = { attributes: ['learnpathId'], where : {userId}, raw:true}

        //get all learnpath enquiries ids of this user, to obtain learnpathId eventually
        const enquiries = await models.learnpath_enquiry.findAll(options)

        let learnpathIds = [];
        enquiries.forEach((enquiry, i) => {
            learnpathIds.push(enquiry.learnpathId.replace(/[^0-9]+/, ''))
        })

        let query = {
            "bool": {
              "must": [           
                {
                  "terms": {
                    "id": learnpathIds
                  }
                },
                {"term": { "status.keyword": 'approved' }}
              ]
            }  
          }
        const totalResult = await elasticService.search('learn-path', query, {size: 1000}, ["_id"]);
        let existingIds = [];

        if(totalResult.hits){
            if(totalResult.hits && totalResult.hits.length > 0){
                 for(const hit of totalResult.hits){                
                    existingIds.push(hit._id)                
                }           
            }
            else
            {
                return res.status(200).send({
                    success:true,
                    data:{
                        enquiries:[],
                        count:0
                    }
                })
            }
        }

        learnpathIds = learnpathIds.map(id =>`LRN_PTH_${id}`)
        learnpathIds = learnpathIds.filter((id => existingIds.includes(id)))
        let totalCount = learnpathIds.length

            //fetch enquiries, details
        let enqConfig = { 
                attributes: ['learnpathId','createdAt'],
                where: { userId, learnpathId : learnpathIds},
                limit, raw: true, order: sequelize.literal('"createdAt" DESC')
        }
        
        if(page > 1) {
            enqConfig.offset = offset
        }
        let enquiryRecs = await models.learnpath_enquiry.findAll(enqConfig)
          
            // no enquiries return
        if(!enquiryRecs.length) {
            return res.status(200).send({
                success:true,
                data:{
                    enquiries:[],
                    count:0
                }
            })
        }
        let enquiriesDone = []

        for (let key = 0; key < enquiryRecs.length ; key++) {
            let enquiry = {
                sourceUrl: "",
                learnpathName:'',
                categoryName:'',
                createdAt:enquiryRecs[key].createdAt,
                images:{},
                courses:[]

            }
            let queryBody = {
                "_source":["title","categories","courses","images", "slug"],
                "query": {
                  "terms": {
                      "id": [enquiryRecs[key].learnpathId.replace(/[^0-9]+/, '')]
                  },
                }
            };
            
            const result = await elasticService.plainSearch('learn-path', queryBody);
            if(result.hits){
                if(result.hits.hits && result.hits.hits.length > 0){
                    let hit =  result.hits.hits[0]
                    enquiry.sourceUrl =  process.env.FRONTEND_URL + "learnpath/" +hit._source.slug
                    enquiry.learnpathName = hit._source.title
                    enquiry.categoryName = hit._source.categories? hit._source.categories.toString():""
                    enquiry.images = hit._source.images
                    let courses = hit._source.courses

                    courses.sort(function (a, b) {
                        return a.position - b.position;
                    });

                    // details of all course in a learnpath
                    for(let course = 0;course < courses.length;course++){
                        let course_dict = {
                            course_name:'',
                            course_category:[],
                            partner_name:'',
                            images:'',
                            slug:''
                        }

                        let query = {
                            "query": {
                              "terms": {
                                  "id": [courses[course].id.replace(/[^0-9]+/, '')]
                              },
                            }
                        };

                        const result_course = await elasticService.plainSearch('learn-content', query);
                        if(result_course.hits){
                            if(result_course.hits.hits && result_course.hits.hits.length > 0){
                                let h_course =  result_course.hits.hits[0]
                                
                                course_dict.slug = h_course._source.slug?h_course._source.slug:""
                                course_dict.images = h_course._source.images?h_course._source.images:""
                                course_dict.course_name = h_course._source.title?h_course._source.title.toString():""
                                course_dict.course_category = h_course._source.categories?h_course._source.categories:[]
                                course_dict.partner_name = h_course._source.partner_name?h_course._source.partner_name.toString():""
                            }
                        }
                        enquiry.courses.push(course_dict);
                    }
                }
            }
            enquiriesDone.push(enquiry);
        }

        //fetch course fron esatic
        //enquiriesDone = enquiriesDone.filter(enquiry => enquiry.learnpathName);
        return res.status(200).send({
            success:true,
            data:{
                enquiries:enquiriesDone,
                count:totalCount
            }
        })


    }
    catch(err){
        return res.status(500).send({error:true, message: err.message})
    }
}

module.exports = {
    fetchEnquiry,
    createEnquiry,
    createLearnpathEnquiry,
    fetchLearnpathEnquiry
}