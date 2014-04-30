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
var PEERJS_HOST = 'cdn.peerjs.com';
var PEERJS_PATH = '/0.3/peer.js';
var VERSION_REGEX = / build:(\d\.\d\.\d), /g;
var http = require('http');

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
  var data = req.body;
  db.data.findOne({testId: data.testId}, function(err, doc){
    if (doc) {
      if (data.resultRole) {
        // Check if a result previously called back and was different.
        // TODO: this needs to change when A/V testing is added.
        if (doc.result && data.result && doc.result !== data.result) {
          console.log('[BAD]', data.resultRole, 'called back with:',
            data.result, 'but we previously received a conflicting result:',
            doc.result);
        }
        delete data.resultRole;
      }
      db.data.update({testId: data.testId}, extend(true, doc, data))
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

// TODO: endpoint for running tests on a certain revision. Should die early if
// invalid revision/doesn't load, etc.

app.listen(PORT);
console.log('[INFO] Now listening on port:', PORT);


// Start tests

function startTestsForVersion(version) {
  console.log('[INFO] Starting tests for version:', version);
  async.eachSeries(BROWSERS, function(browser, eachCb){
    var clientBrowser = browser.client;
    var hostBrowser = browser.host;
    if (!clientBrowser.peerjsVersion) {
      clientBrowser.peerjsVersion = version;
    }
    if (!hostBrowser.peerjsVersion) {
      hostBrowser.peerjsVersion = version;
    }
    startTestsForBrowsers(version, clientBrowser, hostBrowser, eachCb);
  }, function(err){
    if (err) {
      console.log('[BAD] Tests failed to run:', err);
    } else {
      console.log('[DONE] Tests completed.');
    }
  });
}

function startTestsForBrowsers(version, clientBrowser, hostBrowser, cb) {
  var query = {
    'client.setting': clientBrowser,
    'host.setting': hostBrowser,
    version: version
  };
  db.data.findOne(query, function(err, data) {
    // Rerun tests that had no result.
    if (data && data.result && !argv.force) {
      return cb();
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

        if (data) {
          // Overwrite!
          db.data.update(query, {
            created: Date.now(),
            testId: testId,
            version: version, // This is the "default version" these tests are attributed to.
            client: {
              setting: clientBrowser
            },
            host: {
              setting: hostBrowser
            },
            // Save one previous run when rerunning.
            previousRun: data
          });
        } else {
          db.data.insert({
            created: Date.now(),
            testId: testId,
            version: version, // This is the "default version" these tests are attributed to.
            client: {
              setting: clientBrowser
            },
            host: {
              setting: hostBrowser
            }
          });
        }

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
            return cb('[BAD] Failed to start clients ' + err.toString());
          }

          console.log('[...] Clients started');
          WORKER_IDS[hostId] = results[0].id;
          WORKER_IDS[clientId] = results[1].id;

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
            cb();
          });
        });
      });
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

function startTests(version) {
  if (!version) {
    var getOptions = {
      host: PEERJS_HOST,
      path: PEERJS_PATH
    };

    http.get(getOptions, function(res) {
      res.setEncoding('utf8');
      var version, match;
      res.on('data', function (chunk) {
        if (!version && (match = VERSION_REGEX.exec(chunk))) {
          version = match[1];
          console.log('[INFO] Found version from latest build on CDN:', version);
          startTestsForVersion(version);
        }
      });
    }).on('error', function(e) {
      console.log("[INFO] When retrieving version, got error: " + e.message);
    });
  } else {
    startTestsForVersion(version);
  }
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

startTests(argv.version);
