const Sequelize = require('sequelize');
const Op = Sequelize.Op;
let csvToJson = require('convert-csv-to-json');
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
    let json = csvToJson.getJsonFromCsv(`${global.appRoot}/data_files/default_select_options.csv`);
    for(let i=0; i<json.length;i++){
        await models.default_select_options.create(json[i])
    }
    res.status(200).json(json)
}

module.exports = { fetchSuggestions, insertDegree }