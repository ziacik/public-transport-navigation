var restify = require('restify');
var server = restify.createServer();

require('./stops').init(server);
require('./lines').init(server);

server.listen(8080, function() {
	console.log('%s listening at %s', server.name, server.url);
});