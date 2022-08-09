const geoIpService = require("../services/geoIpService")

module.exports = {
    getIpDetails: async (req,res) => {
        let ipDetails = await geoIpService.getIpDetails(req.ip)       
        return res.status(200).send(ipDetails)
       
    }
}