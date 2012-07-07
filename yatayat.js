var YY = YY || {}

YY.Route = function(stops, segments, tag) {
    this.stops = stops;
    this.segments = segments;
    this.tag = tag;
};

YY.Stop = function(lat, lng, tag) {
    this.lat = lat;
    this.lng = lng;
    this.tag = tag;
};

YY.Segment = function(listOfLatLng, tag) {
    this.listOfLatLng = listOfLatLng;
    this.tag = tag;
};



YY.render = function(route, map) {
    // draw a route on a map!

    // render segments as polylines
    route.segments.forEach(function(seg) {
        var latlngs = seg.listOfLatLng.map(function(LL) {
            return new L.LatLng(LL[0], LL[1]);
        });
        var poly = new L.Polyline(latlngs, {color: 'red'});
        map.addLayer(poly);
    });

    // and stops as markers
    route.stops.forEach(function(stop) {
        var latlng = new L.LatLng(stop.lat, stop.lng);
        var marker = new L.Marker(latlng);
        map.addLayer(marker);
    });
};
