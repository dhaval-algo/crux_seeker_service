const learnContentService = require("../services/learnContentService");
let LearnContentService = new learnContentService();
const paymentService = new (require("../services/PaymentService"));
const userService = require("../../services/v1/users/user");
const axios = require("axios");
const  helperService = require("../../utils/helper");
const {formatResponseField } = require("../utils/general");

module.exports = {

    getLearnContentList: async (req, res) => {
        LearnContentService.getLearnContentList(req, async(err, data) => {
            if (data) {
                let finalData = {}
                if(req.query['fields']){
                    
                    fields = req.query['fields'].split(",");
                    if(fields.includes("learn_types") || fields.includes("topics"))
                    {
                        for (let filter of data.data.filters)
                        {
                            if(fields.includes("learn_types")  && filter.field =="learn_type")
                            {
                                data.data["learn_types"] = filter.options.map(item => {return {label:item.label, image:item.image, count:item.count}})
                            }

                            if(fields.includes("topics") && filter.field =="topics")
                            {
                                data.data["topics"] = []
                                let i= 0
                                for(let option of filter.options){
                                    if(i < 20)
                                    {
                                        let slug = await helperService.getTreeUrl('topic', option.label, true)
                                        data.data["topics"].push({
                                            label:option.label,
                                            slug : slug
                                        })
                                    }

                                    i++
                                }                               
                            }
                        }
                    
                    }
                    else if(fields.includes("search_filters"))
                    {
                        data.data["search_filters"] = {}
                        for (let filter of data.data.filters)
                        {
                            if(filter.field =="learn_type")
                            {
                                data.data["search_filters"]["learn_type"] = filter.options.map(item => {return {label:item.label}})
                            }
                            if(filter.field =="topics")
                            {
                                data.data["search_filters"]["topics"] = filter.options.map(item => {return {label:item.label}})
                            }                            
                            if(filter.field =="sub_categories")
                            {
                                data.data["search_filters"]["sub_categories"] = filter.options.map(item => {return {label:item.label}})
                            }
                            if(filter.field =="categories")
                            {
                                data.data["search_filters"]["categories"] = filter.options.map(item => {return {label:item.label}})
                            }                           
                        }
                       
                    }
                    finalData =  formatResponseField(req.query['fields'], data.data )
                    res.status(200).send({success: true, message: 'Fetched successfully!', data: finalData});
                }
                else
                {
                    res.status(200).send(data);
                }

            } else {
                res.status(200).send(err);
            }
        });        
    },

    getLearnContentListing: async (req, res) => {
        LearnContentService.getLearnContentListing(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getLearnContentFilters: async (req, res) => {
        LearnContentService.getLearnContentFilters(req, (err, data) => {
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
                let finalData = {}
                if(data.data && data.data.status=='unpublished')
                {
                    //res.status(302).send({success: false, message: 'unpublished', data: data.data});
                    res.status(200).send( { success: false, message: 'Not found!' })
                }
                else if(req.query['fields']){                    
                    finalData =  formatResponseField(req.query['fields'], data.data )                    
                    res.status(200).send({success: true, message: 'Fetched successfully!', data: finalData});
                }
                else
                {
                    res.status(200).send(data);
                }

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


    getRecommendedCourses: async (req, res) => {
        const { type } = req.query;

        switch (type) {
            case "related-courses": LearnContentService.getRelatedCourses(req, (err, data) => {
                if (data) {
                    res.status(200).send(data);
                } else {
                    res.status(200).send(err);
                }
            });
                break;
            case "courses-to-get-started": LearnContentService.getPopularCourses(req, (err, data) => {
                if (data) {
                    if (process.env.API_CACHE_CONTROL_HEADER) {
                        res.set('Cache-control', process.env.API_CACHE_CONTROL_HEADER)
                    }
                    res.status(200).send(data);
                } else {
                    res.status(200).send(err);
                }
            });
                break;
            case "explore-courses-from-top-categories": LearnContentService.exploreCoursesFromTopCatgeories(req, (err, data) => {
                if (data) {
                    res.status(200).send(data);
                } else {
                    res.status(200).send(err);
                }
            });

                break;

            case "top-picks-for-you": LearnContentService.getTopPicksForYou(req, (err, data) => {
                if (data) {
                    res.status(200).send(data);
                } else {
                    res.status(200).send(err);
                }
            });
                break;

            case "recently-viewed-courses": userService.recentlyViewedCourses(req,(err, data) => {
                if (data) {
                    res.status(200).send(data);
                } else {
                    res.status(200).send(err);
                }
            });
                
                break;
           
            case "recently-searched-courses": userService.recentlySearchedCourses(req,(err, data) => {
                if (data) {
                    res.status(200).send(data);
                } else {
                    res.status(200).send(err);
                }
            });
                break;

            case "people-are-also-viewing": userService.peopleAreAlsoViewing(req,(err, data) => {
                if (data) {
                    res.status(200).send(data);
                } else {
                    res.status(200).send(err);
                }
            });
                break;


            default:
                res.status(200).send({});
                break;
        }
    },

    getTopCategories : async(req,res)=>{

        LearnContentService.getTopCategories(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });
    },

    getPopularCourses: async (req, res)=>{
        LearnContentService.getPopularCourses(req,(err, data)=>{
            if (data) {
                if(process.env.API_CACHE_CONTROL_HEADER)
                {
                    res.set('Cache-control', process.env.API_CACHE_CONTROL_HEADER)
                }
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });
    },

    getReviews: async (req, res) => {
        LearnContentService.getReviews(req, (err, data) => {
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
            let { courseSlug, timezone } = req.body;
            
            if(!courseSlug) {
                return res.status(200).send({
                    code: "params_missing",
                    success: false,
                    message: "Course slug missing"
                });
            }

            /** Fetch the user details */
            let tmpuserObj = await userService.fetchUserMetaObjByUserId(req.user.userId);
            let userObj = { ...tmpuserObj };
            
            /** Fetch the course details based on the course slug */
            let course = await LearnContentService.fetchCourseBySlug(courseSlug);

            if(course) {
                /** Initiate the payment */
                /** Using the base price which is in USD */
                let coursePrice = helperService.roundOff(course.finalPrice, 2);
                let currency = course.learn_content_pricing_currency?course.learn_content_pricing_currency.iso_code:null;
                let tax = 0.0;
                if(course.learn_content_pricing_currency&&course.learn_content_pricing_currency.iso_code === "INR") {
                    tax = helperService.roundOff(0.18 * coursePrice, 2);
                } else {
                    /** Reject buy request for non INR courses */
                    return res.status(200).send({
                        code: "non_inr_course",
                        success: false,
                        message: "Cannot buy non INR course."
                    });
                }
                let paymentIntentSecret = await paymentService.createPaymentIntent(coursePrice + tax, currency, course.title, userObj);

                /** Create the order data */
                let orderData = await LearnContentService.createOrderData(req.user.userId, userObj, req.body.address, course, "course", coursePrice, tax, currency,
                    "stripe", paymentIntentSecret, timezone);

                /** Add the data to Strapi */
                await axios.post(process.env.API_BACKEND_URL + "/orders", orderData);
                const activity_log =  await helperService.logActvity("COURSE_PURCHASED", req.user.userId, "LRN_CNT_PUB_"+course.id);
                return res.status(200).send({
                    code: "success",
                    success: true,
                    message: "Payment initiated",
                    data: {
                        paymentIntent: paymentIntentSecret,
                        orderId: orderData.order_id
                    }
                });
            } else {
                return res.status(200).send({
                    code: "course_not_found",
                    success: false,
                    message: "Course not found"
                });
            }
        } catch(err) {
            console.log("Exception in buy course api: ", err);
            return res.status(200).send({
                code: "error",
                success: false,
                message: "Error"
            });
        }
    },
    addActivity: async (req, res) => {
        LearnContentService.addActivity(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getLearnContentLearntypes: async(req, res) => {
        let result = await LearnContentService.getLearnContentLearntypes(req);
        res.status(200).send(result);
    },
    
    getLearnContentTopics: async(req, res) => {
        let result = await LearnContentService.getLearnContentTopics(req);
        res.status(200).send(result);
    },
    getCourseLandingPage: async (req, res) => {
        let result = await LearnContentService.getCourseLandingPage(req);
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result.data)
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send(result);
        }
    },

    geCourseLandingPageTopCategories: async (req, res) => {
        let result = await LearnContentService.geCourseLandingPageTopCategories(req);
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result.data)
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send(result);

        }
    },

    getPopularCategories: async (req, res) => {
        let result = await LearnContentService.getPopularCategories(req);
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result.data)
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send(result);

        }
    },
    
};