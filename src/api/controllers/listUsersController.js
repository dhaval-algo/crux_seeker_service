'use strict';

const models = require("../../../models")
const {buildConfig} = require("../../api/services/listUsersService")

const list = async (req, res) => {
    
    try{
        let config = buildConfig(req)
        const {count , rows } = await models.user.findAndCountAll(config)
        res.status(200).send({success: true, data: rows, count})      
    }

    catch(err){
        console.log(err)
        return res.status(500).send({error: true, message: err.message})
    }
}

module.exports = {
    list
}

