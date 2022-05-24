const { saveSessionKPIs, getSessionKPIs, getAllTimeSessionKPIs, getRecentSessionKPIs } = require("../../utils/sessionActivity")


module.exports = {


    saveSessionKPIController: async (req, res) => {

        const userId = (req.user && req.user.userId) ? req.user.userId : req.segmentId;
        await saveSessionKPIs(userId, req.body);
        const response = [await getAllTimeSessionKPIs(userId), await getRecentSessionKPIs(userId)];

        res.send(response);




    }




}