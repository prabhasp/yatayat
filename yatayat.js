var YY = YY || {}

YY.Route = function(stops, segments, tag, orientingSegmentID) {
    this.stops = stops;
    this.segments = segments;
    this.tag = tag;
    this.name = tag.name;
    this.orientingSegmentID = orientingSegmentID;
    this.order();
};

YY.Route.prototyp.order = function() {
    var route = this;
    
    // find orienting way

    // go through it, putting all public stops in

    // find the end in another way, and continue
    

};


YY.Route.prototype.order2 = function() {
    // order segments

    // order step 1: collect together ends of segments (assume ends match) 
    var segmentEnds = {};
    var neighborDict = {};
    var route = this;
    

    console.log(this.name);
    _.each(this.segments, function(seg, idx) {
        function makeNeighbor(a, b) {
            var id, id2;
            if(a[0] < b[0]) { id = a; id2 = b; }
            else { id = b; id2 = a; }
            if(neighborDict[id[0]] === undefined) {
                neighborDict[id[0]] = [id2, id[1], seg.id];
            } else {
                if(neighborDict[id2[0]]) throw "bad algorithm!";
                neighborDict[id2[0]] = [id, id2[1], seg.id];
            }
        }
        var l1 = seg.listOfLatLng[0];
        var l2 = seg.listOfLatLng[seg.listOfLatLng.length - 1];
        var idx1_2 = segmentEnds[l1];
        var idx2_2 = segmentEnds[l2];
        if (idx1_2 !== undefined) makeNeighbor([idx, 'l'], idx1_2);
        if (idx2_2 !== undefined) makeNeighbor([idx, 'r'], idx2_2);

        segmentEnds[l1] = [idx, 'l'];
        segmentEnds[l2] = [idx, 'r'];
    });
    console.log(neighborDict);
    // order stops based on segments
    var orientingSegmentKey, newNeighborDict;
    _.each(neighborDict, function(v, k) {
        if(v[2] === route.orientingSegmentID) {
            //flipp neighborDict
            if (v[1] == 'l' && !newNeighborDict) {    
                console.log('flipping');
                newNeighborDict = {}
                _.each(neighborDict, function(v2, k2) {
                    console.log(k2, v2);
                    //newNeighborDict[v2[0][0]] = [k2, v2[1]], v2[0][1]];
                });
                neighborDict = newNeighborDict;
            }
            orientingSegmentKey = k;
        }
    });
    console.log('orienting with ', orientingSegmentKey);
    var started = false;
    function f(key, flipped) {
        if (key == orientingSegmentKey && started) return;
        started = true;
        var neighborArr = neighborDict[key];
        var stops = route.segments[key].orderedListofStops;
        if (flipped) { stops = stops.reverse(); }
        console.log(key, flipped);
        _.each(stops, function(x) {console.log(x.tag.name); });
        var flippedNext = (neighborArr[1] === neighborArr[0][1]) ? !flipped : flipped;
        f(neighborArr[0][0], flippedNext);
    }
    f(orientingSegmentKey, false);
}

YY.Stop = function(id, lat, lng, tag) {
    this.id = id;
    this.lat = lat;
    this.lng = lng;
    this.tag = tag;
    this.name = tag.name;
};

YY.Segment = function(id, listOfLatLng, tag, orderedStops) {
    this.id = id;
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
        segments[$w.attr('id')] = new YY.Segment($w.attr('id'), myNodes, tagToObj($w.find('tag')), myStops);
    });
    routes = _.map($(overpassXML).find('relation'), function(r) {
        var $r = $(r);
        var myStops = [];
        var mySegments = [];
        var orientingSegmentID;
        _.each($r.find('member'), function(m) {
            var $m = $(m); 
            if($m.attr('type') === 'way') {
                if ($m.attr('role') === 'orienting_way')
                    orientingSegmentID = $m.attr('ref');
                mySegments.push(segments[$m.attr('ref')]);
            } else if ($m.attr('type') === 'node') {
                var n = nodes[$m.attr('ref')];
                //if($n.find('tag')public_transportation === 'stop_position') 
                if(n && n.lat && n.lng)
                    myStops.push(new YY.Stop($m.attr('ref'), n.lat, n.lng, n.tag));
            } 
        });
        return new YY.Route(myStops, mySegments, tagToObj($r.find('tag')), orientingSegmentID);
    });
    return routes;
}

YY.viz = function(route, map) {
route.segments.forEach(function(seg, idx) {
        var latlngs = seg.listOfLatLng.map(function(LL) {
            return new L.LatLng(LL[0], LL[1]);
        });
        //var color = 0xffffff * (idx / route.segments.length * 1.0);  
        var poly = new L.Polyline(latlngs, {color: colors.getProportional(idx / route.segments.length * 1.0)});
        map.addLayer(new L.Circle(latlngs[0], 2, {color: 'blue', opacity: 0.5}));
        map.addLayer(new L.Circle(latlngs[latlngs.length-1], 2, {color: 'green', opacity: 0.5}));
        poly.bindPopup(route.name);
        map.addLayer(poly);
    });
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


// COLORS MODULE
var colors = (function() {
    var colors = {};
    var colorschemes = {proportional: {
    // http://colorbrewer2.org/index.php?type=sequential
        "Set1": ["#EFEDF5", "#DADAEB", "#BCBDDC", "#9E9AC8", "#807DBA", "#6A51A3", "#54278F", "#3F007D"],
        "Set2": ["#DEEBF7", "#C6DBEF", "#9ECAE1", "#6BAED6", "#4292C6", "#2171B5", "#08519C", "#08306B"]
    }};
    var defaultColorScheme = "Set1";
    function select_from_colors(type, colorscheme, zero_to_one_inclusive) {
        var epsilon = 0.00001;
        colorscheme = colorscheme || defaultColorScheme;
        var colorsArr = colorschemes[type][colorscheme];
        return colorsArr[Math.floor(zero_to_one_inclusive * (colorsArr.length - epsilon))];
    }
  
    // METHODS FOR EXPORT
    colors.getNumProportional = function(colorscheme) {
        colorscheme = colorscheme || defaultColorScheme;
        return colorschemes.proportional[colorscheme].length;
    };
    colors.getProportional = function(zero_to_one, colorscheme) {
        return select_from_colors('proportional', colorscheme, zero_to_one);
    };
   
    return colors;
}());
