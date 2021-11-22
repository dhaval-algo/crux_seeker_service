const Joi = require('joi')

function validatePaginationParams(data) {

    const schema = Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).default(10),
    })

    const result = schema.validate(data)
    if (result.error) return { page: 1, limit: 10 }

    return result.value

}


module.exports = {

validatePaginationParams

}