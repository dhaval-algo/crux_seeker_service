const EventEmitter = require('events');
const { createLead,createLearnPathLead } = require('../services/v1/zohoService');
const { createRecordInStrapi, createRecordInStrapiforLearnPath } = require('../services/v1/Strapi');
class Emitter extends EventEmitter {}
const eventEmitter = new Emitter();


eventEmitter.on('error', () => {
    console.log('error')
})

eventEmitter.on('enquiry_placed', (enquiryId) => {
    createLead(enquiryId)
    createRecordInStrapi(enquiryId)
})

eventEmitter.on('learnpathenquiry', (enquiryId) => {
    createLearnPathLead(enquiryId)
    createRecordInStrapiforLearnPath(enquiryId)
})

module.exports = eventEmitter