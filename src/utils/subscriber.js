const EventEmitter = require('events');
const { createLead } = require('../services/v1/zohoService');
const { createRecordInStrapi } = require('../services/v1/Strapi');
class Emitter extends EventEmitter {}
const eventEmitter = new Emitter();


eventEmitter.on('error', () => {
    console.log('error')
})

eventEmitter.on('enquiry_placed', (enquiryId) => {
    createLead(enquiryId)
    createRecordInStrapi(enquiryId)
})

module.exports = eventEmitter