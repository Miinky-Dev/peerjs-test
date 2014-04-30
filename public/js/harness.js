var logData = [];
console.log = function(){
  args = Array.prototype.slice.call(arguments, 0);
  logData.push(Date.now() + ' ' + args.join(' '));
};

var CDN = 'http://cdn.peerjs.com';
var FILE = 'peer.js';

var FULL_TEST_TIMEOUT = 30000;

function loadScript(v, cb) {
  if (!cb) {
    cb = noop;
  }
  var loadTimeout = setTimeout(function(){
    cb(new Error('Could not load PeerJS v' + v));
  }, 2000);
  var script = document.createElement('script');
  script.onload = function(){
    clearTimeout(loadTimeout);
    cb()
  };
  script.setAttribute("type", "text/javascript");
  script.setAttribute("src", CDN + "/" + v + "/" + FILE);
  document.getElementsByTagName("head")[0].appendChild(script);
}

function saveTestData(id, data, cb) {
  if (!cb) {
    cb = noop;
  }
  var out = {};
  out[ROLE] = data;
  out.testId = id;
  post('/save', out, cb);
}

function end(workerId, msg) {
  end = function(){};
  // Ensure end only runs once
  clearTimeout(testTimeout);
  if (TEST_ID) {
    console.log(msg);
    saveTestData(TEST_ID, {ended: msg, log: logData});
  }
  post('/end', {workerId: workerId, msg: msg}, noop);
}

// Load testing dependency
var queryData = getQueryData();

var WORKER_ID = queryData.WORKER_ID;
var TEST_ID = queryData.TEST_ID;
var ROLE = queryData.ROLE; // 'client' or 'host'
var PEERJS_VERSION = queryData.PEERJS_VERSION || '0';

if (!WORKER_ID) {
  // Shit
  throw new Error('No WORKER_ID');
}
if (!ROLE) {
  // Shit
  throw new Error('No ROLE specified');
}
if (!TEST_ID) {
  end(WORKER_ID, 'Missing TEST_ID');
  throw new Error('Missing TEST_ID');
}

loadScript(PEERJS_VERSION, function(err){
  if (err) {
    console.log('Error:', err.message);
    end(WORKER_ID, err.message);
  } else {
    console.log('Script loaded');
    saveTestData(TEST_ID, {
      browser: browserInfo(),
      peerjsVersion: PEERJS_VERSION
    });
    init();
  }
});

var testTimeout = setTimeout(function(){
  end(WORKER_ID, 'timeout');
}, FULL_TEST_TIMEOUT);

