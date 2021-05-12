const communication = require('../../communication/v1/communication');
const elasticService = require("./elasticService");

module.exports = class FooterService {
    async getFooter(slug, callback){

        const query = {
            "match_all": {}
        };

        let result = null;
        try{
            result = await elasticService.search('footer', query);
            console.log(result);
        }catch(e){
            console.log('Error while retriving footer data',e);
        }
        if(result && result.hits && result.hits.length > 0) {
            let footerData = {};
            for(let i=0;i<result.hits.length;i++){
                if(Object.keys(result.hits[i]._source).length != 0){
                    footerData = result.hits[i]._source.content;
                    break;
                }
            }
            callback(null, {status: 'success', message: 'Fetched successfully!', data:footerData});
        } else {
            callback(null, {status: 'failed', message: 'No data available!', data: []});
        }

    }
  
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