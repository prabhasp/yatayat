var tlat = 27.7;
var tlng = 85.3;

var routes = [];
for(var i=0; i<5; i++) {
    var segments = [];
    var stops = [];

    var lastlat = tlat + 0.1*Math.random() - 0.05;
    var lastlng = tlng + 0.1*Math.random() - 0.05;

    var nsegs = 5 + Math.floor(15*Math.random())
    for(var j=0; j<nsegs; j++) {
        var npts = 2 + Math.floor(10*Math.random());
        var listOfLatLng = [];
        for(var k=0; k<npts; k++) {
            var lat = lastlat + 0.01*Math.random() - 0.005;
            var lng = lastlng + 0.01*Math.random() - 0.005;

            listOfLatLng.push([lat,lng]);

            if(Math.random()<0.05) {
                stops.push(new YY.Stop(lat, lng, {}));
            }

            lastlat = lat;
            lastlng = lng;
        }
        segments.push(new YY.Segment(listOfLatLng, {}));
    }
    console.log("about to render", YY.test_map, stops, segments);
    YY.render(new YY.Route(stops, segments, {}), YY.test_map);
}

