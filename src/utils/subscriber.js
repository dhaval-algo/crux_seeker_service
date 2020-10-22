const EventEmitter = require('events');
const { createLead } = require('../services/v1/zohoService');
class Emitter extends EventEmitter {}
const eventEmitter = new Emitter();


eventEmitter.on('error', () => {
    console.log('error')
})

eventEmitter.on('enquiry_placed', (enquiryId) => {
    createLead(enquiryId)
    
})

module.exports = eventEmitter