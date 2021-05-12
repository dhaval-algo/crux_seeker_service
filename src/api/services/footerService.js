const communication = require('../../communication/v1/communication');

module.exports = class FooterService {
    async sendContactEmail(requestData,callback) {
 
        try {
            let name = (requestData.name != undefined ) ? requestData.name :''
            let email = (requestData.email != undefined ) ? requestData.email :''
            let phone = (requestData.phone != undefined ) ? requestData.phone :''
            let comment = (requestData.comment != undefined ) ? requestData.comment :''

            let emailPayload = {
                fromemail: process.env.FROM_EMAIL,
                toemail: process.env.TO_EMAIL,
                ccaddress : [],
                bccaddress : [],
                email_type: "contact_email",
                email_data: {
                    name: name,
                    email: email,
                    phone: phone,
                    comment: comment
                }
            }
            await communication.sendEmail(emailPayload)
            callback(null,true);
        } catch (error) {
            console.log(error);
            callback(error,null)
        }
         

    }

    async sendFeedbackEmail(requestData,callback) {
 
        try {
            let name = (requestData.name != undefined ) ? requestData.name :''
            let email = (requestData.email != undefined ) ? requestData.email :''
            let phone = (requestData.phone != undefined ) ? requestData.phone :''
            let comment = (requestData.comment != undefined ) ? requestData.comment :''

            let emailPayload = {
                fromemail: process.env.FROM_EMAIL,
                toemail: process.env.TO_EMAIL,
                ccaddress : [],
                bccaddress : [],
                email_type: "feedback_email",
                email_data: {
                    name: name,
                    email: email,
                    phone: phone,
                    comment: comment
                }
            }
            await communication.sendEmail(emailPayload)
            callback(null,true);
        } catch (error) {
            console.log(error);
            callback(error,null)
        }
         

    }

}