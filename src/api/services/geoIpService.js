const models = require("../../../models");
const regionToCurrency = {
    "India" : "INR",
    "Europe": "EUR",
    "UK" : "GBP",
    "USA" : "USD"
}
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
                let data = null 
                if(details[0][0])
                {
                    data = details[0][0]
                    if(data.country_name =="India")
                    {
                        data.region ="India"
                    }
                    else if(data.country_name =="United Kingdom")
                    {
                        data.region ="UK"
                    }
                    else if(data.country_name =="United States")
                    {
                        data.region ="USA"
                    }
                    else if(data.continent_name =="Europe")
                    {
                        data.region ="Europe"
                    }
                    else
                    {
                        data.region ="USA"
                    }
                    data.c697d2981bf416569a16cfbcdec1542b5398f3cc77d2b905819aa99c46ecf6f6 = data.region
                    data.currency = regionToCurrency[data.region]
                }
                return {success:true, data: data }
            }
    
            catch(err) {
                return {success:false, message: err.message}
            }
    
    
        }
    }