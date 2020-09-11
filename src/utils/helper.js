
const Cryptr = require('cryptr');
crypt = new Cryptr(process.env.CRYPT_SALT);
 const encryptStr = (str) => {
    return crypt.encrypt(str);
};

const decryptStr = (str) => {
    return crypt.decrypt(str);
};

const isEmail = (email) => {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

const getOtp =  (n) => {
    var add = 1, max = 12 - add;
    max = Math.pow(10, n+add);
    var min = max/10;
    var number = Math.floor( Math.random() * (max - min + 1) ) + min;
    return ("" + number).substring(add);
}
module.exports = {
    encryptStr,
    decryptStr,
    isEmail,
    getOtp
}