var CDN = 'http://cdn.peerjs.com'
var FILE = 'peer.js'

function loadScript(v, cb) {
  if (!cb) {
    cb = noop;
  }
  var loadTimeout = setTimeout(function(){
    cb(new Error('Could not load PeerJS v' + v));
  }, 5000);
  var script = document.createElement('script');
  script.onload = function(){
    clearTimeout(loadTimeout);
    cb()
  };
  script.setAttribute("type", "text/javascript");
  script.setAttribute("src", CDN + "/" + v + "/" + FILE);
  document.getElementsByTagName("head")[0].appendChild(script);
}

function getTestId(cb) {
  get('/id', function(data){
    if (data) {
      cb(data.id || null);
    } else {
      cb(null);
    }
  });
}

function saveTestData(id, data, cb) {
  if (!cb) {
    cb = noop;
  }
  data.testId = id;
  post('/save', data, cb);
}

var noop = function(){}
