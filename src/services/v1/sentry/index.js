const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");
const { v4: uuidv4 } = require('uuid');

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
    if(process.env.SENTRY_DSN != undefined &&   process.env.SENTRY_DSN != ''){
    
        global.console.log = (data, data1) => {
      
            //for multiple cases console.log('msg', err) or console.log(err, 'msg'); we have to consider data, data1
          let err = [data, data1];
          err = err.filter(e =>{ return e != undefined } )
            //for printing error in console, only when environment is set to 'development' and 'staging' 
          const logInDevStag = (process.env.SENTRY_ENVIRONMENT == 'development' || process.env.SENTRY_ENVIRONMENT == 'staging')      
          let transaction = Sentry.getCurrentHub().getScope().getTransaction()
    
          // finish the backend (sentry) transaction  if exits
          if(transaction)
            transaction.finish()        
      
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

    app.all("*", (req, res, next) => {

        //start backend transaction (for every request)
    var transaction = Sentry.startTransaction({
        op: req.url,
        name: req.url +" ( backend )"
    });

    Sentry.configureScope(scope => {
        scope.setSpan(transaction);
    });

    //get the headers from frontend
    let traceId = req.header('CV-Trace-ID'),
    parentId = req.header("CV-Span-ID")

    if (traceId) {
        Sentry.configureScope(scope => {
            // assign traceId
            scope.setTag("traceId", traceId);
        });
    }
    if (parentId) {
        Sentry.configureScope(scope => {
            // assign parentId (spanId of previous span) from previous trasaction
            scope.setTag("parentId", parentId);
        });
    }
        //generate random string to use as spanId
    const spanId = uuidv4()

    Sentry.configureScope(scope => {
        scope.setTag("spanId", spanId);
    });

    next();
    })
}

module.exports = {
    initialize,
}




