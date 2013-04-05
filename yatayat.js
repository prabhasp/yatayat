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
            stop.routeDict = {};
            self.routes
                .filter(function(r) { return (r.stopDict[stop.id]); })
                .forEach(function(r) { stop.routeDict[r.id] = r; });
        });
    });

    })(this);
};

YY.System.prototype.allStops = function() {
    var idToStop = {};
    this.routes.forEach(function(r) {
        r.stops.forEach(function(s) { idToStop[s.id] = s; });
    });
    return _.values(idToStop);
};

YY.System.prototype.stopRoutesFromStopID = function(stopID) {
    return _(this.routes).chain()
            .map(function(r) { if (r.stopDict[stopID]) return {stopID: stopID, routeID: r.id }; })
            .compact()
            .value();
};

YY.System.prototype.stopRoutesFromStopName = function(stopName) {
    var aggregator = [];
    _(this.routes).each(function (r) {
        _(r.stops).each(function (s) {
            if (s.name === stopName) {
                aggregator.push({stopID: s.id, routeID: r.id });
            }
        });
    });
    return aggregator;
};

// returns a new system with only passed in items included; if includeIDList is falsy, return a copy
YY.System.prototype.prune = function(includeIDList) {
    if (!includeIDList) return this;
    return new YY.System(this.routes.map(function(route) {
        if (route.id in includeIDList) return route;
        else return new YY.Route(route.id,
            route.stops.filter(function(s) { return s.id in includeIDList; }),
            route.segments.filter(function(s) { return s.id in includeIDList; }),
            route.tag,
            undefined); //Please don't order this route; this is not a valid startSegID
         })
    );
};
YY.System.prototype.nearestStops = function(llArr, N, maxDist) {
    // TODO: Return all stops where dist < 2 * dist(nearestStop)
    if(YY._kdt === undefined) {
        var allStops = this.allStops();
        var distFn = function(s1, s2) { return Math.pow(s1.lat - s2.lat, 2) + Math.pow(s1.lng - s2.lng, 2); };
        YY._kdt = new kdTree(allStops, distFn, ["lat", "lng"]);
    }
    var kdt = YY._kdt;
    var thresh = maxDist || 1; // really far for lat/lng
    var N = N || 1; 
    var answer = kdt.nearest({lat: llArr[0], lng: llArr[1]}, N, thresh);
    return _.map(answer, function(a) { return a[0]; });
};

YY.System.prototype.takeMeThereByName = function(startStopName, goalStopName) {
    var startNodes = this.stopRoutesFromStopName(startStopName);
    var goalNodes = this.stopRoutesFromStopName(goalStopName);
    if (_.isEmpty(startNodes) || _.isEmpty(goalNodes)) return 'FAIL: Start / Goal not found';
    // TODO: throw error if goal nodes are far away from each other
    return this.takeMeThereByStop(startNodes, goalNodes[0]);
}

YY.System.prototype.takeMeThere = function(startStopID, goalStopID) {
    var startNodes = this.stopRoutesFromStopID(startStopID);
    var goalNodes = this.stopRoutesFromStopID(goalStopID);
    return this.takeMeThereByStop(startNodes, goalNodes[0]);
}

// Return [route] where route contains [stops], and just the stops we use
// Else return undefined
YY.System.prototype.takeMeThereByStop = function(startNodes, goalNode) {
    var system = this;
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

            if (current.stopID === goalNode.stopID) {
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
        if (s.id === stopID) {
            if (idx < thisRoute.stops.length - 1) // not the end of list
                neighbors.push({routeID: thisRoute.id, distToNeighbor: sameRouteDistance, 
                    stopID: thisRoute.stops[idx + 1].id});
            /*else if (thisRoute.isCyclical) // end of list on cyclical route
                neighbors.push({routeID: thisRoute.id, distToNeighbor: sameRouteDistance,
                    stopID: thisRoute.stops[0].id});
            */
            
            //if (!thisRoute.isDirectional) {
            if (idx > 0)
                neighbors.push({routeID: thisRoute.id, distToNeighbor: sameRouteDistance,
                    stopID: thisRoute.stops[idx - 1].id});
            /*else if (thisRoute.isCyclical)
                    neighbors.push(_.extend(templateObj,
                        {stopID: _.last(thisRoute.stops).id}));
            */
            //}
        } 
    });
    _.each(this.routes, function(r) {
        if(r.id !== routeID && _.find(r.stops, function(s) { return s.id === stopID; }))
            neighbors.push( { routeID: r.id, stopID: stopID, distToNeighbor: transferDistance} );
    });
    return neighbors;
};

YY.Route = function(id, stops, ways, tag, startSegID) {
    this.id = id;
    this.stops = stops;

    //for the ordering function
    this._unconnectedSegments = ways;
    this.segmentsInOrder = [];

    this.tag = tag;
    this.name = tag.name;
    this.ref = tag.ref;
    this.transport = tag.route;

    if (startSegID) this.order(startSegID);
    else this._noTerminus = true;
    this.deriveStopDict(); // note: this must happen after the order call

    //TODO: remove
    this.segments = this.segmentsInOrder;
};

YY.Route.prototype.deriveStopDict = function () {
    var stopDict = {};
    _(this.stops).each(function(s) {
        stopDict[s.id] = s;
    });
    this.stopDict = stopDict;
};
    
var distanceForObjLL = function(ll1, ll2) { return Math.pow(ll1.lat - ll2.lat, 2) + Math.pow(ll1.lng - ll2.lng, 2); };
var distanceForArrLL = function(ll1, ll2) { return Math.pow(ll1[0] - ll2[1], 2) + Math.pow(ll1[0] - ll2[1], 2); };

YY.Route.prototype.order = function(startSegID) {
    var route = this;
    // Find the first segment; if necessary, flip it, and call keepOrdering 
    var startSegment = _.find(route._unconnectedSegments, function(seg) { return seg.id === startSegID; });
    var startingStop = _.find(startSegment.orderedListofStops, function(s) { return s.is_start; });
    if (!startSegment || !startingStop) { 
        console.log('violation of assumption that startSegment exists in route: ', this.id); 
        return;
        //throw 'violation of assumption that startSegment exists';
    }

    var ends = [_.first(startSegment.listOfLatLng), _.last(startSegment.listOfLatLng)];
    if (ends[1][0] === startingStop.lat && ends[1][1] === startingStop.lng)
        startSegment.flip();

    this.keepOrdering(startSegment, startingStop);
}

YY.Route.prototype.keepOrdering = function(way, stop) {
    var route = this;
    if(way.listOfLatLng[0][0] !== stop.lat || way.listOfLatLng[0][1] !== stop.lng) {
        console.log('violation of invariant: keepOrdering can only be called if way begins with stop ; ' +
            'route :'  + route.name);
        return;
    }
    // some prep for later
    function tos(ll) { return ll[0] + "," + ll[1]; }
    var thisWaysEnd; // will be filled in later

    // Okay, now that we confirm first stop is here, chuck it.
    // Is there another stop in this way?
    var stop2 = _.first(_.rest(way.orderedListofStops));

    if (stop2) { // Yes, stop2 is remaining in the way

        // Take the chunk of nodes from way1 and way2 
        var indexUntil = _.compact(_.map(way.listOfLatLng, function(ll, idx) { 
            if (ll[0] == stop2.lat && ll[1] == stop2.lng) return idx; }))[0];
        var chunkedLLL = way.listOfLatLng.slice(0, indexUntil+1);
        
        // and throw that chunk away
        way.orderedListofStops = _.rest(way.orderedListofStops);
        way.listOfLatLng = way.listOfLatLng.slice(indexUntil);
        
        // add the chunked segment to segmentsInOrder
        route.segmentsInOrder.push(
            new YY.Segment(_.uniqueId(), chunkedLLL, way.tag, [stop, stop2]));
        route.stops.push(stop);

        // call keepOrdering(way, stop2); continue 
        if (way.listOfLatLng.length > 1) {
            route.keepOrdering(way, stop2);

        } else { // special case: the whole way is filed away... need to go down to stop2 logic, but with special exceptions
            stop = stop2;
            stop2 = undefined;
            thisWaysEnd = tos(_.last(way.listOfLatLng));
            way.listOfLatLng = [];
        }
    } 
    if (!stop2) { // No stop remaining in this way

        route._unconnectedSegments = _.without(route._unconnectedSegments, way);
        // Search all other way-endings to match this way's end
        var fronts = _(route._unconnectedSegments).map(function(uS) { return tos(_.first(uS.listOfLatLng)); })
        var backs = _(route._unconnectedSegments).map(function(uS) { return tos(_.last(uS.listOfLatLng)); })

        // this ways end (unless already defined, for the special case)
        var thisWaysEnd = thisWaysEnd || tos(_.last(way.listOfLatLng));

        var way2FrontCnxn = _(fronts).indexOf(thisWaysEnd); /* TODO: kdtree ? */
        var way2BackCnxn = _(backs).indexOf(thisWaysEnd);   /* TODO: kdtree ? */

            // ERROR / END conditions
            if (way2FrontCnxn > -1 && way2BackCnxn > -1) {
                console.log( "branching at lat/lng: " + thisWaysEnd);
                return;
            } else if (way2FrontCnxn === -1 && way2BackCnxn === -1) {
                console.log("search space exhausted with ", route._unconnectedSegments.length,
                 " ways left for route: ", route.name);
                return; // search space exhausted
            }
        var way2 = (way2FrontCnxn > -1) ? route._unconnectedSegments[way2FrontCnxn] :
                                          route._unconnectedSegments[way2BackCnxn];
        // If you find it on the "back-side" of another way, flip that second way
        if (way2BackCnxn > -1) {
            way2.flip();
        }

        // call keepOrdering(concat(way,way2), stop) (shrinking _unconnectedSegments appropriately)
        // remember that at this point: way.orderedListOfStops is empty, and they are oriented the same way
        way2.listOfLatLng = way.listOfLatLng.concat(way2.listOfLatLng);
        route.keepOrdering(way2, stop);
    }
    
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

YY.fromConfig = function(config_path, cb) {
    // sequentially loads config file, and the system it calls for
    // cb is called on the resulting system.
    $.getJSON(config_path, {}, function(conf) {
        // blend in the conf to the YY namespace
        for(var key in conf) {
            YY[key] = conf[key];
        }
        // load in & parse XML
        $.ajax({type: YY.GET_OR_POST, url: YY.API_URL,
                data: YY.QUERY_STRING,
                dataType: "text",
                success: function(res) {
                    cb(YY.fromOSM(res));
                }});
    });
};

YY.Segment.prototype.flip = function() {
    this.listOfLatLng = _(this.listOfLatLng).reverse();
    this.orderedListofStops = _(this.orderedListofStops).reverse();
}

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
    /* Step 1: process all the returned nodes; put them in local nodes obj */
    _.each($(overpassXML).find('node'), function(n) {
        var $n = $(n);
        var tagObj = tagToObj($n.find('tag'));
        nodes[$n.attr('id')] = {id: $n.attr('id'),
                                lat: $n.attr('lat'),
                                lng: $n.attr('lon'), 
                                tag: tagObj,
                                is_stop: tagObj.public_transport === 'stop_position'};
    });
    /* Step 2: put all ways from overpass into local segments obj + stopToSegDict */ 
    _.each($(overpassXML).find('way'), function(w) {
        var $w = $(w);
        var myNodes = [];
        var myStops = [];
        _.each($w.find('nd'), function(n) {
            var node = nodes[$(n).attr('ref')];
            if(node.is_stop) {
                myStops.push(node);
                if (!stopToSegDict[node.id])  
                    stopToSegDict[node.id] = [];
                stopToSegDict[node.id].push($w.attr('id'));
            }
            myNodes.push([node.lat, node.lng]);
        });
        // At this point, myNodes = ordered list of nodes in this segment, myStops = ordered list of stops
        segments[$w.attr('id')] = new YY.Segment($w.attr('id'), myNodes, tagToObj($w.find('tag')), myStops);
    });
    var routes = _.map($(overpassXML).find('relation'), function(r) {
        var $r = $(r);
        var mySegments = [];
        var startStop, startSegID;
        _.each($r.find('member'), function(m) {
            var $m = $(m); 
            if($m.attr('type') === 'way') {
                mySegments.push(segments[$m.attr('ref')]);
            } else if ($m.attr('type') === 'node') {
                var n = nodes[$m.attr('ref')];
                if (n && n.lat && n.lng) {
                    var stop = new YY.Stop($m.attr('ref'), n.lat, n.lng, n.tag);
                    if ($m.attr('role') === 'terminus' || $m.attr('role') === 'start') {
                        startStop = stop;
                        n.is_start = true;
                    }
                }
            } 
        });
        var startSegID = startStop && _.find(stopToSegDict[startStop.id], function(segID) { return _.contains(_.pluck(mySegments, 'id'), segID); })
        return new YY.Route($r.attr('id'), [], mySegments, tagToObj($r.find('tag')), startSegID);
        /* TODO: now adding stops through the order() step; refactor accordingly */
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

