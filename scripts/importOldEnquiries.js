'use strict';
require('dotenv').config();
const { sequelize } = require("../models");

const elasticService = require("../src/api/services/elasticService");

/*
this is one time run file to copy all the old enquiries exists in old table
to new one
*/

const models = require("../models")

const getCourseDetails =  (courseId) => {

        return new Promise( async (resolve, reject) => {
    
    const query = { "bool": {
        "must": [{ term: { "_id": courseId }}]
    }};

//fetch partnerId  frm learn-content index
    try {
        const result = await elasticService.search('learn-content', query)
        if( result.hits && result.hits.length > 0 ){
            resolve({ partnerId: result.hits[0]._source.partner_id,
                    courseName: result.hits[0]._source.title, courseId : result.hits[0]._id })
            }
        else{
            reject("[ elasticsearch ] No matching course with courseId "+courseId)
        }
    }
    catch(err){
        console.log(err)
    }
})}


//gets email , phone, fullname from user_meta
const getUserDetails =  (metaObjectIds, userId) => {

    return new Promise( async (resolve, reject) => {
        
        let fullName, email , phone, highestDegree, student , experience;

    try {
        let config = { where: {userId, id : metaObjectIds}, order: sequelize.literal('"key" ASC')}
        let userData = await models.user_meta.findAll(config)

        userData.forEach((each, i) => {

            if(each.dataValues.key == "firstName")
                fullName = each.dataValues.value +" "
            if(each.dataValues.key == "lastName")
                fullName += each.dataValues.value
            if(each.dataValues.key == "email")
                email = each.dataValues.value
            if(each.dataValues.key == "phone")
                each.dataValues.value != "" ? phone = each.dataValues.value : phone = "-"
            if(each.dataValues.key == "experience"){
                try{
                    let exp = JSON.parse(each.dataValues.value)
                    experience = exp.value
                }
                catch(err){
                    experience = each.dataValues.value
                    console.log("[Its Okay!!]"+err)
                }

            }
            if(each.dataValues.key == "education"){
                let edu = JSON.parse(each.dataValues.value)
                student = true
                highestDegree = edu[0].degree.value
            }
        })

        if(userData.length > 0)
            resolve({ fullName, email, phone, student, highestDegree, experience })
        
    }

    catch(err){
        console.log(err)
        reject(err)
    }
})}


const exportCourseEnquiries = async () => {
   
    return new Promise( async (resolve, reject) => {

    try {
        let enquiries = await models.form_submission.findAll({where:{formType:"enquiry", targetEntityType:"course"}})
        enquiries.forEach( async (enquiry) => {
            
            //targetEntityId is basically  courseId
            let { id, userId, targetEntityId, createdAt } = enquiry
            

            let metaTableEntries= await models.form_submission_values.findAll({where:{ formSubmissionId : id}})
            let metaObjectIds = []

            //get meta tables object Ids, where actaul data resides
            metaTableEntries.forEach((entry, i) => {
                    metaObjectIds[i] = entry.dataValues.objectId
            })

            await getUserDetails(metaObjectIds, userId)
            .then( async (user) => {

                //targetEntityId is coruse id
                await getCourseDetails(targetEntityId)
                .then( async (course) => {
                       let { email , phone, fullName, student, highestDegree, experience} = user
                       let {courseId, courseName, partnerId } = course
                       await models.enquiry.create({ userId, phone, fullName, email, student, highestDegree,
                                        experience, courseName, courseId, partnerId, createdAt  })
                       
                }).catch(err => console.log(err))
            })
            resolve(true)
        })

    }
    
    catch(err){
        console.log(err)
        reject(false)
    }})
}



const getLearnpathDetails =  (learnpathId) => {

    return new Promise( async (resolve, reject) => {
        
        const query = { "bool": {
            "must": [{ term: { "_id": learnpathId }}]
        }};
        //fetch details  frm learn-path index
        try {
            const result = await elasticService.search('learn-path', query)
            if( result.hits && result.hits.length > 0 )
                resolve({ learnpathName: result.hits[0]._source.title, learnpathId : result.hits[0]._id })
            else
                reject("[ elasticsearch ] No matching learnpath with learnpathId "+ learnpathId)
        }

        catch(err){
            console.log(err)
            reject(false)
        }
    })
}





const exportLearnpathEnquiries = async () => {
   
    return new Promise( async (resolve, reject) => {
    let enquiries = await models.form_submission.findAll({where:{formType:"enquiry", targetEntityType:"learnpath"}})

    try {
    enquiries.forEach( async (enquiry) => {
        
        //targetEntityId is basically  learnpathId
        let { id, userId, targetEntityId, createdAt } = enquiry
        

        let metaTableEntries= await models.form_submission_values.findAll({where:{ formSubmissionId : id}})
        let metaObjectIds = []

        //get meta tables object Ids, where actaul data resides
        metaTableEntries.forEach((entry, i) => {
                metaObjectIds[i] = entry.dataValues.objectId
        })

        await getUserDetails(metaObjectIds, userId)
        .then( async (user) => {

            //targetEntityId is learnpath id
            await getLearnpathDetails(targetEntityId)
            .then( async ( learnpath ) => {
                   let { email , phone, fullName, student, highestDegree, experience} = user
                   let { learnpathId, learnpathName } = learnpath
                   await models.learnpath_enquiry.create({ userId, phone, fullName, email, learnpathName,
                                learnpathId, student, highestDegree, experience, createdAt})
            }).catch(err => console.log(err))
        })
        resolve(true)

    })
    }
    catch (err){
        console.log(err)
        reject(false)
    }})
}



const execute = async () => {

    await exportCourseEnquiries()

    await exportLearnpathEnquiries()

}

execute()

