var YY = YY || {}

YY.Route = function(stops, segments, tag) {
    this.stops = stops;
    this.segments = segments;
    this.tag = tag;
    this.name = tag.name;
};

YY.Stop = function(lat, lng, tag) {
    this.lat = lat;
    this.lng = lng;
    this.tag = tag;
    this.name = tag.name;
};

YY.Segment = function(listOfLatLng, tag) {
    this.listOfLatLng = listOfLatLng;
    this.tag = tag;
};



YY.render = function(route, map) {

    // draw a route on a map!

    // render the route as a multi-polyline
    var routeMPL = new L.MultiPolyline(
        _(route.segments).map(function(seg) {
            return _(seg.listOfLatLng).map(function(LL) {
                return new L.LatLng(LL[0], LL[1]);
            });
        }),
        {color: 'red'});
    routeMPL.bindPopup(route.name);
    map.addLayer(routeMPL);

    // and stops as markers
    route.stops.forEach(function(stop) {
        var latlng = new L.LatLng(stop.lat, stop.lng);
        var marker = new L.Marker(latlng);
        marker.bindPopup(stop.name);
        map.addLayer(marker);
    });
};
