var BrowserStack = require( "browserstack" );
var client = BrowserStack.createClient({
    username: "ericzhang4",
    password: "VXkpz7bCJPemzMph7kFi"
});

var async = require('async');

var Runner = {};

Runner.kill = client.terminateWorker.bind(client);

Runner.killAll = function(cb) {
  client.getWorkers(function(err, workers){
    if (err) {
      return cb(err);
    }
    async.each(workers, function(worker, eachCb) {
      client.terminateWorker(worker.id, eachCb);
    }, function(err) {
      cb(err);
    });
  });
}

Runner.start = client.createWorker.bind(client);

Runner.getBrowsers = client.getBrowsers.bind(client);


module.exports = Runner;

