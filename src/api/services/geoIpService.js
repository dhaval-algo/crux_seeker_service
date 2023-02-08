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

const europeCountry = ["AT","BE","CY","EE","FI","FR","DE","GR","IE","IT","LV","LT","LU","MT","NL","PT","SK","SI","ES" ]
const countryToCurrency = {
    "AU": "AUD",
    "IN": "INR",
    "CA": "CAD",
    "HK": "HKD",
    "SG": "SGD",
    "UK": "GBP",
    "GB": "GBP",
    "USA": "USD",
    "AE": "AED",
    "AT": "EUR",
    "BE": "EUR",
    "CY": "EUR",
    "EE": "EUR",
    "FI": "EUR",
    "FR": "EUR",
    "DE": "EUR",
    "GR": "EUR",
    "IE": "EUR",
    "IT": "EUR",
    "LV": "EUR",
    "LT": "EUR",
    "LU": "EUR",
    "MT": "EUR",
    "NL": "EUR",
    "PT": "EUR",
    "SK": "EUR",
    "SI": "EUR",
    "ES": "EUR"
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
                        data.country_code = "UK"
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
                    data.currency = (countryToCurrency[data.country_code])? countryToCurrency[data.country_code] : 'USD'
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
                    let response = await fetch(`${apiBackendUrl}/countries?_sort=order&_limit=-1`);
                    let data
                    if (response.ok) {
                        data = await response.json();
                        let finalData = {
                            top_countries: [],
                            other_counties: []
                        }
                        data = data.map(function (el) {
                            let region ="USA"
                            if(el["code"] =="IN")
                            {
                                region ="India"
                            }
                            else if(el["code"] =="UK" || el["code"] =="GB" )
                            {
                                region ="UK"
                            }
                            else if(el["code"] =="USA")
                            {
                                region ="USA"
                            }
                            else if(europeCountry.includes[el["code"]])
                            {
                                 region ="Europe"
                            }
                            if(el["top_country"])
                            {
                                finalData.top_countries.push({
                                    'name': el["name"],
                                    'code': el["code"],
                                    'currency':(countryToCurrency[ el["code"]])? countryToCurrency[ el["code"]] : 'USD',
                                    'region' :  region
                                })
                            }
                            else
                            {
                                finalData.other_counties.push({
                                    'name': el["name"],
                                    'code': el["code"],
                                    'currency':(countryToCurrency[ el["code"]])? countryToCurrency[ el["code"]] : 'USD',
                                    'region' :  region
                                })
                            }
                            
                            
                            return finalData
                        })
                        if (finalData) {
                            RedisConnection.set(cacheName, finalData);
                        }
                    }
                }
            } catch (err) {
                console.log("err", err)
                return []
            }
        }
    }