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
                
                return {error:false, data: details[0][0] }
            }
    
            catch(err) {
                return {error:true, message: err.message}
            }
    
    
        }
    }