
var roles = {
  host: function host () {
    async.series({
      data: testDataHost,
    }, function(err, results){
      saveTestData(TEST_ID, {results: results});
      end(WORKER_ID, 'success');
    });
  },
  client: function client () {
    async.series({
      data: testDataClient,
    }, function(err, results){
      saveTestData(TEST_ID, {results: results});
      end(WORKER_ID, 'success');
    });
  }
};

var peer;
function init () {
  peer = new Peer(TEST_ID + '-' + ROLE, {key: 'lwjd5qra8257b9', debug: true});
  roles[ROLE]();
}
