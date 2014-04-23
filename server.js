var async = require('async');
var extend = require('extend');
var argv = require('optimist')
  .usage('Usage: node server.js -v 0.3.7 -p 9002 -f')
  .alias('f', 'force')
  .alias('p', 'port')
  .alias('v', 'version')
  .describe('f', 'Force tests to run even if results already exist.')
  .describe('p', 'Port to run server on. Defaults to 9002.')
  .describe('v', 'Version of PeerJS to run tests on. Defaults to latest (in cdn.peerjs.com).')
  .default('p', 9002)
  .boolean('f')
  .argv;

var PORT = process.env.PORT || argv.port;

var express = require('express');
var app = express();

var Datastore = require('nedb');
var db = {};
db.data = new Datastore({ filename: __dirname + '/data/data', autoload: true });
db.workers = new Datastore({ filename: __dirname + '/data/workers', autoload: true });

// BrowserStack runner.
var Runner = require('./run.js');

// Browsers to test
// Browser configs can override flag version configs (e.g. if you want to test
// version interop.)
var BROWSERS = JSON.parse(require('fs').readFileSync('browsers.json').toString());

var URL = 'http://peerjs.com:9002';

// Map of our workerIds to BrowserStack ids
var WORKER_IDS = {};
// Callbacks to be called when workers end
var WORKER_CBS = {};
// Timeouts for killing workers
var WORKER_TIMEOUTS = {};

app.use(express.json());

app.use('/static', express.static(__dirname + '/public'));

app.post('/save', function(req, res) {
  db.data.findOne({testId: req.body.testId}, function(err, doc){
    if (doc) {
      db.data.update({testId: req.body.testId}, extend(true, doc, req.body))
    }
  });
  res.send(200);
});

app.post('/end', function(req, res) {
  // Kill req.body.workerId
  res.send(200);
  var workerId = req.body.workerId;
  console.log('[INFO] Got end request for', workerId);
  var id = WORKER_IDS[workerId];
  clearTimeout(WORKER_TIMEOUTS[workerId]);
  if (id) {
    Runner.kill(id);
    var cb = WORKER_CBS[workerId];
    if (cb) {
      delete WORKER_CBS[workerId];
      cb();
    }
  } else {
    console.log('[BAD] Got end request without valid workerId', req.body.workerId);
  }
});

// Dump of all tests results.
app.get('/dump', function(req, res) {
  var version = req.query.version;
  var query = {};
  var message = '[INFO] Dumping all test results';
  if (version) {
    message += ' for v' + version;
    query.version = version;
  }
  console.log(message + ' (IP: ' + req.connection.remoteAddress + ')');

  db.data.find(query, function(err, data) {
    res.send(data);
    console.log('[INFO] Dumped ' + data.length + ' tests.');
  });
});

// Latest test date.
app.get('/latest', function(req, res) {
  var version = req.query.version;
  var query = {};
  var message = '[INFO] Grabbing latest test run date';
  if (version) {
    message += ' for v' + version;
    query.version = version;
  }
  console.log(message + ' (IP: ' + req.connection.remoteAddress + ')');

  db.data.find(query).sort({ created: -1 }).limit(1).exec(function(err, data) {
    if (err) {
      res.send(err);
    } else if (!data.length) {
      res.send('No tests have been run' + (version ? ' for ' + version : '') + ' yet!');
    } else {
      res.send(data[0].created);
      console.log('[INFO] Last run:', data[0].created);
    }
  });
});

// Lists all browsers supported by BrowserStack.
app.get('/browsers', function(req, res) {
  Runner.getBrowsers(function(err, browsers){
    res.send(browsers);
  });
});

app.listen(PORT);
console.log('[INFO] Now listening on port:', PORT);


// Start tests

function startMirror(version) {
  if (!version) {
    // TODO: Figure it out.
  }

  async.eachSeries(BROWSERS, function(browser, eachCb){
    var clientBrowser = browser.client;
    var hostBrowser = browser.host;
    if (!clientBrowser.peerjsVersion) {
      clientBrowser.peerjsVersion = version;
    }
    if (!hostBrowser.peerjsVersion) {
      clientBrowser.peerjsVersion = version;
    }

    db.data.findOne({'client.setting': clientBrowser, 'host.setting': hostBrowser}, function(err, data) {
      if (data && !argv.force) {
        return eachCb();
      } else {
        Runner.killAll(function(){

          // Generate a test ID.
          var testId = guid();

          // Generate client, host IDs and settings.
          var clientId = guid();
          var clientSetting = generateWorkerSettings(clientBrowser, testId, 'client', clientId);
          var hostId = guid();
          var hostSetting = generateWorkerSettings(hostBrowser, testId, 'host', hostId);
          var browserLog = browserString(clientBrowser) + ' connecting to ' + browserString(hostBrowser);

          var logPrefix;
          if (data && argv.force) {
            logPrefix = '[FORCE START]';
          } else {
            logPrefix = '[START]';
          }
          console.log(logPrefix, browserLog);

          db.data.insert({
            created: Date.now(),
            testId: testId,
            client: {
              setting: clientBrowser
            },
            host: {
              setting: hostBrowser
            }
          });

          async.parallel([
            function(pCb){
              Runner.start(hostSetting, pCb);
            },
            function(pCb){
              setTimeout(function(){
                Runner.start(clientSetting, pCb);
              }, 1000);
            }
          ], function(err, results) {
            if (err) {
              return eachCb('[BAD] Failed to start clients ' + err.toString());
            }

            console.log('[...] Clients started');
            WORKER_IDS[clientId] = results[1].id;
            WORKER_IDS[hostId] = results[0].id;
            async.parallel({
              client: function(endCb) {
                WORKER_CBS[clientId] = endCb;
                WORKER_TIMEOUTS[clientId] = setTimeout(timeout(clientId), 60000);
              },
              host: function(endCb){
                WORKER_CBS[hostId] = endCb;
                WORKER_TIMEOUTS[hostId] = setTimeout(timeout(hostId), 60000);
              }

            }, function(){
              // Test is done!
              console.log('[FINISH]', browserLog);
              eachCb();
            });
          });
        });
      }
    });
  }, function(err){
    if (err) {
      console.log('[BAD] Tests failed to run:', err);
    } else {
      console.log('[DONE] Tests completed.');
    }
  });
}

function timeout(workerId) {
  return function() {
    var id = WORKER_IDS[workerId];
    var cb = WORKER_CBS[workerId];
    if (id) {
      Runner.kill(id);
    }
    if (cb) {
      console.log('[INFO] Server timeout, killing', workerId);
      cb();
      delete WORKER_CBS[workerId];
    }
    delete WORKER_TIMEOUTS[workerId];
  };
}

function generateWorkerSettings(browser, testId, role, workerId) {
  setting = extend(true, {}, browser);
  setting.url = URL + '/static/test.html?TEST_ID=' + testId + '&ROLE=' + role + '&WORKER_ID=' + workerId + '&PEERJS_VERSION=' + browser.peerjsVersion;
  return setting;
}

function browserString(browser) {
  return browser.os + ' ' + browser.browser + ' ' + browser.browser_version + ' peer.js v' + browser.peerjsVersion;
}


function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }

  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4()
    + s4();
}

startMirror(argv.version);
