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

module.exports = {

validatePaginationParams,
validateAddWishlistParams,
validateAddArticleParams

}