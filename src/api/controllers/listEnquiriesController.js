'use strict';

const models = require("../../../models")
const { buildConfig } = require("../../api/services/listEnquiriesService")

const list = async (req, res) =>{
    try{
        let config = buildConfig(req)
        if(config.err)
            throw config.err
        const {count , rows } = await models.enquiry.findAndCountAll(config)
        res.status(200).send({success: true, data: rows, count})      
    }

    catch(err){
        console.log(err)
        return res.status(500).send({error: true, message: err.message})
    }
}

module.exports = {
    list,
}
