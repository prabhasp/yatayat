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
