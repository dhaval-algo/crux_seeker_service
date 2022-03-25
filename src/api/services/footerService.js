const communication = require('../../communication/v1/communication');
const elasticService = require("./elasticService");
const redisConnection = require('../../services/v1/redis');
const fetch = require("node-fetch");
const RedisConnection = new redisConnection();
const apiBackendUrl = process.env.API_BACKEND_URL;

module.exports = class FooterService {
    async getFooter(slug, callback,useCache = true){

        const query = {
            "match_all": {}
        };

        const cacheKey = "page-footer";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    //console.log("cache found for footer: returning data");
                    return callback(null, {status: 'success', message: 'Fetched successfully!', data: cacheData});
                }
            }catch(error){
                console.warn("Redis cache failed for page footer: "+cacheKey,error);
            }
        }

        let result = null;
        try{
            result = await elasticService.search('footer', query);
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

            RedisConnection.set(cacheKey, footerData);
            RedisConnection.expire(cacheKey, process.env.CACHE_EXPIRE_PAGE_FOOTER); 

            callback(null, {status: 'success', message: 'Fetched successfully!', data:footerData});
        } else {
            callback(null, {status: 'failed', message: 'No data available!', data: []});
        }

    }

    async aboutUs(req, callback,useCache = true){
        const cacheKey = "about-us";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    //console.log("cache found for footer: returning data");
                    return callback(null, {status: 'success', message: 'Fetched successfully!', data: cacheData});
                }
            }catch(error){
                console.warn("Redis cache failed for about us page: "+cacheKey,error);
            }
        }

        let result = null;
        try{
            result = await fetch(`${apiBackendUrl}/about-us`);
        }catch(e){
            console.log('Error while retriving about us data',e);
        }
        if(result.ok) {
            let response = await result.json();
            let res = {};
            for (let key in response) {
                if(key != "id" && key != "created_at" && key != "created_by" && key != "updated_at" && key != "updated_by"){
                    res[key] = response[key];
                }
            }

            RedisConnection.set(cacheKey, res);
            callback(null, {status: 'success', message: 'Fetched successfully!', data:res});
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
            //    fromemail: process.env.FROM_EMAIL,
                fromemail: "customercare@careervira.com",
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
              //  fromemail: process.env.FROM_EMAIL,
                fromemail: "customercare@careervira.com",
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