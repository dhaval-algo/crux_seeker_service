const  express = require("express");
const forms = require("../../../services/v1/forms/forms");
const injectTokenPayload = require("../../../services/v1/middleware/injectTokenPayload");
const rateLimiter = require('../../../services/v1/middleware/rateLimiter')

const router = express.Router()

router.post('/get-form-values',injectTokenPayload, forms.getFormValues)
router.post('/submit-forms', rateLimiter, injectTokenPayload, forms.submitForm)
router.post('/default-values', forms.getDefaultValues)

module.exports = router