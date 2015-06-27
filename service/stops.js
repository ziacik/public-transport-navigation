var Q = require('q');
var GeoPoint = require('geopoint');
var overpassApi = require('query-overpass');

var overpass = function(query) {
	var deferred = Q.defer();
	
	overpassApi(query, function(error, data) {
		if (error) {
			deferred.reject(error);
		} else{
			deferred.resolve(data);
		}
	});
	
	return deferred.promise;
}

module.exports.init = function(server) {
	server.get('/stops/around/:lat/:lon/:distance', stopsAround);
	server.head('/stops/around/:lat/:lon/:distance', stopsAround);
}

var stopsAround = function(req, res, next) {
	var distance = 500;
	
	if (req.params.distance) {
		distance = parseInt(req.params.distance);
	}
	
	if (distance < 0 || distance > 1000) {
		res.send(400, { message : 'Invalid distance. Valid values are in range 0-1000.' })
		return;
	}
	
	var lat = parseFloat(req.params.lat);
	var lon = parseFloat(req.params.lon);
	
	getStopsAround(lat, lon, distance).then(function(stops) {
		res.send(stops);
		next();		
	}).catch(function(err) {
		console.log(err.stack || err);
		res.send(500, err);
		next();				
	}).done();
}


var getStopsAround = module.exports.getStopsAround = function(lat, lon, distance) {	
	//TODO To include all instances of the stop?
	var extension = 0;
	
	var point = new GeoPoint(lat, lon);
	var bounds = point.boundingCoordinates((distance + extension) / 1000.0, undefined, true);
	
	return overpass('[out:json];node["highway"="bus_stop"]["name"](' + bounds[0]._degLat + ',' + bounds[0]._degLon + ',' + bounds[1]._degLat + ',' + bounds[1]._degLon + ');out body;')
	.then(function(data) {		
		var stops = data.features.slice()
		.filter(function(feature) {
			return isNaN(parseInt(feature.properties.tags.name));
		}).map(function(feature) {
			var stopPoint = new GeoPoint(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
			feature.distance = Math.round(1000 * point.distanceTo(stopPoint, true));
			feature.points = [ { lat : stopPoint.latitude(), lon : stopPoint.longitude(), distance : feature.distance } ];
			return feature;
		}).sort(function(feature1, feature2) {			
			var stopName1 = feature1.properties.tags.name;
			var stopName2 = feature2.properties.tags.name;
			
			if (stopName1 === stopName2) {
				return feature1.distance - feature2.distance;
			} else {
				return stopName1.localeCompare(stopName2);	
			}			
		}).reduce(function(arr, feature2) {
			var feature1 = arr.slice(-1)[0];
			
			var stopName1 = feature1 ? feature1.properties.tags.name : null;
			var stopName2 = feature2.properties.tags.name;
			
			if (stopName1 === stopName2) {
				feature1.points = feature1.points.concat(feature2.points);
			} else {
				arr.push(feature2);
			}
			
			return arr;
		},[]).sort(function(feature1, feature2) {
			return feature1.distance - feature2.distance;
		}).filter(function(feature) {
			return feature.distance <= distance;
		}).map(function(feature) {
			return {
				name : feature.properties.tags.name,
				distance : feature.distance,
				points : feature.points
			};
		});

		return stops;
	});
}