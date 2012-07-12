var http = require('http');
var url = require('url');
var yy = require('./yatayat.js')
var conf = require('./config.js')

// fetch overpass API data
var routes = [];

// split API url into host and path
var split_idx = conf.API_URL.indexOf('/', 'http://'.length)
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
        routes = yy(res.content);
        console.log('got routes from overpass', routes);
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

function serializeRoute(route) {
    // returns a JSON object for a route
    return {id: 'TODO',
            stops: route.stops.map(function(s) { return serializeStop(s); })};
}

http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(routes.map(function(r) { return serializeRoute(r); })));
}).listen(8020, "127.0.0.1");
console.log('yatayat api running at http://127.0.0.1:8020/');
