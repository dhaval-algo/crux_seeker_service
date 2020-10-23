const  express = require("express");
const dataService = require("../../../services/v1/data/data");

const router = express.Router()

router.get('/fetch-suggestion', dataService.fetchSuggestions)

module.exports = router