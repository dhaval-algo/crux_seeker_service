const { FORM_TYPES, DEFAULT_CODES } = require("../../../utils/defaultCode");
const { handleEnquirySubmission, fetchFormValues } = require("./enquirySubmission");

const fetchFormvalue = (req, res) => {
    res.status(200).json({})
}

const submitForm = async (req,res) => {
    const {user ={}} = req;
    const { formType, formTypeSource} = req.body;
    if(!formType || !formTypeSource) {
        res.status(500).json({success:false, code:DEFAULT_CODES.FAILED_ENQUIRY.code,message:DEFAULT_CODES.FAILED_ENQUIRY.message})
    }
    req.body.user = user
    console.log(formType);
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
           return res.status(500).json({...sendSystemError})
        break;
    }
}

const getFormValues = async (req,res) => {
    const { user } = req
    if(!user) {
        return res.status(200).send({
            success:false,
            code:DEFAULT_CODES.INVALID_TOKEN.code,
            data:{
                
            }
        })
    } else {
        req.body.user = user
        let fields =  await fetchFormValues(req.body);
       return res.status(200).send(fields)
    }
}

const sendSystemError = {
    code:DEFAULT_CODES.SYSTEM_ERROR.code,
    message:DEFAULT_CODES.SYSTEM_ERROR.message,
    success:false
}

module.exports = {
    fetchFormvalue,
    submitForm,
    getFormValues
}
