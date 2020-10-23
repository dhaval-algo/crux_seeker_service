const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const csv =require("csvtojson/v2");
const models = require("../../../../models");

const fetchSuggestions = async (req,res) => {
    const {searchType, searchQuery } = req.query
    console.log( searchQuery,searchType);
    try {
        
        if(searchQuery) {
            const dataRecs = await models.default_select_options.findAll({ 
                where: {
                    label:{[Op.iLike]:`%${searchQuery}%`},
                    optionType:searchType
                }
            })
            return res.status(200).send({success:true,options:dataRecs})
        } else {
             throw "Search query is empty"
        }
    } catch (error) {
        console.log(error);
        return res.status(200).send({success:true,options:[]})
    }

}

const insertDegree = async (req, res) => {

    const jsonArray=await csv().fromFile(`${global.appRoot}/data_files/default_select_options.csv`);
    for(let i=0; i<jsonArray.length;i++){
        console.log(jsonArray[i]);
        await models.default_select_options.create(json[i])
    }
    res.status(200).json(jsonArray)
}

module.exports = { fetchSuggestions, insertDegree }