const Sequelize = require('sequelize');
const Op = Sequelize.Op;

const models = require("../../../../models");

const fetchSuggestions = async (req,res) => {
    const { searchQuery,searchType="" } = req.query
    try {
        
        if(searchQuery) {
            const dataRecs = await models.default_select_options.findAll({ 
                where: {
                    label:{[Op.iLike]:searchQuery},
                    optionType:searchType
                }
            })
            return res.status(200).send({data:searchType})
        } else {
             throw "Search query is empty"
        }
    } catch (error) {
        console.log(error);
        return res.status(200).send({data:[]})
    }

}

module.exports = { fetchSuggestions }