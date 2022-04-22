const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");

const initialize = (app) => {

    Sentry.init({
        //dsn: "https://f23bb5364b9840c582710a48e3bf03ef@o1046450.ingest.sentry.io/6022217",
        attachStacktrace:true,
        // Enable HTTP calls tracing
        integrations: [new Sentry.Integrations.Http({ tracing: true }),
        // Enable Express.js middleware tracing
        new Tracing.Integrations.Express({ app })],
        // Set tracesSampleRate to 1.0 to capture 100%
        // of transactions for performance monitoring.
        // We recommend adjusting this value in production
        tracesSampleRate: 1.0,
      });
    
    app.use(Sentry.Handlers.requestHandler());
    
    app.use(Sentry.Handlers.errorHandler());
        // TracingHandler creates a trace for every incoming request
    app.use(Sentry.Handlers.tracingHandler());
    
    // wrapping console.log and sentry
    if(process.env.SENTRY_DSN != undefined ||   process.env.SENTRY_DSN != ''){
    
        global.console.log = (data, data1) => {
      
            //for multiple cases console.log('msg', err) or console.log(err, 'msg'); we have to consider data, data1
          let err = [data, data1];
          err = err.filter(e =>{ return e != undefined } )
            //for printing error in console, only when environment is set to 'development' and 'staging' 
          const logInDevStag = (process.env.SENTRY_ENVIRONMENT == 'development' || process.env.SENTRY_ENVIRONMENT == 'staging')      
      
          err.forEach(data => {
            //if error is simple message (string)
            if (typeof data === 'string' || data instanceof String){
              Sentry.captureMessage(data);
              if(logInDevStag)
                process.stdout.write(data+'\n')
            }
              //if error is object (derived from Error class)
            else{
      
              Sentry.captureException(data);
              if(logInDevStag){
                let {message = '', name = '', stack = '' } = data
                process.stdout.write(name+ '\n'+ message+ '\n'+ stack +'\n')
              }
            }
            
          })
          
        }
      }
}

module.exports = {
    initialize,
}




