const searchService = require("../services/searchService");
const userService = require("../../services/v1/users/user");
let SearchService = new searchService();

module.exports = {

    getSearchResult: async (req, res) => {
        SearchService.getSearchResult(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    
    userLastSearch: async (req, res) => {

        await userService.saveUserLastSearch(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getUserLastSearch: async (req, res) => {

        await userService.getUserLastSearch(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    removeUserLastSearch: async (req, res) => {

        await userService.removeUserLastSearch(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

};