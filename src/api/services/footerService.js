const communication = require('../../communication/v1/communication');
const elasticService = require("./elasticService");
const redisConnection = require('../../services/v1/redis');
const fetch = require("node-fetch");
const RedisConnection = new redisConnection();
const apiBackendUrl = process.env.API_BACKEND_URL;
const {formatImageResponse} = require('../../api/utils/general');

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
            if(response.content_section && response.content_section.length > 0)
            {
                response.content_section = response.content_section.map(content_section => {
                    content_section.image = formatImageResponse(content_section.image)
                    return content_section
                })
            }
            if(response.learn_more_about_us && response.learn_more_about_us.length > 0)
            {
                response.learn_more_about_us = response.learn_more_about_us.map(learn_more_about_us => {
                    learn_more_about_us.image = formatImageResponse(learn_more_about_us.image)
                    return learn_more_about_us
                })
            }
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

    async leadership(req, callback,useCache = true){
        const cacheKey = "leadership";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    //console.log("cache found for footer: returning data");
                    return callback(null, {status: 'success', message: 'Fetched successfully!', data: cacheData});
                }
            }catch(error){
                console.warn("Redis cache failed for page leadership: "+cacheKey,error);
            }
        }

        let result = null;
        try{
            result = await fetch(`${apiBackendUrl}/leadership`);
        }catch(e){
            console.log('Error while retriving leadership data',e);
        }
        if(result.ok) {
            let response = await result.json();
            if(response.team_section  && response.team_section.length > 0)
            {
                response.team_section = response.team_section.map(team_section => {
                    team_section.image = formatImageResponse(team_section.image)
                    return team_section
                })
            }
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

    async team(req, callback,useCache = false){
        const cacheKey = "team";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    //console.log("cache found for footer: returning data");
                    return callback(null, {status: 'success', message: 'Fetched successfully!', data: cacheData});
                }
            }catch(error){
                console.warn("Redis cache failed for page team: "+cacheKey,error);
            }
        }

        let result = null;
        try{
            result = await fetch(`${apiBackendUrl}/team`);
        }catch(e){
            console.log('Error while retriving team data',e);
        }
        if(result.ok) {
            let response = await result.json();
            if(response.teams && response.teams.length > 0)
            {
                response.teams = response.teams.map(team => {
                    team.image = formatImageResponse(team.image)
                    return team
                })
            }
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

    async career(req, callback,useCache = true){
        const cacheKey = "career";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    //console.log("cache found for footer: returning data");
                    return callback(null, {status: 'success', message: 'Fetched successfully!', data: cacheData});
                }
            }catch(error){
                console.warn("Redis cache failed for page career: "+cacheKey,error);
            }
        }

        let result = null;
        try{
            result = await fetch(`${apiBackendUrl}/career`);
        }catch(e){
            console.log('Error while retriving career data',e);
        }
        if(result.ok) {
            let response = await result.json();
            if(response.content_section && response.content_section.length > 0)
            {
                response.content_section = response.content_section.map(content_section => {
                    content_section.image = formatImageResponse(content_section.image)
                    return content_section
                })
            }
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

    async termandcondition(req, callback,useCache = true){
        const cacheKey = "term-and-condition";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    //console.log("cache found for footer: returning data");
                    return callback(null, {status: 'success', message: 'Fetched successfully!', data: cacheData});
                }
            }catch(error){
                console.warn("Redis cache failed for page termandcondition: "+cacheKey,error);
            }
        }

        let result = null;
        try{
            result = await fetch(`${apiBackendUrl}/terms-and-conditions`);
        }catch(e){
            console.log('Error while retriving terms-and-conditions data',e);
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

    async privacypolicy(req, callback,useCache = true){
        const cacheKey = "privacy-policy";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    //console.log("cache found for footer: returning data");
                    return callback(null, {status: 'success', message: 'Fetched successfully!', data: cacheData});
                }
            }catch(error){
                console.warn("Redis cache failed for page privacypolicy: "+cacheKey,error);
            }
        }

        let result = null;
        try{
            result = await fetch(`${apiBackendUrl}/privacy-policy`);
        }catch(e){
            console.log('Error while retriving privacy-policy data',e);
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