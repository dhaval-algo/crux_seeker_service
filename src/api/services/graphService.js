const fetch = require("node-fetch");
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();
const apiBackendUrl = process.env.API_BACKEND_URL;
const elasticService = require("./elasticService");

const getCurrencies = async (useCache = true) => {

    let cacheKey = "get-currencies-backend";
    if(useCache){
        let cachedData = await RedisConnection.getValuesSync(cacheKey);
        if(cachedData.noCacheData != true) {
           return cachedData;
        }
    }

    let response = await fetch(`${process.env.API_BACKEND_URL}/currencies`);
    if (response.ok) {
        let json = await response.json();
        if(json && json.length){
            await RedisConnection.set(cacheKey, json);
            return json;
        }else{
            return [];
        }    
    } else {
        return [];
    }
};

const roundOff = (number, precision) => {
    return Math.round((number + Number.EPSILON) * Math.pow(10, precision)) / Math.pow(10, precision);
}

const getCurrencyAmount = (amount, currencies, baseCurrency, userCurrency) => {   
    if(amount == 0){
        return 0;
    }
    if(!amount){
        return null;
    }
    if(!userCurrency){
        userCurrency = process.env.DEFAULT_CURRENCY;
    }
    if(baseCurrency == userCurrency){
        return Math.round(amount);
    }
    let currency_b = currencies.find(o => o.iso_code === baseCurrency);
    if(!currency_b){
        currency_b = currencies.find(o => o.iso_code === process.env.DEFAULT_CURRENCY);
    }
    let currency_u = currencies.find(o => o.iso_code === userCurrency);
    if(baseCurrency == 'USD'){
        amount = currency_u.conversion_rate*amount;
    }else if(userCurrency == 'USD'){
        amount = amount/currency_b.conversion_rate;
    }else {
        const baseAmount = currency_u.conversion_rate*amount;
        amount = baseAmount/currency_b.conversion_rate;
    } 
    
    return Math.round(amount);
};

module.exports = class graphService {

    async getGraph(req) {
        const id = req.params.id;
        let currency = req.query['currency'];        
        let currencies = await getCurrencies();        
        let cacheName = `graph_${id}`;
        try {
            
       
        let cacheData = await RedisConnection.getValuesSync(cacheName);
        if (!cacheData.noCacheData) {
            return { success: true, message: 'Fetched successfully!', data: cacheData };
        }
        else {
            const query = {
                "bool": {
                    "filter": [
                        { "term": { "id": id } }
                    ]
                }
            };
            let result = await elasticService.search('graph', query);
            if (result.hits && result.hits.length) {
                let data = result.hits[0]._source                
                data.graph_details = data.graph_details.map(detail => {
                    let finalData = {}
                    finalData.tab = detail.tab
                    switch (data.graph_type) {
                        case "PIE_CHART":                           
                            finalData.graph_values = []
                            for (let value of detail.graph_values) {
                                finalData.graph_values.push(
                                    {
                                        label: value.pie_chart_label,
                                        value:(!data.region && data.currency) ? getCurrencyAmount(value.pie_chart_value, currencies, data.currency, currency) : value.pie_chart_value
                                    }
                                )
                            }                          

                            break;
                        case "DONUT_CHART":
                            finalData.graph_values = []
                            for (let value of detail.graph_values) {
                                finalData.graph_values.push(
                                    {
                                        label: value.donut_chart_label,
                                        value:(!data.region && data.currency) ? getCurrencyAmount(value.donut_chart_value, currencies, data.currency, currency) : value.donut_chart_value
                                    }
                                )
                            }
                            break;
                        case "BAR_GRAPH":                            
                            finalData.x_axis_label = detail.bar_graph_x_axis_label
                            finalData.y_axis_label = detail.bar_graph_y_axis_label
                            finalData.graph_values = []
                            for (let value of detail.graph_values) {
                                finalData.graph_values.push(
                                    {
                                        x_axis: value.bar_graph_x_axis_value,
                                        y_axix:(!data.region && data.currency) ? getCurrencyAmount(value.bar_graph_y_axis_value, currencies, data.currency, currency) : value.bar_graph_y_axis_value
                                    }
                                )
                            }

                            break;

                        case "LINE_GRAPH":
                            finalData.x_axis_label = detail.line_graph_x_axis_label
                            finalData.y_axis_label = detail.line_graph_y_axis_label
                            finalData.graph_values = []
                            for (let value of detail.graph_values) {
                                finalData.graph_values.push(
                                    {
                                        y_axis: value.line_graph_x_axis_value,
                                        x_axix:(!data.region && data.currency) ? getCurrencyAmount(value.line_graph_y_axis_value, currencies, data.currency, currency) : value.line_graph_y_axis_value
                                    }
                                )
                            }

                            break;


                        default:
                            break;
                    }

                    finalData.extra_info = detail.extra_info
                    return finalData
                })
                data.userCurrency = currency
                delete data.currency
                await RedisConnection.set(cacheName, data, process.env.CACHE_EXPIRE_GRAPH || 360) 
                return { success: true, message: 'Fetched successfully!', data: data };               
            }            
        }
    } catch (error) {
        console.log("error fetching graph",error )
        return { success: false, data: null }; 
    }
    }

    async getDataTable(req) {
        const id = req.params.id;
        let cacheName = `data_table_${id}`;
        let cacheData = await RedisConnection.getValuesSync(cacheName);
        if (!cacheData.noCacheData) {
            return { success: true, message: 'Fetched successfully!', data: cacheData };
        }
        else {
            let response = await fetch(`${apiBackendUrl}/data-tables/${id}`);
            if (response.ok) {
                let data = await response.json();
                if (data) {
                    delete data.id
                    delete data.created_by
                    delete data.updated_by
                    delete data.created_at
                    delete data.updated_at
                    RedisConnection.set(cacheName, data);
                    return { success: true, message: 'Fetched successfully!', data: data };

                }
            }
        }

    }
}