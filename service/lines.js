var Q = require('q');
var GeoPoint = require('geopoint');
var request = Q.denodeify(require('request'));
var cheerio = require('cheerio');

var stops = require('./stops');

module.exports.init = function(server) {
	server.get('/lines/between/:latStart/:lonStart/:latEnd/:lonEnd/:distance', linesBetween);
	server.head('/lines/between/:latStart/:lonStart/:latEnd/:lonEnd/:distance', linesBetween);
}

var linesBetween = function(req, res, next) {
	var distance = 500;
	
	if (req.params.distance) {
		distance = parseInt(req.params.distance);
	}
	
	if (distance < 0 || distance > 1000) {
		res.send(400, { message : 'Invalid distance. Valid values are in range 0-1000.' })
		return;
	}
	
	var latStart = parseFloat(req.params.latStart);
	var lonStart = parseFloat(req.params.lonStart);
	
	var latEnd = parseFloat(req.params.latEnd);
	var lonEnd = parseFloat(req.params.lonEnd);
	
	stops.getStopsAround(latStart, lonStart, distance).then(function(stopsStart) {
		return stops.getStopsAround(latEnd, lonEnd, distance).then(function(stopsEnd) {
			return getLinesBetween(stopsStart, stopsEnd);
		});
	}).then(function(lines) {
		res.send(lines);
		next();		
	}).catch(function(err) {
		console.log(err.stack || err);
		res.send(500, err);
		next();				
	}).done();
}

var getLinesBetween = function(stopsStart, stopsEnd) {	
	var combinations = stopsStart.map(function(stopStart) {
		return stopsEnd.map(function(stopEnd) {
			return { start : stopStart, end : stopEnd };
		})
	}).reduce(function(arr, it) {
		return arr.concat(it);
	}, []);
	
	var results = combinations.map(function(combination) {
		return getLinesBetweenStartEnd(combination);
	})
	
	return Q.all(results);
};

var getLinesBetweenStartEnd = function(startEnd) {
	var serviceUrl = 'http://cp.atlas.sk/zilina/spojenie/?date=27.06.2015&time=11%3a40&f=' + startEnd.start.name + '&t=' + startEnd.end.name + '&fc=405003&tc=405003&submit=true';
	console.log(serviceUrl);
	return request(serviceUrl).spread(function(response, html) {
		var line = {};
		var $ = cheerio.load(html);
		var $tbody = $($('#main-res-inner').find('tbody')[0]);
		var rows = $tbody.children('.datarow');
		var rowA = $(rows[0]).children('td'); //TODO check for no rows
		var rowB = $(rows[rows.length - 1]).children('td'); //TODO check for no rows
		line.from = $(rowA[2]).text().trim();
		line.to = $(rowB[2]).text().trim();
		line.departure = $(rowA[4]).text().trim();
		line.arrival = $(rowB[3]).text().trim();
		return line;
		
	});
}