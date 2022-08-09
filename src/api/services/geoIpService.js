const models = require("../../../models");

    module.exports = {
        getIpDetails: async(ip) => {

            try {
                let details = await models.sequelize.query(`select latitude, longitude, accuracy_radius, continent_name, country_name, subdivision_1_name, city_name
                from geoip2_networks net
                left join geoip2_locations location on (
                  net.geoname_id = location.geoname_id
                  and location.locale_code = 'en'
                )
                where network >> '${ip}'`)
                if(details[0][0])
                {
                    if(details[0][0].country_name =="India")
                    {
                        details[0][0].region ="India"
                    }
                    else if(details[0][0].country_name =="United Kingdom")
                    {
                        details[0][0].region ="UK"
                    }
                    else if(details[0][0].country_name =="United States")
                    {
                        details[0][0].region ="USA"
                    }
                    else if(details[0][0].continent_name =="Europe")
                    {
                        details[0][0].region ="Europe"
                    }
                    else
                    {
                        details[0][0].region ="Other"
                    }
                }
                return {success:true, data: details[0][0] }
            }
    
            catch(err) {
                return {success:false, message: err.message}
            }
    
    
        }
    }