const  express = require("express");
const dataService = require("../../../services/v1/data/data");

const router = express.Router()

router.get('/fetch-suggestion', dataService.fetchSuggestions)
router.get('/fetch-suggest-goals', dataService.fetchSuggestGoals)
router.get('/insert/:slug', dataService.insertDefaultOption)
router.get('/places-autocomplete', dataService.placesAutoComplete)

module.exports = router