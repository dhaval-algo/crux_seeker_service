const axios = require("axios");
const moment = require("moment");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

const models = require("../../../../models");
const eventEmitter2 = require('../../../utils/subscriber');
const elasticService = require("../../../../src/api/services/elasticService");

/**
    * { function_description }
    * code to be used from the console or generate via browser
    * @param      {<type>}  code    The code
    */

const zohoConfig = {
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    redirect_uri: process.env.ZOHO_REDIRECT_URI
}
const generateAccessToken = (code) => {
    let request_url = "https://accounts.zoho.in/oauth/v2/token"

    axios.post(request_url, {
        client_id: zohoConfig.client_id,
        client_secret: zohoConfig.client_secret,
        redirect_uri: zohoConfig.redirect_uri,
        code: code
    }).then((response) => {
        
    }, (error) => {
        console.log(error.error);
    });

}

/**
 * { function_description }
 * to generate new access token it requires grant token with specific scope (not possible via API)
 * ***can genarate access token and refresh token for sirst time and use refresh token to generate new access token for every new API call***
 * @return     {Promise}  { description_of_the_return_value }
 */
const generateNewAccessToken = () => {
    return new Promise(async (resolve, reject) => {
        let refresh_token = await getDefaultsValue('refresh_token')
        let request_url = "https://accounts.zoho.in/oauth/v2/token?refresh_token=" + refresh_token.dataValue + "&client_id=" + zohoConfig.client_id + "&client_secret=" + zohoConfig.client_secret + "&grant_type=refresh_token"

        axios.post(request_url).then((response) => {
            
            let new_access_token = response.data.access_token
            let expiry_min = response.data.expires_in
            let expiry_date = moment().add(expiry_min, 's').toString();
            let meta_data_value = JSON.stringify({ "expiry_date": expiry_date })

            let values = {
                dataValue: new_access_token,
                metaData: meta_data_value
            }
            models.global_defaults.update(values, { where: { dataType: 'access_token' } }).then((tokenupdate) => {
                
            }).catch((err) => console.log(err));

            return resolve(response.data.access_token);
        }, (error) => {
            return reject(error);
        });

    });


}

const getDefaultsValue = (type) => {
    return new Promise(async (resolve, reject) => {
        models.global_defaults.findOne({ where: { dataType: type } }).then(function (token) {

            if (token == null) {
                return resolve(null);
            }
            else {
                return resolve(token.dataValues);
            }

        })

    });
}


const getAccessToken = () => {
    return new Promise(async (resolve, reject) => {
        let access_token_obj = await getDefaultsValue('access_token');
        let access_token = access_token_obj.dataValue
        if (access_token == null || access_token == '') {
            let access_token = await generateNewAccessToken();
            return resolve(access_token)
        }
        else {

            // check if token is expired
            let meta_data = JSON.parse(access_token_obj.metaData)
            let access_token_expiry_obj = moment(new Date(meta_data.expiry_date));

            if (moment().isAfter(access_token_expiry_obj)) {
                let access_token = await generateNewAccessToken();
                return resolve(access_token)
            }
            else {
                return resolve(access_token)
            }

        }

    });
}

const getObjectData = (metaObj) => {
    let data = {}
    return new Promise(async (resolve) => {

        for(let objectType in metaObj) {
            switch (objectType) {
                case 'user_meta':
                    const userMeta = await fetchUserMeta(metaObj[objectType])
                    data = {...data,...userMeta}
                break;
            
                default:
                    break;
            }
        }
        return resolve(data)
    }) 
}

const fetchUserMeta = (ids) => {
    return new Promise(async (resolve, reject) => {


        let where = {
            id: { [Op.in]: ids },
        }
        let fieldsRes = await models.user_meta.findAll({
            where
        })
        const formValues = fieldsRes.map((t) => { return { [t.key]: t.value } }).reduce(function (acc, x) {
            for (var key in x) acc[key] = x[key];
            return acc;
        }, {});
        resolve(formValues)
    })
}

const prepareLeadData = (enquiry_id) => {
    return new Promise(async (resolve) => {
        let leadObj = {
            Enquiry_Unique_ID:"LRN_CNT_ENQ_",
            First_Name:"",
            Last_Name:"",
            Email:"",
            Student: null,
            Enquiry_Message:"",
            Gender:"",
            Phone:"",
            Created_On:moment().format(),
            Job_Title:'',
            Company:'',
            Company_Industry:'',
            Experience:'',
            Degree:'',
            Grade:'',
            Institute:'',
            Specialization:'',
            Graduation_Year:'',
            City:'',
            Country:'',
            Current_Company:false,
            Lead_Source:'',
            Course:'',
            Experience_Level:'',
            Highest_Degree:''

        }

        try {

            let enquiry = await  models.enquiry.findOne({where: {id: enquiry_id}})
            
            leadObj.Enquiry_Unique_ID += enquiry.id;
            leadObj.Phone = enquiry.dataValues.phone || "";

            leadObj.First_Name = enquiry.dataValues.fullName.split(" ")[0] || ""
            leadObj.Last_Name = enquiry.dataValues.fullName.split(leadObj.First_Name)[1] || "-"
            leadObj.Email = enquiry.dataValues.email || "";
            leadObj.Student = Boolean(enquiry.dataValues.student);
            leadObj.Enquiry_Message = enquiry.dataValues.enquiryMessage || "";
            leadObj.Experience_Level = enquiry.dataValues.experience || "";
            leadObj.Highest_Degree = enquiry.dataValues.highestDegree || "";

            const query = { "bool": {
                "must": [{ term: { "_id": enquiry.courseId }}]
            }};
            const learnContent = await elasticService.search('learn-content', query)

            if( learnContent.hits && learnContent.hits.length > 0 ){
                leadObj.Lead_Source =  process.env.FRONTEND_URL+ "course/" + learnContent.hits[0]._source.slug
                leadObj.Course = leadObj.Lead_Source
            }


            /* code to fetch profile data
            if(enquiry.userId != undefined){

                let user_meta = await models.user_meta.findAll({where: { userId: enquiry.userId}})
                
                let education, workExp;
                user_meta.forEach((each, i) => {

                    if(each.dataValues.key == "experience"){
                        let exp = JSON.parse(each.dataValues.value)
                        if(leadObj.Experience == "")
                            leadObj.Experience = exp.value
                    }
                    if(each.dataValues.key == "workExp"){
                        workExp = JSON.parse(each.dataValues.value)
                    }
                    if(each.dataValues.key == "education"){
                        education = JSON.parse(each.dataValues.value)
                    }
                    if(each.dataValues.key == "gender")
                        leadObj.Gender = each.dataValues.value;

                    if(each.dataValues.key == "city"){
                        let city = JSON.parse(each.dataValues.value);
                        leadObj.City = city.value
                    }

                    if(each.dataValues.key == "country")
                        leadObj.Country = each.dataValues.value;

                })

                if(education && education.length > 0 ){
                education = education[0] 
                leadObj.Grade = (education.grade)? education.grade.replace(/"/g,"").replace(/\\/g, '') :  "";     // Remove unwanted slash and double quote
        
                    if(education.specialization) 
                        leadObj.Specialization = education.specialization.label || ""
            
                    if(education.degree)
                        if(leadObj.Degree == "") 
                            leadObj.Degree = education.degree.label || ""
            
                    if(education.instituteName)
                        leadObj.Institute = education.instituteName.label || ""

                    if(education.graduationYear)
                        leadObj.Graduation_Year = education.graduationYear || "";
                }

                if(workExp && workExp.length > 0 ){
                    workExp = workExp[0]
                    if(workExp.jobTitle)
                        leadObj.Job_Title = workExp.jobTitle.label || ""
            
                    if(workExp.industry)
                        leadObj.Company_Industry = workExp.industry.label || ""
            
                    if(workExp.company)
                        leadObj.Company = workExp.company.label || ""
            
                    if(workExp.currentCompany)
                        leadObj.Current_Company = Boolean(workExp.currentCompany)
                }
        }*/
            leadObj = cleanObject(leadObj)
            const data = {data:[leadObj]}
            return resolve(data)
        } catch (error) {
            console.log(error);
        }
    })
}

const prepareLearnPathLeadData = (enquiry_id) => {
    return new Promise(async (resolve) => {
        let leadObj = {
            Enquiry_Unique_ID:"LRN_PTH_ENQ_",
            First_Name:"",
            Last_Name:"",
            Email:"",
            Student: null,
            Enquiry_Message:"",
            Gender:"",
            Phone:"",
            Created_On:moment().format(),
            Job_Title:'',
            Company:'',
            Company_Industry:'',
            Experience:'',
            Degree:'',
            Grade:'',
            Institute:'',
            Specialization:'',
            Graduation_Year:'',
            City:'',
            Country:'',
            Current_Company:false,
            Lead_Source:'',
            Course:'',
            Experience_Level:'',
            Highest_Degree:''
        }
        try {

            let enquiry = await  models.learnpath_enquiry.findOne({where: {id: enquiry_id}})
            
            leadObj.Enquiry_Unique_ID += enquiry.id;
            leadObj.Phone = enquiry.dataValues.phone || "";

            leadObj.First_Name = enquiry.dataValues.fullName.split(" ")[0] || ""
            leadObj.Last_Name = enquiry.dataValues.fullName.split(leadObj.First_Name)[1] || "-"
            leadObj.Email = enquiry.dataValues.email || "";
            leadObj.Student = Boolean(enquiry.dataValues.student);
            leadObj.Enquiry_Message = enquiry.dataValues.enquiryMessage || "";
            leadObj.Experience_Level = enquiry.dataValues.experience || "";
            leadObj.Highest_Degree = enquiry.dataValues.highestDegree || "";

            const query = { "bool": {
                "must": [{ term: { "_id": enquiry.learnpathId }}]
            }};
            const learnPath = await elasticService.search('learn-path', query)
                
            if( learnPath.hits && learnPath.hits.length > 0 )
                leadObj.Lead_Source =  process.env.FRONTEND_URL+ "learnpath/" + learnPath.hits[0]._source.slug
            
            /* code for fetching profile data
            if(enquiry.userId != undefined){

                let user_meta = await models.user_meta.findAll({where: { userId: enquiry.userId}})
                
                let education, workExp;;
                user_meta.forEach((each, i) => {

                    if(each.dataValues.key == "experience"){
                        let exp = JSON.parse(each.dataValues.value)
                        if(leadObj.Experience == "")
                            leadObj.Experience = exp.value
                    }
                    if(each.dataValues.key == "workExp"){
                        workExp = JSON.parse(each.dataValues.value)
                    }
                    if(each.dataValues.key == "education")
                        education = JSON.parse(each.dataValues.value)

                    if(each.dataValues.key == "gender")
                        leadObj.Gender = each.dataValues.value;

                    if(each.dataValues.key == "city"){
                        let city = JSON.parse(each.dataValues.value);
                        leadObj.City = city.value
                    }

                    if(each.dataValues.key == "country")
                        leadObj.Country = each.dataValues.value;

                })

                if(education && education.length > 0 ){
                education = education[0] 
                leadObj.Grade = (education.grade)? education.grade.replace(/"/g,"").replace(/\\/g, '') :  "";     // Remove unwanted slash and double quote
        
                    if(education.specialization) 
                        leadObj.Specialization = education.specialization.label || ""
            
                    if(education.degree)
                        if(leadObj.Degree == "") 
                            leadObj.Degree = education.degree.label || ""
            
                    if(education.instituteName)
                        leadObj.Institute = education.instituteName.label || ""
            
                    if(education.graduationYear)
                        leadObj.Graduation_Year = education.graduationYear || "";
                    }

                if(workExp && workExp.length > 0 ){
                    workExp = workExp[0]
                    if(workExp.jobTitle)
                        leadObj.Job_Title = workExp.jobTitle.label || ""
            
                    if(workExp.industry)
                        leadObj.Company_Industry = workExp.industry.label || ""
            
                    if(workExp.company)
                        leadObj.Company = workExp.company.label || ""
            
                    if(workExp.currentCompany)
                        leadObj.Current_Company = Boolean(workExp.currentCompany)
                }
            }*/
            leadObj = cleanObject(leadObj)
            const data = {data:[leadObj]}
            return resolve(data)
        } catch (error) {
            console.log(error);
        }
    })
}

const cleanObject = (obj) => {
    for (var propName in obj) { 
      if (obj[propName] === null || obj[propName] === undefined || obj[propName] === "") {
        delete obj[propName];
      }
    }
    return obj
}
const createLead = async (enquiry_id) => {
    let request_url = "https://www.zohoapis.in/crm/v2/Leads"
    const access_token = await getAccessToken();
    const headers = { 'Authorization': 'Zoho-oauthtoken ' + access_token, 'Content-Type': 'application/json'}
    const data = await prepareLeadData(enquiry_id)
    axios.post(request_url, data,{headers}).then((response) => {
        if(response.data.details) {
            
            
        } else {
           

        }
        
    }).catch(e => {
        console.log("error in create lead",e.response.data);
        console.log("error in create lead",e.response.data.details);
    })

}

const createLearnPathLead = async (enquiry_id) => {
    let request_url = "https://www.zohoapis.in/crm/v2/Leads"
    const access_token = await getAccessToken();
    const headers = { 'Authorization': 'Zoho-oauthtoken ' + access_token, 'Content-Type': 'application/json'}
    const data = await prepareLearnPathLeadData(enquiry_id)
    axios.post(request_url, data,{headers}).then((response) => {
        if(response.data.details) {
            
            
        } else {
           

        }
        
    }).catch(e => {
        console.log("error in learnpath create lead",e.response.data);
        console.log("error in learnpath create lead",e.response.data.details);
    })

}

module.exports = {
    createLead,
    createLearnPathLead
}
