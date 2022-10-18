const trendingListService = require("../services/trendingListService");
let TrendingListService = new trendingListService();
const {formatResponseField } = require("../utils/general");



module.exports = {

    getTrendingList: async (req, res) => {       
        let result = await TrendingListService.getTrendingList(req);
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result.data)
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send(result);

        }
            
    },
    getSingleTrendingList: async (req, res) => {
        let result = await TrendingListService.getSingleTrendingList(req);
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result.data)
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send(result);

        }
              
    },

    getTopLearningplatform: async (req, res) => {
        let result = await TrendingListService.getTopLearningplatform(req);
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result.data)
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send(result);

        }
              
    },
    
    getTrendingListCourses: async (req, res) => {
        TrendingListService.getTrendingListCourses (req, async (err, data) => {
            if (data) {              
               delete(data.data.synopsis)
                if (req.query['fields']) {
                    let finalData = formatResponseField(req.query['fields'], data.data)
                    res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
                } else {
                    res.status(200).send(data);
        
                }
        
            } else {
                res.status(200).send(err);
            }
        });              
    },
    
    getTrendingListSynopsis: async (req, res) => {        
 
         TrendingListService.getTrendingListCourses (req, async (err, data) => {
             if (data) {
                     let finalData = formatResponseField('synopsis', data.data)
                     res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
                
             } else {
                 res.status(200).send(err);
             }
         });   
               
     },

    getTrendingListNavigationDropdown: async (req, res) => {
        let result = await TrendingListService.getTrendingListNavigationDropdown(req);
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result.data)
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send(result);

        }
              
    },

    navigateToTrendingList: async (req, res) => {
        let result = await TrendingListService.navigateToTrendingList(req);
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result.data)
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send(result);

        }
              
    },
   


}