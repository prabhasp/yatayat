var http = require('http');
var url = require('url');
var yy = require('./yatayat.js')
var conf = require('./config.js')

// fetch overpass API data
var system = {};

// split API url into host and path
var options = url.parse(conf.API_URL);
options.method='POST';
    
var req = http.request(options, function(res) {
    res.content = '';
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
        console.log('CHUNK', chunk);
        res.content += chunk;
    });
    res.on('end', function() {
        system = yy(res.content);
        console.log('got', system.routes.length, 'routes from overpass');
    });
});

req.write(conf.QUERY_STRING);
req.end();

function serializeStop(stop) {
    return {id: stop.id,
            lat: stop.lat,
            lng: stop.lng,
            name: stop.name};
}

function serializeRoute(route, isPartialRoute) {
    // returns a JSON object for a route
    var fullRouteBool = !isPartialRoute; // ie. isPartialRoute is falsy
    return {id: route.id,
            name: route.name,
            ref: route.ref,
            transport: route.transport,
            fullroute: fullRouteBool,
            stops: route.stops.map(function(s) { return serializeStop(s); })};
}

function serializeSystem(system) {
    return {routes: system.routes.map(function(r) { return serializeRoute(r); })};
}

http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(serializeSystem(system),
                           null, 4));
}).listen(8020, "127.0.0.1");
console.log('yatayat api running at http://127.0.0.1:8020/');
