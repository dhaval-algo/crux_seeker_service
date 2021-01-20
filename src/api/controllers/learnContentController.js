const learnContentService = require("../services/learnContentService");
let LearnContentService = new learnContentService();
const paymentService = new (require("../services/PaymentService"));
const userService = require("../../services/v1/users/user");

module.exports = {

    getLearnContentList: async (req, res) => {
        LearnContentService.getLearnContentList(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getSingleLearnContent: async (req, res) => {
        const slug = req.params.slug;
        LearnContentService.getLearnContent(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getCategoryList: async (req, res) => {
        LearnContentService.getCategories((err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getCourseByIds: async (req, res) => {
        LearnContentService.getCourseByIds(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getCourseOptionByCategories: async (req, res) => {
        LearnContentService.getCourseOptionByCategories(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    buyCourse: async (req, res) => {
        try {
            let { courseSlug, address } = req.body;
            
            if(courseSlug) {
                res.status(200).send({
                    code: "params_missing",
                    message: "Course slug missing"
                });
            }

            /** Fetch the user details */
            let userObj = await userService.fetchUserMetaObjByUserId(req.user.userId);

            /** Fetch the course details based on the course slug */
            let course = await LearnContentService.fetchCourseBySlug(courseSlug);

            if(course) {
                /** Initiate the payment */
                /** Using the base price which is in USD */
                let paymentIntent = await paymentService.createPaymentIntent(course.basePrice, "USD");

                /** Create the order */
                // TODO

                return res.status(200).send({
                    code: "success",
                    message: "Payment initiated",
                    data: {
                        paymentIntent: paymentIntent
                    }
                });
            } else {
                return res.status(200).send({
                    code: "course_not_found",
                    message: "Course slug missing"
                });
            }
        } catch(err) {
            console.log("Exception in buy course api: ", err);
            return res.status(200).send({
                code: "error",
                message: "Error"
            });
        }
    }
};