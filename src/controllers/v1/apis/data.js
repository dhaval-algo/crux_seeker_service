const  express = require("express");
const dataService = require("../../../services/v1/data/data");

const router = express.Router()

router.get('/fetch-suggestion', dataService.fetchSuggestions)
router.get('/insert', dataService.insertDegree)
router.get('/places-autocomplete', dataService.placesAutoComplete)

module.exports = router