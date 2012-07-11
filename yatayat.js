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
        function makeNeighbor(a, b, stopsNeedReversal) {
            var idx = Math.min(a,b);
            var idx2 = Math.max(a,b);
            if(neighborlist[idx] === undefined) {
                neighborlist[idx] = [idx2, stopsNeedReversal];
            } else {
                if(neighborlist[idx2]) throw "bad algorithm!";
                neighborlist[idx2] = [idx, stopsNeedReversal];
            }
        }
        var l1 = seg.listOfLatLng[0];
        var l2 = seg.listOfLatLng[seg.listOfLatLng.length - 1];
        var idx1_2 = segmentEnds[l1];
        var idx2_2 = segmentEnds[l2];
        if (idx1_2 !== undefined) makeNeighbor(idx, idx1_2[0], idx1_2[1]==0);
        if (idx2_2 !== undefined) makeNeighbor(idx, idx2_2[0], idx2_2[1]==1);

        segmentEnds[l1] = [idx, 0];
        segmentEnds[l2] = [idx, 1];
    });
    //console.log(neighborlist);
    // order stops based on segments
    var seed = _.keys(neighborlist)[0]; 
    function f(route, key) {
        if (key == seed) return;
        var neighborArr = neighborlist[key];
        console.log([key, neighborArr[1]]);
        var stops = route.segments[key].orderedListofStops;
        if (neighborArr[1])
            _.each(stops.reverse(), function(x) { console.log(x.tag.name); });
        else
            _.each(stops, function(x) {console.log(x.tag.name); });
        f(route, neighborArr[0]);
    }
    f(this, neighborlist[seed][0]);
}

YY.Stop = function(lat, lng, tag) {
    this.lat = lat;
    this.lng = lng;
    this.tag = tag;
    this.name = tag.name;
};

YY.Segment = function(listOfLatLng, tag, orderedStops) {
    this.listOfLatLng = listOfLatLng;
    this.tag = tag;
    this.orderedListofStops = orderedStops; // intermediarily needed
};

YY.fromOSM = function (overpassXML) {
    var nodes = {};
    var segments = {};
    var routeStops = {};
    var tagToObj = function(tag) {
        tags = {};
        _.each(tag, function (t) { 
            var $t = $(t);
            tags[$t.attr('k')] = $t.attr('v'); });
        return tags; 
    };
    _.each($(overpassXML).find('node'), function(n) {
        var $n = $(n);
        var tagObj = tagToObj($n.find('tag'));
        nodes[$n.attr('id')] = {lat: $n.attr('lat'),
                                lng: $n.attr('lon'), 
                                tag: tagObj,
                                is_stop: tagObj.public_transport === 'stop_position'};
    });
    _.each($(overpassXML).find('way'), function(w) {
        $w = $(w);
        var myNodes = [];
        var myStops = [];
        _.each($w.find('nd'), function(n) {
            var node = nodes[$(n).attr('ref')];
            if(node.is_stop)
                myStops.push(node);
            myNodes.push([node.lat, node.lng]);
        });
        segments[$w.attr('id')] = new YY.Segment(myNodes, tagToObj($w.find('tag')), myStops);
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
