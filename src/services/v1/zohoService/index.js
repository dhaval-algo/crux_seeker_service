const axios = require("axios");
const moment = require("moment");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

const models = require("../../../../models");
const eventEmitter2 = require('../../../utils/subscriber');
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
        console.log(response.data);
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
            console.log('generateNewAccessToken', response.data.access_token);
            let new_access_token = response.data.access_token
            let expiry_min = response.data.expires_in
            let expiry_date = moment().add(expiry_min, 's').toString();
            let meta_data_value = JSON.stringify({ "expiry_date": expiry_date })

            let values = {
                dataValue: new_access_token,
                metaData: meta_data_value
            }
            models.global_defaults.update(values, { where: { dataType: 'access_token' } }).then((tokenupdate) => {
                console.log("data successfully updated to tokenupdate")
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
            First_Name:"",
            Last_Name:"",
            Email:"",
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
            Lead_Origin_or_Source:''
        }
        try {
           formSubRec = await  models.form_submission.findOne({where: {id: enquiry_id}})
            if(formSubRec.otherInfo) {
                // const otherObj = JSON.parse(formSubRec.otherInfo)
                leadObj.Lead_Origin_or_Source = formSubRec.otherInfo.sourceUrl
            }
            formSubValRec = await models.form_submission_values.findAll({where: {formSubmissionId: enquiry_id}})
            if(formSubValRec != null) {
                let metaObj = {} 
                formSubValRec.map((rec) => {
                    console.log(rec.objectType);
                    if(metaObj[rec.objectType]) {
                        metaObj[rec.objectType].push(rec.objectId)
                    } else {
                        metaObj[rec.objectType] = [];
                        metaObj[rec.objectType].push(rec.objectId)
                    }
                })
                let metaObjVal = await getObjectData(metaObj)
                leadObj.Phone = `+${metaObjVal.phone}` || "";
                leadObj.First_Name = metaObjVal.firstName || "";
                leadObj.Last_Name = metaObjVal.lastName || "Not given";
                leadObj.Gender = metaObjVal.gender || "";
                leadObj.Grade = metaObjVal.grade || "";
                leadObj.Email = metaObjVal.email || "";
                leadObj.Graduation_Year = metaObjVal.graduationYear || "";

                if(metaObjVal.specialization) {
                    leadObj.Specialization = JSON.parse(metaObjVal.specialization).label
                }

                if(metaObjVal.degree) {
                    leadObj.Degree = JSON.parse(metaObjVal.degree).label
                }

                if(metaObjVal.instituteName) {
                    leadObj.Institute = JSON.parse(metaObjVal.instituteName).label
                }

                if(metaObjVal.experience) {
                    leadObj.Experience = JSON.parse(metaObjVal.experience).label
                }

                if(metaObjVal.jobTitle) {
                    leadObj.Job_Title = JSON.parse(metaObjVal.jobTitle).label
                }

                if(metaObjVal.industry) {
                    leadObj.Company_Industry = JSON.parse(metaObjVal.industry).label
                }

                if(metaObjVal.company) {
                    leadObj.Company = JSON.parse(metaObjVal.company).label
                }

                if(metaObjVal.currentCompany) {
                    leadObj.Current_Company = Boolean(metaObjVal.currentCompany)
                }

            }
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
      if (obj[propName] === null || obj[propName] === undefined || obj[propName] == "") {
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
        console.log(response.data);
    }).catch(e => {
        console.log(e.response.data);
    })

}

module.exports = {
    createLead
}