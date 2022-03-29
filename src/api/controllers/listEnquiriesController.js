'use strict';

const models = require("../../../models")
const { buildConfig, getEnquiry} = require("../../api/services/listEnquiriesService")

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

const getDetailedEnquiry = async (req, res)=>{
    try{
        let {id} = req.params
        id = parseInt(id)

        if(!isNaN(id)){
            const enquiry = await models.enquiry.findOne({ where:{id} })
            if(enquiry == null)
                throw {message:"No enquiry with provided id"}
            return res.status(200).send({success:true, enquiry})
        }
        else
            return res.status(500).send({error: true, message: "Invalid enquiry id"})

    }
    catch(err){
        console.log(err)
        return res.status(500).send({error: true, message: err.message})
    }
}
module.exports = {
    list,
    getDetailedEnquiry,
}
