
var roles = {
  host: function host() {
    async.series({
      data: testDataHost,
    }, function(err, results){
      saveTestResult(TEST_ID, results);
      end(WORKER_ID, 'success');
    });
  },
  client: function client() {
    async.series({
      data: testDataClient,
    }, function(err, results){
      saveTestResult(TEST_ID, results);
      end(WORKER_ID, 'success');
    });
  }
};

var peer;
function init () {
  peer = new Peer(TEST_ID + '-' + ROLE, {key: 'lwjd5qra8257b9', debug: true});
  peer.on('error', console.log);
  roles[ROLE]();
}
