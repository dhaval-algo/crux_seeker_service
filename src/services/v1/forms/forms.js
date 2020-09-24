const { FORM_TYPES, DEFAULT_CODES } = require("../../../utils/defaultCode");
const { handleEnquirySubmission } = require("./enquirySubmission");

const fetchFormvalue = (req, res) => {
    res.status(200).json({})
}

const submitForm = async (req,res) => {
    const {user ={}} = req;
    const { formType, formTypeSource} = req.body;
    req.body.user = user
    console.log(req.body.user);
    switch (formType) {
        case FORM_TYPES.ENQUIRIES:
            let enquiryResponse = await handleEnquirySubmission(req.body,req)
            if(!enquiryResponse.success){ 
               return res.status(200).json(sendSystemError)
            }
         
            console.log(enquiryResponse);
            return res.status(200).json(enquiryResponse)
        break;

       
        default:
           res.status(500).json({...sendSystemError})
        break;
    }
}

const sendSystemError = {
    code:DEFAULT_CODES.SYSTEM_ERROR.code,
    message:DEFAULT_CODES.SYSTEM_ERROR.message,
    success:false
}

module.exports = {
    fetchFormvalue,
    submitForm
}
