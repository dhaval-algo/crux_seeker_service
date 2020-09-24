const  express = require("express");
const forms = require("../../../services/v1/forms/forms");
const injectTokenPayload = require("../../../services/v1/middleware/injectTokenPayload");

const router = express.Router()

router.post('/get-form-values',injectTokenPayload, forms.getFormValues)
router.post('/submit-forms', injectTokenPayload, forms.submitForm)

module.exports = router