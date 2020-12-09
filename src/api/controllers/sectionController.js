const sectionService = require('../services/sectionService');
const SectionService = new sectionService()
module.exports = {
    getCategoryTree: async(req, res) => {
        SectionService.getCategoryTree(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });    
    }
}