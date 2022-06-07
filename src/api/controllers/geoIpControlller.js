const geoIpService = require("../services/geoIpService")

module.exports = {
    getIpDetails: async (req,res) => {
        let ipDetails = await geoIpService.getIpDetails(req.ip)
        if(!ipDetails.error)
            return res.status(200).send(ipDetails.data)
        else
            return res.status(500).send(ipDetails)
    }
}