'use strict';

const communication = require('../../communication/v1/communication');

const buildEnquiry =  (req) => {

    return new Promise( async (resolve, reject) => {
        let  { fullName = "", email = "", phone = ""} = req.body
        let enquiry = {}
        let  { student, highestDegree, experience, enquiryMessage, courseId, courseName } = req.body

        fullName = fullName.trim()
        email = email.trim()
        phone = phone.trim()

        if ( fullName == '' )
            reject("fullname cannot be empty")
        if ( email == '' ) 
            reject("email cannot be empty")
        if ( phone == '' ) 
            reject("phone cannot be empty")

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
        let  { fullName = "", email = "", phone = ""} = req.body
        let enquiry = {}
        let  { student, highestDegree, experience, enquiryMessage, learnpathId, learnpathName }  = req.body

        fullName = fullName.trim()
        email = email.trim()
        phone = phone.trim()

        if ( fullName == '' )
            reject("fullname cannot be empty")
        if ( email == '' ) 
            reject("email cannot be empty")
        if ( phone == '' ) 
            reject("phone cannot be empty")

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


module.exports = {
    buildEnquiry,
    buildLearnpathEnquiry,
    sendEnquiryEmail
}