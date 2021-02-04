const fetch = require("node-fetch");
const _ = require('underscore');
const apiBackendUrl = process.env.API_BACKEND_URL;


const getUserCurrency = async(request) => {
    let currency = request.query.currency;
    if(!currency){
        currency = process.env.DEFAULT_CURRENCY;
    }
    return currency;
  }

  const getCurrencies = async () => {
    let response = await fetch(`${process.env.API_BACKEND_URL}/currencies`);
    if (response.ok) {
        let json = await response.json();
        if(json && json.length){
            return json;
        }else{
            return [];
        }    
    } else {
        return [];
    }
};

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



const getFilterConfigs = async (entity_type) => {
    let response = await fetch(`${apiBackendUrl}/entity-facet-configs?entity_type=${entity_type}&filterable_eq=true&_sort=order:ASC`);
    if (response.ok) {
    let json = await response.json();
    return json;
    } else {
        return [];
    }
};

const getRankingBySlug = async (slug) => {
    let response = await fetch(`${apiBackendUrl}/rankings?slug_eq=${slug}`);
    if (response.ok) {
    let rankings = await response.json();
    if(rankings.length > 0){
        return rankings[0];
    }else{
        return null;
    }
    } else {
        return null;
    }
};

const getRankingFilter = async () => {
    let response = await fetch(`${apiBackendUrl}/rankings?visible_eq=true&custom_eq=false&_sort=name:ASC`);
    if (response.ok) {
    let rankings = await response.json();
    let rankingFilter = {
        label: 'Ranking',
        filterable: true,
        is_collapsed: true,
        filter_type: 'Checkboxes',
        options: []
    };

    rankings = rankings.sort(function(a,b) {
        let ac = a.name.toLowerCase();
        let bc = b.name.toLowerCase();
        if (ac == bc) return 0;
        if (ac > bc) return 1;
        return -1;
    });


    for(const rank of rankings){
        rankingFilter.options.push({
            label: rank.name,
            slug: rank.slug,
            count: 0,
            selected: false,
            disabled: false
        });
    }
    return rankingFilter;
    } else {
        return [];
    }
};

const parseQueryFilters = (filter) => {
    const parsedFilterString = decodeURIComponent(filter);
    let query_filters = [];
    const filterArray = parsedFilterString.split("::");
    for(const qf of filterArray){
        const qfilters = qf.split(":");
        query_filters.push({
            key: qfilters[0],
            value: qfilters[1].split(",")
        });
    }
    return query_filters;
};


const round = (value, step) => {
    step || (step = 1.0);
    var inv = 1.0 / step;
    return Math.round(value * inv) / inv;
};

const getPaginationQuery = (query) => {
    let page = 1;
    let size = 25;
    let from = 0;
    if(query['page']){
      page = parseInt(query['page']);
    }
    if(query['size']){
      size = parseInt(query['size']);
    }      
    if(page > 1){
      from = (page-1)*size;
    }
    return {
      from,
      size,
      page
    };
};

const getMediaurl = (mediaUrl) => {
    if(mediaUrl !== null && mediaUrl !== undefined){
        const isRelative = !mediaUrl.match(/(\:|\/\\*\/)/);
        if(isRelative){
            mediaUrl = process.env.ASSET_URL+mediaUrl;
        }
    }    
    return mediaUrl;
};

const updateFilterCount = (filters, parsedFilters, filterConfigs, data, allowZeroCountFields = []) => {
    if(parsedFilters.length <= 0){
        return filters;
    }
    for(let filter of filters){
        if(filter.filter_type !== 'Checkboxes'){
            continue;
        }
        let parsedFilter = parsedFilters.find(o => o.key === filter.label);
        //if(!parsedFilter){
            for(let option of filter.options){
                option.count = 0;
                let elasticAttribute = filterConfigs.find(o => o.label === filter.label);
                    if(!elasticAttribute){
                        continue;
                    }
                for(const esData of data){
                    
                    const entity = esData._source; 
                    let entityData = entity[elasticAttribute.elastic_attribute_name];
                    if(entityData){
                        if(Array.isArray(entityData)){
                            if(entityData.includes(option.label)){
                                option.count++;
                            }
                        }else{
                            if(entityData == option.label){
                                option.count++;
                            }
                        }
                    }
                }
                if(option.count == 0 && !(allowZeroCountFields.includes(filter.field))){
                    option.disabled = true;
                }
            }
        //}

        filter.options = filter.options.filter(function( obj ) {
            return !obj.disabled;
          });
    }
    return filters;
};


const getFilterAttributeName = (attribute_name, filterFields) => {
    if(filterFields.includes(attribute_name)){
        return `${attribute_name}.keyword`;
    }else{
        return attribute_name;
    }
};

const updateSelectedFilters = (filters, parsedFilters, parsedRangeFilters) => {
    for(let filter of filters){
        if(filter.filter_type == "Checkboxes"){
            let seleteddFilter = parsedFilters.find(o => o.key === filter.label);
            if(seleteddFilter && filter.options){
                for(let option of filter.options){
                    if(seleteddFilter.value.includes(option.label)){
                        option.selected = true;
                    }
                }
            }
            //Sorting options
            filter.options = sortFilterOptions(filter.options);
        }
        if(filter.filter_type == "RangeOptions"){
            let seleteddFilter = parsedRangeFilters.find(o => o.key === filter.label);
            if(seleteddFilter && filter.options){
                for(let option of filter.options){
                    if((option.start ==  seleteddFilter.start) && (option.end ==  seleteddFilter.end)){
                        option.selected = true;
                    }
                }
            }
        }
        if(filter.filter_type == "RangeSlider"){
            let seleteddFilter = parsedRangeFilters.find(o => o.key === filter.label);
            if(seleteddFilter){
                filter.min = seleteddFilter.start;
                filter.max = seleteddFilter.end;
            }
        }
    }
    return filters;
};



const sortFilterOptions = (options) => {
    if(options.length){
        options = _.sortBy( options, 'count' ).reverse();
    }
    return options;
};



  module.exports = {
    getUserCurrency,
    getCurrencies,
    getCurrencyAmount,
    getFilterConfigs,
    parseQueryFilters,
    round,
    getPaginationQuery,
    getMediaurl,
    updateFilterCount,
    getFilterAttributeName,
    updateSelectedFilters,
    getRankingFilter,
    getRankingBySlug,
    sortFilterOptions
}



