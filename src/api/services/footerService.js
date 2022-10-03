const communication = require('../../communication/v1/communication');
const elasticService = require("./elasticService");
const redisConnection = require('../../services/v1/redis');
const fetch = require("node-fetch");
const RedisConnection = new redisConnection();
const apiBackendUrl = process.env.API_BACKEND_URL;
const {formatImageResponse} = require('../../api/utils/general');
const {generateMetaInfo} = require('../utils/metaInfo');

const getData  = (entry) => {

    let finalObj = {};
    for (let key in entry) {
        if(typeof entry[key] === "object")
            finalObj[key] = getData(entry[key])
        else if(key != "id" && key != "created_at" && key != "created_by" && key != "updated_at" && key != "updated_by"){
            finalObj[key] = entry[key];
        }
    }
    return finalObj;
}
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
                    return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
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
            return callback(null, {success: false, message: 'backend server failed!', data: []});
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

            callback(null, {success: true, message: 'Fetched successfully!', data:footerData});
        } else {
            callback(null, {success: false, message: 'No data available!', data: []});
        }

    }

    async ranking(callback, useCache = true){
        const cacheKey = "ranking-list";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
                }
            }catch(error){
                console.warn("Redis cache failed for : "+cacheKey, error);
            }
        }

        let result = null;
        try{
            result = await fetch(`${apiBackendUrl}/rankings`);
        }catch(e){
            console.log('Error while retriving data: '+cacheKey,e);
            return callback(null, {success: false, message: 'backend server failed!', data: []});
            
        }
        if(result.ok) {
            let response = await result.json();
            let list = []
            for(const rank of response){
                let entry = getData(rank);
                if(entry.image )
                    entry.image =  formatImageResponse(entry.image);
                if(entry.logo )
                    entry.logo =  formatImageResponse(entry.logo);
                list.push(entry)
            }
            RedisConnection.set(cacheKey, list);
            callback(null, {success: true, message: 'Fetched successfully!', data:list});
        } else {
            callback(null, {success: false, message: 'No data available!', data: []});
        }
    }

    async partnerWithUs(callback, useCache = true){
        const cacheKey = "partner-with-us";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
                }
            }catch(error){
                console.warn("Redis cache failed for : "+cacheKey, error);
            }
        }

        let result = null;
        try{
            result = await fetch(`${apiBackendUrl}/partner-with-us`);
        }catch(e){
            console.log('Error while retriving data: '+cacheKey,e);
            return callback(null, {success: false, message: 'backend server failed!', data: []});
            
        }
        if(result.ok) {
            let response = await result.json();
            if(response.partnership_benefits  && response.partnership_benefits.length > 0)
            {
                response.partnership_benefits = response.partnership_benefits.map(benefit => {
                    benefit.image = (benefit.image.url)? benefit.image.url : formatImageResponse(benefit.image)
                    return benefit
                })
            }
            let res = {};
            for (let key in response) {
                if(key != "id" && key != "created_at" && key != "created_by" && key != "updated_at" && key != "updated_by"){
                    res[key] = response[key];
                }
            }
            res.meta_information = await generateMetaInfo('PARTNER_WITH_US', response)
            RedisConnection.set(cacheKey, res);
            callback(null, {success: true, message: 'Fetched successfully!', data:res});
        } else {
            callback(null, {success: false, message: 'No data available!', data: []});
        }
    }

    async learners(callback, useCache = true){
        const cacheKey = "learners-page";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
                }
            }catch(error){
                console.warn("Redis cache failed for learner-page: "+cacheKey,error);
            }
        }

        let result = null;
        try{
            result = await fetch(`${apiBackendUrl}/learners-page`);
        }catch(e){
            console.log('Error while retriving learner-page data',e);
            return callback(null, {success: false, message: 'backend server failed!', data: []});
        }
        if(result.ok) {
            let response = await result.json();
            if(response.content_section && response.content_section.length > 0)
            {
                response.what_sets_us_apart_from_the_rest = response.what_sets_us_apart_from_the_rest.map(section => {
                    section.image = formatImageResponse(section.image)
                    return section
                })
            }
            let res = {};
            for (let key in response) {
                if(key != "id" && key != "created_at" && key != "created_by" && key != "updated_at" && key != "updated_by"){
                    res[key] = response[key];
                }
            }
            res.meta_information = await generateMetaInfo('LEARNERS', response)
            RedisConnection.set(cacheKey, res);
            callback(null, {success: true, message: 'Fetched successfully!', data:res});
        } else {
            callback(null, {success: false, message: 'No data available!', data: []});
        }
    }

    async aboutUs(callback, useCache = true){
        const cacheKey = "about-us";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
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
            return callback(null, {success: false, message: 'backend server failed!', data: []});
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
            
            res.meta_information = await generateMetaInfo('ABOUT_US', response)
            RedisConnection.set(cacheKey, res);
            callback(null, {success: true, message: 'Fetched successfully!', data:res});
        } else {
            callback(null, {success: false, message: 'No data available!', data: []});
        }
    }

    async leadership(callback, useCache = true){
        const cacheKey = "leadership";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
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
            return callback(null, {success: false, message: 'backend server failed!', data: []});
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
            res.meta_information = await generateMetaInfo('LEADERSHIP', response)
            RedisConnection.set(cacheKey, res);
            callback(null, {success: true, message: 'Fetched successfully!', data:res});
        } else {
            callback(null, {success: false, message: 'No data available!', data: []});
        }
    }

    async team(callback, useCache = true){
        const cacheKey = "team";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
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
            return callback(null, {success: false, message: 'backend server failed!', data: []});
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
            res.meta_information = await generateMetaInfo('TEAM', response)
            RedisConnection.set(cacheKey, res);
            callback(null, {success: true, message: 'Fetched successfully!', data:res});
        } else {
            callback(null, {success: false, message: 'No data available!', data: []});
        }
    }

    async career(callback, useCache = true){
        const cacheKey = "career";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
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
            return callback(null, {success: false, message: 'backend server failed!', data: []});
        }
        if(result.ok) {
            let response = await result.json();
            if(response.content_section && response.content_section.length > 0)
            {
                response.content_section = response.content_section.map(content_section => {
                    content_section.image = (content_section.image.url)? content_section.image.url: formatImageResponse(content_section.image)
                    return content_section
                })
            }
            let res = {};
            for (let key in response) {
                if(key != "id" && key != "created_at" && key != "created_by" && key != "updated_at" && key != "updated_by"){
                    res[key] = response[key];
                }
            }
            res.meta_information = await generateMetaInfo('CAREER', response)
            RedisConnection.set(cacheKey, res);
            callback(null, {success: true, message: 'Fetched successfully!', data:res});
        } else {
            callback(null, {success: false, message: 'No data available!', data: []});
        }
    }

    async termandcondition(callback, useCache = true){
        const cacheKey = "term-and-condition";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
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
            return callback(null, {success: false, message: 'backend server failed!', data: []});
        }
        if(result.ok) {
            let response = await result.json();
            let res = {};
            for (let key in response) {
                if(key != "id" && key != "created_at" && key != "created_by" && key != "updated_at" && key != "updated_by"){
                    res[key] = response[key];
                }
            }
            res.meta_information = await generateMetaInfo('TERMS_AND_CONDITION', response)
            RedisConnection.set(cacheKey, res);
            callback(null, {success: true, message: 'Fetched successfully!', data:res});
        } else {
            callback(null, {success: false, message: 'No data available!', data: []});
        }
    }

    async privacypolicy(callback, useCache = true){
        const cacheKey = "privacy-policy";

        if(useCache){
            try {
                let cacheData = await RedisConnection.getValuesSync(cacheKey);
                if(cacheData.noCacheData != true) {
                    return callback(null, {success: true, message: 'Fetched successfully!', data: cacheData});
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
            return callback(null, {success: false, message: 'backend server failed!', data: []});
        }
        if(result.ok) {
            let response = await result.json();
            let res = {};
            for (let key in response) {
                if(key != "id" && key != "created_at" && key != "created_by" && key != "updated_at" && key != "updated_by"){
                    res[key] = response[key];
                }
            }
            res.meta_information = await generateMetaInfo('PRIVACY_POLICY', response)
            RedisConnection.set(cacheKey, res);
            callback(null, {success: true, message: 'Fetched successfully!', data:res});
        } else {
            callback(null, {success: false, message: 'No data available!', data: []});
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
            callback(null,{success: true, message: 'Successful!'});
        } catch (error) {
            console.log(error);
            callback(null, {success: false, message: 'Something unexpected happend, we are looking into it.'});
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
            callback(null,{success: true, message: 'Successful!'});
        } catch (error) {
            console.log(error);
            callback(null, {success: false, message: 'Something unexpected happend, we are looking into it.'});
        }
         

    }
}
