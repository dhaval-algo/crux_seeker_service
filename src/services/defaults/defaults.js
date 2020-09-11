const env = process.env.NODE_ENV || 'development';
const config_file = require('../../../config/appDefaults.json');
const config = (config_file[env] != undefined) ? config_file[env] : config_file['development'];

module.exports = {
    getValue: (key) => {
        return config[key];
    }
}