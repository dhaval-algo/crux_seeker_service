const geoIpService = require("../services/geoIpService")

module.exports = {
    getIpDetails: async (req,res) => {
        if(request.params.ip)
        {
            ip = request.params.ip
        }
        let ipDetails = await geoIpService.getIpDetails(req.ip)       
        return res.status(200).send(ipDetails)
       
    },
    getCountries: async (req, res) => {
        let result = await geoIpService.getCountries();
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result)
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: result });

        }
    }
}