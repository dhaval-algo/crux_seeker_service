'use strict';

const communication = require('../../communication/v1/communication');

const buildEnquiry =  (req) => {

    return new Promise( async (resolve, reject) => {
        let  { fullName = "", email = "", phone = "", courseId =""} = req.body
        let enquiry = {}
        let  { student, highestDegree, experience, enquiryMessage, courseName } = req.body

        fullName = fullName.trim()
        email = email.trim()
        phone = phone.trim()
        courseId = courseId.trim()

        if ( fullName == '' )
            reject({ message: "fullname cannot be empty"})
        if ( email == '' ) 
            reject({ message: "email cannot be empty"})
        if ( phone == '' ) 
            reject({ message: "phone cannot be empty"})
        if ( courseId == '' ) 
            reject({ message: "course id cannot be empty"})

        enquiry = { fullName, email, phone, student, highestDegree, experience, enquiryMessage, courseId, courseName}
            // if logged in
        if(req.user != undefined){
            enquiry.userId = req.user.userId
        }

        resolve(enquiry)
}   )
}

const buildLearnpathEnquiry =  (req) => {

    return new Promise( async (resolve, reject) => {
        let  { fullName = "", email = "", phone = "", learnpathId = ""} = req.body
        let enquiry = {}
        let  { student, highestDegree, experience, enquiryMessage, learnpathName }  = req.body

        fullName = fullName.trim()
        email = email.trim()
        phone = phone.trim()
        learnpathId = learnpathId.trim()

        if ( fullName == '' )
            reject({ message: "fullname cannot be empty"})
        if ( email == '' ) 
            reject({ message: "email cannot be empty"})
        if ( phone == '' ) 
            reject({ message: "phone cannot be empty"})
        if ( learnpathId == '' ) 
            reject({ message: "learnpathId cannot be empty"})

        enquiry = { fullName, email, phone, student, highestDegree, experience, enquiryMessage, learnpathId, learnpathName}
            // if logged in
        if(req.user != undefined)
            enquiry.userId = req.user.userId

        resolve(enquiry)
}   )
}

const sendEnquiryEmail = async (email, data) =>{

    let emailPayload = {
        fromemail: process.env.FROM_EMAIL_ENQUIRY_EMAIL,
        toemail:  email,
        email_type: "enquiry_email_to_partner",
        email_data: data 
    }
    await communication.sendEmail(emailPayload, false)

   
}

const sendEnquiryEmailToAdmin = async (data) =>{    

    emailPayload = {
        fromemail: process.env.FROM_EMAIL_ENQUIRY_EMAIL,
        toemail:  process.env.TO_EMAIL_ENQUIRY_ADMINS,
        email_type: "enquiry_email_to_admins",
        email_data: data 
    }
    await communication.sendEmail(emailPayload, false)
}


module.exports = {
    buildEnquiry,
    buildLearnpathEnquiry,
    sendEnquiryEmail,
    sendEnquiryEmailToAdmin
}