const elasticService = require("../../../api/services/elasticService");
const learnContentService = require("../../../api/services/learnContentService");
let LearnContentService = new learnContentService();
const learnPathService = require("../../../api/services/learnPathService");
let LearnPathService = new learnPathService();
const axios = require("axios");


const { sortFilterOptions ,parseQueryFilters} = require("../../../api/utils/general");
const { encryptUserId } = require("../../../utils/helper");



const oderDetails = async (req, res, next) => {
    try {
        let errorResponse = {
            'success': false,
            'message': 'something went wrong, Please try again',
            'data': {}
        }
        let order_id = req.query.orderId      
        let user_id = await encryptUserId(req.user.userId)

        let request_url = `${process.env.ECOM_API_URL}/ecommerce/user/order_details/user/${order_id}?user_id=${user_id}`
        let finalData = {}
        axios.get(request_url).then(async (response) => {

            if (response.data.status == 'OK' && response.data.data) {
                finalData.orderData = response.data.data[0]
                switch (finalData.orderData.orderItems[0].purchaseDetailsResponse.itemType) {
                    case 'course':
                        try {
                            let courses = await LearnContentService.getCourseByIds({ query: { ids: finalData.orderData.orderItems[0].purchaseDetailsResponse.itemId.toString() ,"country" : req.query['country'], skipPrice:true} });
                            if (courses && courses.length > 0) {
                                finalData.itemData = {
                                    title: courses[0].title,
                                    slug: courses[0].slug,
                                    id: courses[0].id,
                                    numeric_id: courses[0].numeric_id,
                                    partner: courses[0].partner,
                                    cover_image: courses[0].cover_image,
                                    card_image: courses[0].card_image,
                                    card_image_mobile: courses[0].card_image_mobile,
                                    description: courses[0].description,
                                    faq: courses[0].faq,
                                    course_start_date: courses[0].course_start_date,
                                    course_end_date: courses[0].course_end_date,
                                    course_access_link: courses[0].course_access_link || null,
                                    features: {
                                        accessibilities: courses[0].course_details.accessibilities,
                                        level: courses[0].course_details.level,
                                        course_enrollment_start_date: courses[0].course_details.course_enrollment_start_date,
                                        course_enrollment_end_date: courses[0].course_details.course_enrollment_end_date,
                                        instruction_type: courses[0].course_details.instruction_type,
                                        medium: courses[0].course_details.medium,
                                        availabilities: courses[0].course_details.availabilities,
                                        availabilities: courses[0].course_details.availabilities,
                                        duration: courses[0].course_details.duration,
                                        total_duration_unit: courses[0].course_details.total_duration_unit,
                                        total_video_content: courses[0].course_details.total_video_content,
                                        total_video_content_unit: courses[0].course_details.total_video_content_unit,
                                        effort: courses[0].course_details.effort,
                                        course_batch: courses[0].course_details.course_batch,
                                        subtitles: courses[0].course_details.subtitles,
                                        language: courses[0].course_details.language,
                                    }
                                }
                            }
                        } catch (error) {
                            console.log("No course for id", error)
                            finalData.itemData = null
                        }
                        break;
                    case 'learnpath':
                        try {
                            let courses = await LearnPathService.getLearnpathByIds({ query: { ids: finalData.orderData.orderItems[0].purchaseDetailsResponse.itemId.toString(),"country" : req.query['country'], skipPrice:true } });
                            if (courses && courses.length > 0) {
                                finalData.itemData = {
                                    title: courses[0].title,
                                    slug: courses[0].slug,
                                    id: courses[0].id,
                                    numeric_id: courses[0].numeric_id,
                                    cover_image: courses[0].cover_image,
                                    card_image: courses[0].card_image,
                                    card_image_mobile: courses[0].card_image_mobile,
                                    description: courses[0].description,
                                    faq: courses[0].faq,
                                    course_count: (courses[0].courses)? courses[0].courses.length : null,
                                    course_access_link: courses[0].course_access_link || null
                                }
                            }
                        } catch (error) {
                            console.log("No course for id", error)
                            finalData.itemData = null
                        }
                        break;
                    default:
                        finalData.itemData = null
                        break;
                }



                return res.status(200).json({
                    'success': true,
                    'message': 'Fetch successfully!',
                    'data': finalData
                });

            } else {
                return res.status(200).json(errorResponse);
            }

        }).catch(error => {
            console.log(error);
            return res.status(200).json(errorResponse);
        })


    } catch (error) {
        console.log(error);
        return res.status(200).json(errorResponse);
    }
}

const cancellationDetails = async (req, res, next) => {
    try {
        let errorResponse = {
            'success': false,
            'message': 'something went wrong, Please try again',
            'data': {}
        }
        let orderId = req.query.orderId
        let userId = await encryptUserId(req.user.userId)  
        let request_url = `${process.env.ECOM_API_URL}/ecommerce/cancellation/cancellation_details/user/${orderId}?user_id=${userId}`
        let finalData = {}
        axios.get(request_url).then(async (response) => {
            if (response.data.status == 'OK' && response.data.data) {
                finalData.cancellationData = response.data.data
                switch (finalData.cancellationData.refundSummary.itemType) {
                    case 'course':
                        try {
                            let courses = await LearnContentService.getCourseByIds({ query: { ids: finalData.cancellationData.refundSummary.itemId.toString(), "country":req.query['country'], skipPrice:true} });
                            if (courses && courses.length > 0) {
                                finalData.itemData = {
                                    title: courses[0].title,
                                    slug: courses[0].slug,
                                    id: courses[0].id,
                                    partner: courses[0].partner,
                                    cover_image: courses[0].cover_image,
                                    card_image: courses[0].card_image,
                                    card_image_mobile: courses[0].card_image_mobile,
                                    course_access_link: courses[0].course_access_link || null
                                }
                            }
                        } catch (error) {
                            console.log("No course for id", error)
                            finalData.itemData = null
                        }
                        break;
                    case 'learnpath':
                        try {
                            let courses = await LearnPathService.getLearnpathByIds({ query: { ids: finalData.cancellationData.refundSummary.itemId.toString(),"country" : req.query['country'], skipPrice:true } });
                            if (courses && courses.length > 0) {
                                finalData.itemData = {
                                    title: courses[0].title,
                                    slug: courses[0].slug,
                                    id: courses[0].id,
                                    cover_image: courses[0].cover_image,
                                    card_image: courses[0].card_image,
                                    card_image_mobile: courses[0].card_image_mobile,
                                    course_count: (courses[0].courses)? courses[0].courses.length : null,
                                    course_access_link: courses[0].course_access_link || null
                                }
                            }
                        } catch (error) {
                            console.log("No course for id", error)
                            finalData.itemData = null
                        }
                        break;
                    default:
                        finalData.itemData = null
                        break;
                }



                return res.status(200).json({
                    'success': true,
                    'message': 'Fetch successfully!',
                    'data': finalData
                });

            } else {
                return res.status(200).json(errorResponse);
            }

        }).catch(error => {
            console.log(error);
            return res.status(200).json(errorResponse);
        })


    } catch (error) {
        console.log(error);
        return res.status(200).json(errorResponse);
    }
}

const cancellationProgress = async (req, res, next) => {
    try {
        let errorResponse = {
            'success': false,
            'message': 'something went wrong, Please try again',
            'data': {}
        }
        let orderId = req.query.orderId
        let userId = await encryptUserId(req.user.userId)
        let itemType = req.query.itemType
        let itemId = req.query.itemId
        if (itemType == 'course') {
            if (itemId.includes("LRN_CNT_PUB_")) {
                itemId = itemId.replace('LRN_CNT_PUB_', '');
            }
        }
        else if (itemType == 'learnpath') {
            if (itemId.includes("LRN_PTH_")) {
                itemId = itemId.replace('LRN_PTH_', '');
            }
        }

        let request_url = `${process.env.ECOM_API_URL}/ecommerce/cancellation/request_progress/user/${orderId}?user_id=${userId}`
        let finalData = {}
        axios.get(request_url).then(async (response) => {
            if (response.data.status == 'OK' && response.data.data) {
                finalData.cancellationData = response.data.data
                switch (itemType) {
                    case 'course':
                        try {
                            let courses = await LearnContentService.getCourseByIds({ query: { ids: itemId.toString(),"country" : req.query['country'], skipPrice:true } });
                            if (courses && courses.length > 0) {
                                finalData.itemData = {
                                    title: courses[0].title,
                                    slug: courses[0].slug,
                                    id: courses[0].id,
                                    partner: courses[0].partner,
                                    cover_image: courses[0].cover_image,
                                    card_image: courses[0].card_image,
                                    card_image_mobile: courses[0].card_image_mobile,
                                    course_start_date: courses[0].course_start_date,
                                    course_end_date: courses[0].course_end_date,
                                    course_access_link: courses[0].course_access_link || null

                                }
                            }
                        } catch (error) {
                            console.log("No course for id", error)
                            finalData.itemData = null
                        }
                        break;
                    case 'learnpath':
                        try {
                            let courses = await LearnPathService.getLearnpathByIds({ query: { ids: finalData.cancellationData.courseId.toString(),"country" : req.query['country'], skipPrice:true } });
                            if (courses && courses.length > 0) {
                                finalData.itemData = {
                                    title: courses[0].title,
                                    slug: courses[0].slug,
                                    id: courses[0].id,
                                    cover_image: courses[0].cover_image,
                                    card_image: courses[0].card_image,
                                    card_image_mobile: courses[0].card_image_mobile,
                                    course_count: (courses[0].courses)? courses[0].courses.length : null,
                                    course_access_link: courses[0].course_access_link || null
                                }
                            }
                        } catch (error) {
                            console.log("No course for id", error)
                            finalData.itemData = null
                        }
                        break;
                    default:
                        finalData.itemData = null
                        break;
                }

                return res.status(200).json({
                    'success': true,
                    'message': 'Fetch successfully!',
                    'data': finalData
                });

            } else {
                return res.status(200).json(errorResponse);
            }

        }).catch(error => {
            console.log(error);
            return res.status(200).json(errorResponse);
        })


    } catch (error) {
        console.log(error);
        return res.status(200).json(errorResponse);
    }
}

const orderHistory = async (req, res, next) => {
    try {
        let errorResponse = {
            'success': false,
            'message': 'something went wrong, Please try again',
            'data': {}
        }
        let defaultSort = 'Recently Purchansed'
        let sortOptions = ['Recently Purchansed','Purchansed Earlier']
        req.query.sort = req.query.sort || defaultSort 
        let userId = await encryptUserId(req.user.userId)
        let page =  req.query.page || 1 
        let size =  req.query.size || 25 
        let sortBy = (req.query.sort ='Recently Purchansed')?'desc' : 'asc'
        let requestData = {
            userId :userId,
            pageNo : page,
            limit : size,         
            sortBy : sortBy 
         }
         requestData.itemType = []
         requestData.cartType = []
         requestData.orderStatus = []
        if (req.query['f']) {

            let parsedFilters = parseQueryFilters(req.query['f']);
            if(parsedFilters && parsedFilters.length)
            {
                for (let parsedFilter of parsedFilters)
                {
                    if(parsedFilter.key =='Course Type')
                    {
                        requestData.itemType = parsedFilter.value
                    }
                    if(parsedFilter.key =='Payment Type')
                    {
                        requestData.cartType = parsedFilter.value

                    }
                    if(parsedFilter.key =='Order Status')
                    {
                        requestData.orderStatus = parsedFilter.value
                    }
                }
            }
        }

        let request_url = `${process.env.ECOM_API_URL}/ecommerce/user/payment_details`

        axios.post(request_url, requestData).then(async (response) => {
            if (response.data.status == 'OK' && response.data.data) {
                let list = []
                if (response.data.data.orderDetailResponseList && response.data.data.orderDetailResponseList.length > 0) {
                    list = await  Promise.all( response.data.data.orderDetailResponseList.map(async entity => {
                        let courseData = {}
                        switch (entity.orderItems[0].purchaseDetailsResponse.itemType) {
                            case 'course':
                                try {
                                    let courses = await LearnContentService.getCourseByIds({ query: { ids: entity.orderItems[0].purchaseDetailsResponse.itemId.toString() ,"country" : req.query['country'], skipPrice:true} });
                                    if (courses && courses.length > 0) {
                                        courseData = {
                                            title: courses[0].title,
                                            slug: courses[0].slug,
                                            id: courses[0].id,
                                            partner: courses[0].partner,
                                            cover_image: courses[0].cover_image,
                                            card_image: courses[0].card_image,
                                            card_image_mobile: courses[0].card_image_mobile,
                                            course_start_date: courses[0].course_start_date,
                                            course_end_date: courses[0].course_end_date,
                                            course_access_link: courses[0].course_access_link || null

                                        }
                                    }
                                } catch (error) {
                                    console.log("No course for id", error)
                                    courseData = null
                                }
                                break;
                            case 'learnpath':
                                try {
                                    let courses = await LearnPathService.getLearnpathByIds({ query: { ids: entity.orderItems[0].purchaseDetailsResponse.itemId.toString(), "country" : req.query['country'], skipPrice:true } });
                                    if (courses && courses.length > 0) {
                                        courseData = {
                                            title: courses[0].title,
                                            slug: courses[0].slug,
                                            id: courses[0].id,
                                            cover_image: courses[0].cover_image,
                                            card_image: courses[0].card_image,
                                            card_image_mobile: courses[0].card_image_mobile,
                                            course_count: (courses[0].courses)? courses[0].courses.length : null,
                                            course_access_link: courses[0].course_access_link || null
                                        }
                                    }
                                } catch (error) {
                                    console.log("No course for id", error)
                                    courseData = null
                                }
                                break;
                            default:
                                courseData = null
                                break;
                        }
                        entity.item = entity.orderItems[0]
                        delete entity.orderItems
                        return {
                            courseData: courseData,
                            orderData: entity
                        }
                    }))
                }

                let pagination = {
                    "page": page,
                    "count": list.length || 0,
                    "perPage": size,
                    "totalCount": response.data.data.totalCount || list.length,
                    "total": response.data.data.totalCount || list.length
                }

                let sort = req.query.sort

                let filters =[]
                
                if(response.data.data.availableFilters)
                {                    
                    if(response.data.data.availableFilters.itemType)
                    {
                        let options = []
                        if(response.data.data.availableFilters.itemType.includes('course'))
                        {
                            options.push({
                                label: "Course",
                                selected: (requestData.itemType && requestData.itemType.includes("course"))? true:false,
                                disabled: false,
                                count:2
                            })
                        }
                        if(response.data.data.availableFilters.itemType.includes('learnpath'))
                        {
                            options.push({
                                label: "Learn Path",
                                selected: (requestData.itemType && requestData.itemType.includes("learnpath"))? true:false,
                                disabled: false,
                                count:2
                            })
                        }
                        filters.push({
                            label: "Course Type",
                            field: "itemType",
                            filterable: true,
                            filter_postion: "vertical",
                            order:1,
                            display_count: false,
                            filter_type: "Checkboxes",
                            options: options
                        })
                    }

                    if(response.data.data.availableFilters.cartTypes)
                    {
                        let options = []
                        if(response.data.data.availableFilters.cartTypes.includes('emi'))
                        {
                            options.push({
                                label: "EMI",
                                selected: (requestData.cartTypes && requestData.cartTypes.includes("emi")) ? true:false,
                                disabled: false,
                                count:2
                            })
                        }
                        if(response.data.data.availableFilters.cartTypes.includes('buynow'))
                        {
                            options.push({
                                label: "Single Purchased",
                                selected: (requestData.cartTypes && requestData.cartTypes.includes("buynow")) ? true:false,
                                disabled: false,
                                count:2
                            })
                        }
                        if(response.data.data.availableFilters.cartTypes.includes('enrollnow'))
                        {
                            options.push({
                                label: "Enroll",
                                selected: (requestData.cartTypes && requestData.cartTypes.includes("enrollnow")) ? true:false,
                                disabled: false,
                                count:2
                            })
                        }
                        
                        filters.push({
                            label: "Payment Type",
                            field: "cartType",
                            filterable: true,
                            filter_postion: "vertical",
                            order:2,
                            display_count: false,
                            filter_type: "Checkboxes",
                            options: options
                        })
                    }

                    if(response.data.data.availableFilters.orderStatus)
                    {
                        let options = []
                        if(response.data.data.availableFilters.orderStatus.includes('Successful'))
                        {
                            options.push({
                                label: "Successful",
                                selected: (requestData.orderStatus && requestData.orderStatus.includes("Successful"))? true:false,
                                disabled: false,
                                count:2
                            })
                        }
                        if(response.data.data.availableFilters.orderStatus.includes('Created'))
                        {
                            options.push({
                                label: "Created",
                                selected: (requestData.orderStatus && requestData.orderStatus.includes("Created"))? true:false,
                                disabled: false,
                                count:2
                            })
                        }
                        if(response.data.data.availableFilters.orderStatus.includes('Payment Failed'))
                        {
                            options.push({
                                label: "Payment Failed",
                                selected: (requestData.orderStatus && requestData.orderStatus.includes('Payment Failed'))? true:false,
                                disabled: false,
                                count:2
                            })
                        }
                        
                        filters.push({
                            label: "Order Status",
                            field: "orderStatus",
                            filterable: true,
                            order:3,
                            filter_postion: "horizontal",
                            display_count: false,
                            filter_type: "Checkboxes",
                            options: options
                        })
                    }

                }

                return res.status(200).json({
                    'success': true,
                    'message': 'Fetch successfully!',
                    'data': {list:list,filters:filters,pagination:pagination,sort:sort,sortOptions:sortOptions}
                });

                
                

            } else {
                return res.status(200).json(errorResponse);
            }

        }).catch(error => {
            console.log(error);
            return res.status(200).json(errorResponse);
        })


    } catch (error) {
        console.log(error);
        return res.status(200).json(errorResponse);
    }
}


module.exports = {
    oderDetails,
    orderHistory,
    cancellationDetails,
    cancellationProgress
}