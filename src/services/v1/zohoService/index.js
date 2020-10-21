const axios = require("axios");
const moment = require("moment");
const models = require("../../../../models");
const eventEmitter2 = require('../../../utils/subscriber');
 /**
     * { function_description }
     * code to be used from the console or generate via browser
     * @param      {<type>}  code    The code
     */
    const generateAccessToken = (code) => { 
        let request_url = "https://accounts.zoho.in/oauth/v2/token"

        axios.post(request_url, {
            client_id: process.env.ZOHO_CLIENT_ID,
            client_secret: process.env.ZOHO_CLIENT_SECRET,
            redirect_uri: process.env.ZOHO_REDIRECT_URI,
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
            let request_url = "https://accounts.zoho.in/oauth/v2/token?refresh_token="+refresh_token.data_value+"&client_id="+zohoConfig.client_id+"&client_secret="+zohoConfig.client_secret+"&grant_type=refresh_token"
       
            axios.post(request_url).then((response) => {
                let new_access_token = response.data.access_token
                let expiry_min = response.data.expires_in
                let expiry_date = moment().add(expiry_min, 'm').toString();
                let meta_data_value =  JSON.stringify({"expiry_date":expiry_date})
                
                let values = {
                            data_value:new_access_token,
                            metaData:meta_data_value
                        }
                models.global_defaults.update(values, { where: {  dataType: 'access_token' } }).then((tokenupdate) => {
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
            models.global_defaults.findOne({ where: {dataType:type } }).then(function(token) {

                if(token==null){
                    return resolve(null);
                }
                else{
                    return resolve(token.dataValues);
                }
               
            })

        });
    }


    const getAccessToken = () => { 
        return new Promise(async (resolve, reject) => {
            let access_token_obj = await getDefaultsValue('access_token');
            let access_token  = access_token_obj.data_value
            if(access_token==null || access_token==''){
                let access_token = await generateNewAccessToken();
                return resolve(access_token)
            }
            else{
                
                // check if token is expired
                let meta_data  = JSON.parse(access_token_obj.metaData)
                let access_token_expiry_obj = moment(meta_data.expiry_date).toString();

                if (moment().isAfter(access_token_expiry_obj)){
                    let access_token = await generateNewAccessToken();
                    return resolve(access_token)
                }
                else{
                    return resolve(access_token)
                }
                 
            }

        });  
    }
    const prepareLeadData = (enquiry_id) => {
        return new Promise(resolve => {
            const data = {
                Last_Name:"kudnekar",
                Email:"latesh@ajency.in"
            }
            resolve(data)
        })
    }
    const createLead = async (enquiry_id ) => {
        let request_url = "https://www.zohoapis.in/crm/v2/Leads"
        const access_token = await getAccessToken();
        const request_header = {'Authorization': 'Zoho-oauthtoken '+access_token}
        const data = await prepareLeadData(enquiry_id)
        let config = {
            method:'POST',
            headers: request_header,
            request_url,
            data:data
        }
        axios(config, {
        }).then((response) => {
            console.log(response);
        }, (error) => {
            console.log(error);
        });
        
    }

module.exports = {
    createLead
}