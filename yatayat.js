// For node API
var _ = _ || require("underscore");
var $ = $ || require("jquery");
var kdTree = kdTree || require('./lib/kdtree/src/node/kdTree.js').kdTree;

var YY = YY || {};

YY.System = function(routes) {
    this.routes = routes;
    var routeDict = {};
    _.each(this.routes, function(r) {
        routeDict[r.id] = r;
    });
    this.routeDict = routeDict;

    // insert a routeDict within each stop

    (function(self) {

    _.each(self.routes, function(route) {
        _.each(route.stops, function(stop) {
            stop.routeDict = self.stopRoutesFromStopID(stop.id);
        });
    });

    })(this)

};

YY.System.prototype.stopRoutesFromStopID = function(stopID) {
    // XXX: use the values cached in each stop's routeDict (?)
    return _(this.routes).chain()
            .map(function(r) { if (r.stopDict[stopID]) return {stopID: stopID, routeID: r.id }; })
            .compact()
            .value();
};

// returns a new system with only passed in items included; if includeIDList is falsy, return a copy
YY.System.prototype.prune = function(includeIDList) {
    if (!includeIDList) return this;
    return new YY.System(this.routes.map(function(route) {
        return new YY.Route(route.id,
            route.stops.filter(function(s) { return s in includeIDList; }),
            route.segments.filter(function(s) { return s in includeIDList; }),
            route.tag,
            "Please don't order this route; can't find this ID");
         })
    );
};

YY.System.prototype.nearestStops = function(llArr, N) {
    // TODO: Return all stops where dist < 2 * dist(nearestStop)
    var allStops, distFn, answer, kdt;
    var thresh = 1; // really far for lat/lng
    allStops = _(this.routes).chain()
                    .pluck('stops').flatten().value();
    N = N || 1; 
    distFn = function(s1, s2) { return Math.pow(s1.lat - s2.lat, 2) + Math.pow(s1.lng - s2.lng, 2); };
    kdt = new kdTree(allStops, distFn, ["lat", "lng"]); 
    answer = kdt.nearest({lat: llArr[0], lng: llArr[1]}, N, thresh);
    return _.map(answer, function(a) { return a[0]; });
};

// Return [route] where route contains [stops], and just the stops we use
// Else return undefined
YY.System.prototype.takeMeThere = function(startStopID, goalStopID) {
    var system = this;
    var startNodes = system.stopRoutesFromStopID(startStopID);
    var goalNode = system.stopRoutesFromStopID(goalStopID)[0];
    var openset = {};
    var closedset = {}; 
    var gScores = {};
    var fScores = {};
    var cameFrom = {};
    var heuristic = function(stopRouteObj) {
        var stop = system.routeDict[stopRouteObj.routeID].stopDict[stopRouteObj.stopID];
        var goalStop = system.routeDict[goalNode.routeID].stopDict[goalNode.stopID];
        var retval =  (goalStop.lat - stop.lat) * (goalStop.lat - stop.lat) +
            (goalStop.lng - stop.lng) * (goalStop.lng - stop.lng);
        return retval;
    };
    var set = function(dict, stopRouteObj, val) {
        dict[stopRouteObj.stopID + "," + stopRouteObj.routeID] = val;
    };
    var get = function(dict, stopRouteObj) {
        return dict[stopRouteObj.stopID + "," + stopRouteObj.routeID];
    };
    var reconstructPath = function(currentNode) {
        var cameFromNode = get(cameFrom, currentNode);
        if(cameFromNode) {
            var p = reconstructPath(cameFromNode);
            return _.union(p,[currentNode]);
        } else {
            return [currentNode];
        }
    };
    var stopNameFromObj = function(sro) {
        return system.routeDict[sro.routeID].name + " : " + system.routeDict[sro.routeID].stopDict[sro.stopID].name;
    };
    function aStar() {
        _(startNodes).each(function(n) { 
            set(openset, n, n);
            set(gScores, n, 0);
            set(fScores, n, heuristic(n));
        });
        var f = function (k) { return fScores[k]; };
        while(_.keys(openset).length) {
            var current = openset[_.min(_(openset).keys(), f)];
            //console.log('open-begin', _.map(_(openset).values(), stopNameFromObj));
            //console.log('closed-begin', _.map(_(closedset).values(), stopNameFromObj));

            if (current.stopID === goalStopID) {
                return reconstructPath(current);
            }
            delete(openset[current.stopID + "," + current.routeID]);
            set(closedset, current, current);
            var neighbors = system.neighborNodes(current.stopID, current.routeID);
            _(neighbors).each( function(neighbor) {
                if (get(closedset, neighbor)) {
                    return; // equivalent to a loop continue
                } else {
                    var tentativeGScore = get(gScores, current) + neighbor.distToNeighbor; // latter = dist(current, neighbor)
                    if(! get(openset, neighbor) || tentativeGScore < get(gScores, neighbor)) {
                        set(openset, neighbor, neighbor);
                        set(cameFrom, neighbor, current);
                        set(gScores, neighbor, tentativeGScore);
                        set(fScores, neighbor, tentativeGScore + heuristic(neighbor));
                    }
                }
            });
        }
    }
    var res = aStar(); 
    // NOW CONVERT A-STAR OUTPUT FORMAT TO ROUTE / STOPS OUTPUT FORMAT
    //console.log(res);
    if (!res || res.length === 0) return 'FAIL';
    var ret = [];
    var curRoute;
    _(res).each( function(sro) {
        if (!curRoute || sro.routeID !== curRoute.id) {
            curRoute = _.clone(system.routeDict[sro.routeID]);
            curRoute.stops = [];
            ret.push(curRoute);
        }
        curRoute.stops.push(curRoute.stopDict[sro.stopID]);
    });
    //console.log(ret);
    return ret;
};
// BIG TODO: Change everything to be dicts indexed by ids rather than lists
YY.System.prototype.neighborNodes = function(stopID, routeID) {
    var thisRoute = _.find(this.routes, function(r) { return r.id === routeID; });
    var sameRouteDistance = 1;
    var transferDistance = 5;
    var neighbors = []; 
    _.each(thisRoute.stops, function(s, idx) {
        var templateObj = {routeID: thisRoute.id, distToNeighbor: sameRouteDistance};
        if (s.id === stopID) {
            if (idx < thisRoute.stops.length - 1) // not the end of list
                neighbors.push(_.extend(templateObj, 
                    {stopID: thisRoute.stops[idx + 1].id}));
            else if (thisRoute.isCyclical) // end of list on cyclical route
                neighbors.push(_.extend(templateObj,
                    {stopID: thisRoute.stops[0].id}));
            if (thisRoute.isBiDirectional) {
                if (idx > 0)
                    neighbors.push(_.extend(templateObj,
                        {stopID: thisRoute.stops[idx - 1].id}));
                else if (thisRoute.isCyclical)
                    neighbors.push(_.extend(templateObj,
                        {stopID: thisRoute.stops[thisRoute.stops.length - 1].id}));
            }
        } 
    });
    _.each(this.routes, function(r) {
        if(r.id !== routeID && _.find(r.stops, function(s) { return s.id === stopID; }))
            neighbors.push( { routeID: r.id, stopID: stopID, distToNeighbor: transferDistance} );
    });
    return neighbors;
};

YY.Route = function(id, stops, segments, tag, startStop, startSegID) {
    this.id = id;
    this.stops = stops;
    this.segments = segments;
    this.tag = tag;
    this.name = tag.name;
    this.ref = tag.ref;
    this.transport = tag.route;
    //this.orientingSegmentID = orientingSegmentID;
    if (startStop && startSegID) this.order(startStop, startSegID);
    this.deriveStopDict();
};

YY.Route.prototype.deriveStopDict = function () {
    var stopDict = {};
    _(this.stops).each(function(s) {
        stopDict[s.id] = s;
    });
    this.stopDict = stopDict;
};

YY.Route.prototype.order = function(startStop, startSegID) {
    var startSegment = _.find(route.segments, function(seg) { return seg.id === startSegID; })
    if (! startSegment) { 
        console.log("Start segment not found for route : " + this.name); return; 
    }

    // make start kd tree, end kdtree
    function recurse(thisSegment, flipped) {
        // if (flipped), reverse everything

        // find the closest start point (fwd), and the closest end point (bkd)
        // whichever is nearer, pick that, and go there

        //  
    }

}

YY.Route.prototype.order_ = function() {
    var route = this;
    
    // find orienting way
    var stops = [];
    var n = 0;
    var startSegment = _.find(route.segments, function(seg) { return seg.id === route.orientingSegmentID; });
    if (!startSegment) {
        console.log('Ordering not possible for route: ', route.name, '; no orienting_way found.');
        return;
    }

    // go through it, putting all public stops in
    function recurse(thisSegment, flipped) {
        if (n === route.segments.length) return;
        n = n + 1;

        if (flipped) {
            thisSegment.listOfLatLng.reverse();
            thisSegment.orderedListofStops.reverse();
        }
        stops = stops.concat(thisSegment.orderedListofStops);
        var segmentEnd = thisSegment.listOfLatLng[ thisSegment.listOfLatLng.length - 1 ];

        var nextFwdCnxn = _.find(route.segments, function(seg) { 
            return _.isEqual(seg.listOfLatLng[0], segmentEnd); 
        });
        if (nextFwdCnxn) recurse(nextFwdCnxn, false);

        var nextBwdCnxn = _.find(route.segments, function(seg) { 
            return _.isEqual(seg.listOfLatLng[seg.listOfLatLng.length - 1], segmentEnd) && (seg.id !== thisSegment.id);
        });
        if (nextBwdCnxn) recurse(nextBwdCnxn, true);

        if (!nextFwdCnxn && !nextBwdCnxn) 
            console.log('Broken route found in route: ', route.name);
            // console.log('Broken route found in route: ', route.name, '; only ',
            //     stops.length, ' stops upto', stops[stops.length-1].tag.name, ' found.');
        if (nextFwdCnxn && nextBwdCnxn) throw 'bad algorithm!';
    }
    recurse(startSegment, false);
    this.stops = _.map(stops, function(s) { return new YY.Stop(s.id, s.lat, s.lng, s.tag); });
    //DEBUG: _.each(stops, function(s) {console.log(s.tag.name)});
};

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
    var stopToSegDict = {};
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
        nodes[$n.attr('id')] = {id: $n.attr('id'),
                                lat: $n.attr('lat'),
                                lng: $n.attr('lon'), 
                                tag: tagObj,
                                is_stop: tagObj.public_transport === 'stop_position'};
    });
    _.each($(overpassXML).find('way'), function(w) {
        var $w = $(w);
        var myNodes = [];
        var myStops = [];
        _.each($w.find('nd'), function(n) {
            var node = nodes[$(n).attr('ref')];
            if(node.is_stop) {
                myStops.push(node);
                stopToSegDict[node.id] = $w.attr('id');
            }
            myNodes.push([node.lat, node.lng]);
        });
        segments[$w.attr('id')] = new YY.Segment($w.attr('id'), myNodes, tagToObj($w.find('tag')), myStops);
    });
    var routes = _.map($(overpassXML).find('relation'), function(r) {
        var $r = $(r);
        var myStops = [];
        var mySegments = [];
        var startStop, startSegID;
        _.each($r.find('member'), function(m) {
            var $m = $(m); 
            if($m.attr('type') === 'way') {
                mySegments.push(segments[$m.attr('ref')]);
            } else if ($m.attr('type') === 'node') {
                var n = nodes[$m.attr('ref')];
                if ($m.attr('role') === 'terminus' || $m.attr('role') === 'start')
                    startStop = $m;
                //if($n.find('tag')public_transportation === 'stop_position') 
                if(n && n.lat && n.lng)
                    myStops.push(new YY.Stop($m.attr('ref'), n.lat, n.lng, n.tag));
            } 
        });
        return new YY.Route($r.attr('id'), myStops, mySegments, tagToObj($r.find('tag')),
                            startStop, stopToSegDict[startStop.id]);
    });
    return new YY.System(routes);
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

// selectively export as a node module
var module = module || {};
module.exports = YY.fromOSM;

