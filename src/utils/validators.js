const Joi = require('joi')

function validatePaginationParams(data) {

    const schema = Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).default(10),
    })

    const result = schema.validate(data)
    if (result.error) return { page: 1, limit: 10 }

    return result.value

}

function validateAddWishlistParams(body) {

    const { courseIds, courseId } = body
    schemaForCourseId = Joi.object({ courseId: Joi.string().required() })
    schemaForCourseIds = Joi.object({ courseIds: Joi.array().items(Joi.string()).required() })

    if (!schemaForCourseId.validate({courseId:courseId}).error) {
        return [courseId]
    }

    if (!schemaForCourseIds.validate({courseIds:courseIds}).error) {
        return courseIds
    }

    return null
}

function validateLearnPathAddWishlist(body) {

    const { learnpathIds, learnpathId } = body
    schemaForLearnPathId = Joi.object({ learnpathId: Joi.string().required() })
    schemaForLearnPathIds = Joi.object({ learnpathIds: Joi.array().items(Joi.string()).required() })

    if (!schemaForLearnPathId.validate({learnpathId:learnpathId}).error) {
        return [learnpathId]
    }

    if (!schemaForLearnPathIds.validate({learnpathIds:learnpathIds}).error) {
        return learnpathIds
    }

    return null
}

function validateAddArticleParams(body) {

    const { articleIds, articleId } = body
    schemaForArticleId = Joi.object({ articleId: Joi.string().required() })
    schemaForArticleIds = Joi.object({ articleIds: Joi.array().items(Joi.string()).required() })

    if (!schemaForArticleId.validate({articleId:articleId}).error) {
        return [articleId]
    }

    if (!schemaForArticleIds.validate({articleIds:articleIds}).error) {
        return articleIds
    }

    return null
}

//this is generic function to validate Ids; can be replace above few functino; buy API params will aslo change
function validateIds(body) {

    const { ids, id } = body
    schemaForCourseId = Joi.object({ id: Joi.string().required() })
    schemaForCourseIds = Joi.object({ ids: Joi.array().items(Joi.string()).required() })
    
    if (!schemaForCourseId.validate({id}).error) {
        return [id]
    }

    if (!schemaForCourseIds.validate({ids}).error) {
        return ids
    }

    return null
}

module.exports = {

validateIds,
validatePaginationParams,
validateAddWishlistParams,
validateAddArticleParams,
validateLearnPathAddWishlist

}