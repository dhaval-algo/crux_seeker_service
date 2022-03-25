'use strict';

const models = require("../../../models")
const {buildConfig, queryUser} = require("../../api/services/listUsersService")

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

const getDetailedUser = async (req, res)=>{
    try{
        let {id} = req.params
        id = parseInt(id)

        if(!isNaN(id)){
            queryUser(id)
            .then(response =>  { return res.status(200).send(response)})
            .catch(error => { return res.status(500).send(error)})
        }
        else
            return res.status(500).send({error: true, message: "Invalid user id"})

    }
    catch(err){
        console.log(err)
        return res.status(500).send({error: true, message: err.message})
    }
}
module.exports = {
    list,
    getDetailedUser,
}

