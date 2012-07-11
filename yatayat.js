var YY = YY || {}

YY.Route = function(stops, segments, tag) {
    this.stops = stops;
    this.segments = segments;
    this.tag = tag;
    this.name = tag.name;
    this.order();
};

YY.Route.prototype.order = function() {
    // order segments

    // order step 1: collect together ends of segments (assume ends match) 
    var segmentEnds = {};
    var neighborlist = {};
    console.log(this.name);
    _.each(this.segments, function(seg, idx) {
        function makeNeighbor(a, b) {
            var idx = Math.min(a,b);
            var idx2 = Math.max(a,b);
            if (b === undefined) return;
            if(neighborlist[idx] === undefined) {
                neighborlist[idx] = idx2;
            } else {
                if(neighborlist[idx2]) throw "bad algorithm!";
                neighborlist[idx2] = idx;
            }
        }
        var l1 = seg.listOfLatLng[0];
        var l2 = seg.listOfLatLng[seg.listOfLatLng.length - 1];
        var idx1_2 = segmentEnds[l1];
        var idx2_2 = segmentEnds[l2];
        makeNeighbor(idx, idx1_2);
        makeNeighbor(idx, idx2_2);

        segmentEnds[l1] = idx;
        segmentEnds[l2] = idx;
    });
    // order stops based on segments
    //console.log(neighborsmall);
    //console.log(neighborbig);
    console.log(neighborlist);
}

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

YY.fromOSM = function (overpassXML) {
    var nodes = {};
    var segments = {};
    var tagToObj = function(tag) {
        tags = {};
        _.each(tag, function (t) { 
            var $t = $(t);
            tags[$t.attr('k')] = $t.attr('v'); });
        return tags; 
    };
    _.each($(overpassXML).find('node'), function(n) {
        var $n = $(n);
        nodes[$n.attr('id')] = {lat: $n.attr('lat'),
                                lng: $n.attr('lon'), 
                                tag: tagToObj($n.find('tag'))};
    });
    _.each($(overpassXML).find('way'), function(w) {
        $w = $(w);
        segments[$w.attr('id')] = new YY.Segment(
            _.compact(_.map($w.find('nd'),function(n) { 
                var node = nodes[$(n).attr('ref')];
                // NOTE: crashing here indicates that nodes are missing
                // Check query_string
                return [node.lat, node.lng];
            })), 
            tagToObj($w.find('tag')));
    });
    routes = _.map($(overpassXML).find('relation'), function(r) {
        var $r = $(r);
        var myStops = [];
        var mySegments = [];
        _.each($r.find('member'), function(m) {
            var $m = $(m); 
            if($m.attr('type') === 'way') {
                mySegments.push(segments[$m.attr('ref')]);
            } else if ($m.attr('type') === 'node') {
                var n = nodes[$m.attr('ref')];
                //if($n.find('tag')public_transportation === 'stop_position') 
                if(n && n.lat && n.lng)
                    myStops.push(new YY.Stop(n.lat, n.lng, n.tag));
            } 
        });
        return new YY.Route(myStops, mySegments, tagToObj($r.find('tag')));
    });
    return routes;
}

YY.render = function(route, map) {

    // draw a route on a map!

    // render the route as a multi-polyline
    var routeMPL = new L.MultiPolyline(
        _.map(route.segments, function(seg) {
            return _.map(seg.listOfLatLng, function(LL) {
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
