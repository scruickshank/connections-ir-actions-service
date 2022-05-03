const logger = require('./logger');

const AWS = require('aws-sdk');
const express = require('express');
const Prometheus = require('prom-client');
const crypto = require('crypto');
const requestretry = require('requestretry');
const LRU = require('lru-cache');
const updater = require('./update');

const CERT_CACHE = new LRU({max: 5000, maxAge: 1000 * 60});

const CERT_URL_PATTERN = /^https:\/\/sns\.[a-zA-Z0-9-]{3,}\.amazonaws\.com(\.cn)?\/SimpleNotificationService-[a-zA-Z0-9]{32}\.pem$/;

const app = express();

const port = 80;

const metricsInterval = Prometheus.collectDefaultMetrics();

const httpRequestDurationMicroseconds = new Prometheus.Histogram({
  name: `ir_actions_http_request_duration_ms_${process.env.ENV}`,
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.10, 5, 15, 50, 100, 200, 300, 400, 500]  // buckets for response time from 0.1ms to 500ms
});

const documentsUpdated = new Prometheus.Counter({
  name: `documents_updated_${process.env.ENV}`,
  help: 'Total number of documents updated per channel',
  labelNames: ['channel']
});

app.use(express.urlencoded({extended: true,limit: '50mb'}));
app.use(express.json({limit: '50mb'}));
app.use(express.text({limit: '50mb'}));

var config = new AWS.Config({
  accessKeyId: process.env.snsKey,
  secretAccessKey: process.env.snsSecret, 
  region: 'eu-west-1'
});

const cache = new Cache();

const snsInstance = new AWS.SNS(config);

// Runs before each requests
app.use((req, res, next) => {
  res.locals.startEpoch = Date.now()
  next()
});

const verifySender = (req,res,next) => {
  try {
    const body = JSON.parse(req.body);
    validate(body, (err,result) => {
      if (err) {
        logger.error(err, `Message sender was not validated, tossing away ${req.body}`);
      } else {
        //validated signature, allow it
        next();
      }
      
    });
  } catch (e) {
    logger.error(e, `Failure to verifySender on route: ${req.path}`);
  }
  
};

app.get('/', async(req,res) => {
  res.sendStatus(200);
});

app.get('/api/health', (req,res) => {
  console.log('health check!');
  res.send('Health OK!');
});

app.post('/api/documents/update', verifySender, async(req,res,next) => {

  try {
    
    const body = JSON.parse(req.body);
    if (isConfirmSubscription(req.headers)) {
      
      try {
          logger.info(null, 'Confirming subscription');

          const subscription = await confirmSubscription(req.headers, body.Token);
          res.json(subscription);
      } catch (err) {
          logger.error(null, `Error in confirmSubscription(): ${err.message}`);
          res.statusCode = 500;
          
      }
    } else if (isNotification(req.headers)) {
        const body = JSON.parse(body.Message);
       
        const incomingDoc = body.incomingDoc;
        const redisDoc = body.redisDoc;

        await updater.UpdateDocument(incomingDoc, currentDoc);
    }
    next();

  } catch (e) {
    logger.error(e, `Error in dedupe: ${e.message}`);
    
    next();
  }
});

app.post('/api/test', async(req,res) => {
  try {
    const messages = req.body;
    const deduper = new Deduper(messages.data);
    const retMessages = await deduper.dedupe();

    res.status(200).send(retMessages);
  } catch (e) {
    console.error(e);
    res.status(500).send(e.message);
  }
});

app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', Prometheus.register.contentType)
  res.end(await Prometheus.register.metrics())
});

// Runs after each requests
app.use((req, res, next) => {
  const responseTimeInMs = Date.now() - res.locals.startEpoch;

  httpRequestDurationMicroseconds
    .labels(req.method, req.route.path, res.statusCode)
    .observe(responseTimeInMs)

  res.status(200).send();
});

app.use((err, req, res, next) => {
  res.statusCode = 500
  // Do not expose your error in production
  logger.error(err, `There was an error in request: ${req.route.path} with error: ${err}`);
  next()
})

app.use(function (req,res,next){
	//res.status(404).send('Unable to find the requested resource!');
  logger.error(null, `Returning a 404 for method ${req.method} for requested path ${req.route.path} with body: ${req.body} `);
  res.statusCode = 404;
});

const server = app.listen(port, () => {
  Init();

  logger.info(null, `Deduper Listening on ${port}`);
})

function isConfirmSubscription(headers) {
  
  return headers['x-amz-sns-message-type'] === 'SubscriptionConfirmation';
}

function isNotification(headers) {
  return headers['x-amz-sns-message-type'] === 'Notification';
}

function confirmSubscription(headers, token) {
  return new Promise(((resolve, reject) =>{
      
      snsInstance.confirmSubscription({
          TopicArn: headers['x-amz-sns-topic-arn'],
          Token : token
      }, (err, res)=>{
          if(err){
            logger.error(err, `There was an error confirming subscription with error: ${err.message}`);
              return reject(err)
          }
          return resolve(res.SubscriptionArn);
      });
  }))
}

function Init() {
  cache.start().catch(e => {
    console.error(e, `There was an error in Init trying to start cache with error: ${e.message}`);
  });
}

function fieldsForSignature(type) {
  if (type === 'SubscriptionConfirmation' || type === 'UnsubscribeConfirmation') {
    return ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'];
  } else if (type === 'Notification') {
    return ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'];
  } else {
    return [];
  }
}

function fetchCert(certUrl, cb) {
  const cachedCertificate = CERT_CACHE.get(certUrl);
  if (cachedCertificate !== undefined) {
    cb(null, cachedCertificate);
  } else {
    requestretry({
      method: 'GET',
      url: certUrl,
      maxAttempts: 3,
      retryDelay: 100,
      timeout: 3000
    }, (err, res, certificate) => {
      if (err) {
        cb(err);
      } else {
        if (res.statusCode === 200) {
          CERT_CACHE.set(certUrl, certificate);
          cb(null, certificate);
        } else {
          cb(new Error(`expected 200 status code, received: ${res.statusCode}`));
        }
      }
    });
  }
}

function validate(message, cb) {
  if (!('SignatureVersion' in message && 'SigningCertURL' in message && 'Type' in message && 'Signature' in message)) {
    logger.error(null, 'missing field');
    cb(null, false);
  } else if (message.SignatureVersion !== '1') {
    logger.error(null, 'invalid SignatureVersion');
    cb(null, false);
  } else if (!CERT_URL_PATTERN.test(message.SigningCertURL)) {
    logger.error(null, 'invalid certificate URL');
    cb(null, false);
  } else {
    fetchCert(message.SigningCertURL, (err, certificate) => {
      if (err) {
        cb(err);
      } else {
        const verify = crypto.createVerify('sha1WithRSAEncryption');
        
        fieldsForSignature(message.Type).forEach(key => {
          if (key in message) {
            verify.write(`${key}\n${message[key]}\n`);
          }
        });
        verify.end();
        const result = verify.verify(certificate, message.Signature, 'base64');
        cb(null, result);
      }
    });
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  clearInterval(metricsInterval)
  cache.close();

  server.close((err) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }

    process.exit(0)
  })
})


