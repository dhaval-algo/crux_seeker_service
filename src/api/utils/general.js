const fetch = require("node-fetch");


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


  module.exports = {
    getUserCurrency,
    getCurrencies,
    getCurrencyAmount
}



