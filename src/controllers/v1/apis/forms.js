const  express = require("express");
const forms = require("../../../services/v1/forms/forms");

const router = express.Router()

router.post('/get-form-values', forms.fetchFormvalue)

module.exports = router