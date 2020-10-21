const EventEmitter = require('events');
class Emitter extends EventEmitter {}
const eventEmitter = new Emitter();


eventEmitter.on('error', () => {
    console.log('error')
})


module.exports = eventEmitter