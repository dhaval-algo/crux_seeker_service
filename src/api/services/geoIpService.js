const models = require("../../../models");
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();
const fetch = require("node-fetch");
const apiBackendUrl = process.env.API_BACKEND_URL;
const regionToCurrency = {
    "India" : "INR",
    "Europe": "EUR",
    "UK" : "GBP",
    "USA" : "USD"
}
    module.exports = {
        getIpDetails: async(ip) => {

            try {
                //differntiating ipv4 and ipv6 address
                if (ip.substr(0, 7) == "::ffff:") {
                    ip = ip.substr(7)
                }
                let details = await models.sequelize.query(`select latitude, longitude, accuracy_radius, continent_name, country_name,country_iso_code as country_code, subdivision_1_name, city_name
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
    
    
        },
        getCountries: async (skipCache) => {
            try {
                let cacheName = `countries`
                let useCache = false
                if (skipCache != true) {
                    let cacheData = await RedisConnection.getValuesSync(cacheName);
                    if (cacheData.noCacheData != true) {
                        return cacheData
                    }
                    else {
                        return []
                    }
                }
                if (useCache != true) {
                    let response = await fetch(`${apiBackendUrl}/countries?_limit=-1`);
                    let data
                    if (response.ok) {
                        data = await response.json();
                        data = data.map(function (el) {
                            return {
                                'name': el["name"],
                                'code': el["code"],
                                'currency':'USD'
                            }
                        })
                        if (data) {
                            RedisConnection.set(cacheName, data);
                        }
                    }
                }
            } catch (err) {
                console.log("err", err)
                return []
            }
        }
    }