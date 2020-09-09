
const login = async (req, res, next) => {
    try {
        return res.status(200).json({
            'message': 'Successful login',
            'data': {}
        });

    } catch (error) {
        return res.status(500).json({
            'code': 'SERVER_ERROR',
            'description': 'something went wrong, Please try again'
        });
    }
}

const sendOtp = async (req, res, next) => {
    try {
        return res.status(200).json({
            'message': 'Successful login',
            'data': {}
        });

    } catch (error) {
        return res.status(500).json({
            'code': 'SERVER_ERROR',
            'description': 'something went wrong, Please try again'
        });
    }
}


const verifyOtp = async (req, res, next) => {
    try {
        return res.status(200).json({
            'message': 'Successful login',
            'data': {}
        });

    } catch (error) {
        return res.status(500).json({
            'code': 'SERVER_ERROR',
            'description': 'something went wrong, Please try again'
        });
    }
}




module.exports = {
    login,
    verifyOtp,
    sendOtp
}